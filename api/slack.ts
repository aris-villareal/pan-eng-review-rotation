import { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

// Function to verify Slack request signature
function verifySlackSignature(body: string, signature: string, timestamp: string, signingSecret: string): boolean {
  const time = Math.floor(new Date().getTime() / 1000);
  if (Math.abs(time - parseInt(timestamp)) > 300) {
    return false; // Request is older than 5 minutes
  }

  const sigBasestring = 'v0:' + timestamp + ':' + body;
  const mySignature = 'v0=' + crypto.createHmac('sha256', signingSecret).update(sigBasestring, 'utf8').digest('hex');
  
  return crypto.timingSafeEqual(Buffer.from(mySignature, 'utf8'), Buffer.from(signature, 'utf8'));
}

// Initialize services function
async function initializeServices() {
  const config = {
    slackBotToken: (process.env.SLACK_BOT_TOKEN || '').trim(),
    slackChannelId: (process.env.SLACK_CHANNEL_ID || '').trim(),
    slackSigningSecret: (process.env.SLACK_SIGNING_SECRET || '').trim(),
    enableInteractions: (process.env.ENABLE_INTERACTIONS || '').toLowerCase().trim() === 'true',
    timezone: (process.env.TIMEZONE || 'UTC').trim(),
  };

  if (!config.slackBotToken || !config.slackChannelId || !config.slackSigningSecret) {
    throw new Error('Missing required Slack environment variables');
  }

  // Validate bot token format
  const cleanBotToken = config.slackBotToken.replace(/[\r\n\t\s]/g, '');
  if (!cleanBotToken.startsWith('xoxb-')) {
    throw new Error('Invalid Slack bot token format');
  }

  if (!config.enableInteractions) {
    throw new Error('ENABLE_INTERACTIONS must be set to true');
  }

  const { StorageService } = await import('../src/services/StorageService');
  const { SlackService } = await import('../src/services/SlackService');
  const { RotationService } = await import('../src/services/RotationService');
  const { getRotationPeriod } = await import('../src/utils/dateUtils');
  const path = await import('path');

  const usersFilePath = path.join(process.cwd(), 'src/config/users.json');
  const stateFilePath = path.join(process.cwd(), 'src/config/rotation-state.json');

  const storageService = new StorageService(usersFilePath, stateFilePath);
  const slackService = new SlackService(cleanBotToken, config.slackChannelId);
  const rotationService = new RotationService(storageService, config.timezone);

  return { config, slackService, rotationService, getRotationPeriod };
}

export default async (req: VercelRequest, res: VercelResponse) => {
  try {
    // Handle GET requests (for URL verification)
    if (req.method === 'GET') {
      res.status(200).json({ message: 'Slack bot endpoint is running' });
      return;
    }

    // Only handle POST requests
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const { config, slackService, rotationService, getRotationPeriod } = await initializeServices();
    
    // Get raw request body for signature verification
    let rawBody: string;
    if (typeof req.body === 'string') {
      rawBody = req.body;
    } else if (req.body && typeof req.body === 'object') {
      // If Vercel has already parsed it, reconstruct the raw body
      if (req.headers['content-type']?.includes('application/x-www-form-urlencoded')) {
        // Reconstruct form-encoded body
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(req.body)) {
          params.append(key, value as string);
        }
        rawBody = params.toString();
      } else {
        rawBody = JSON.stringify(req.body);
      }
    } else {
      rawBody = '';
    }
    
    // Verify Slack signature using raw body
    const signature = req.headers['x-slack-signature'] as string;
    const timestamp = req.headers['x-slack-request-timestamp'] as string;
    
    if (signature && timestamp) {
      // Clean the signing secret of any whitespace/newlines
      const cleanSigningSecret = config.slackSigningSecret.replace(/[\r\n\t\s]/g, '');
      
      const isValid = verifySlackSignature(rawBody, signature, timestamp, cleanSigningSecret);
      
      if (!isValid) {
        // Generate our own signature for debugging
        const time = Math.floor(new Date().getTime() / 1000);
        const sigBasestring = 'v0:' + timestamp + ':' + rawBody;
        const mySignature = 'v0=' + crypto.createHmac('sha256', cleanSigningSecret).update(sigBasestring, 'utf8').digest('hex');
        
        console.log(`[ERROR] Invalid signature - Time diff: ${Math.abs(time - parseInt(timestamp))}s`);
        
        res.status(401).json({ 
          error: 'Invalid signature',
          debug: {
            time_diff: Math.abs(time - parseInt(timestamp)),
            expected: mySignature,
            received: signature,
            basestring_preview: sigBasestring.substring(0, 100)
          }
        });
        return;
      }
    }

    // Parse the payload
    let payload;
    try {
      if (req.headers['content-type']?.includes('application/x-www-form-urlencoded')) {
        // For form-encoded requests, extract the payload parameter
        const bodyObj = typeof req.body === 'object' ? req.body : {};
        const payloadString = bodyObj.payload as string;
        
        if (payloadString) {
          payload = JSON.parse(payloadString);
        } else {
          throw new Error('No payload parameter found in form data');
        }
      } else {
        // For JSON requests
        payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      }
    } catch (e) {
      console.log(`[ERROR] Failed to parse payload:`, e);
      res.status(400).json({ error: 'Invalid payload format' });
      return;
    }

    // Handle URL verification
    if (payload.type === 'url_verification') {
      res.status(200).json({ challenge: payload.challenge });
      return;
    }

    // Handle interactive components (button clicks)
    if (payload.type === 'interactive_message' || payload.type === 'block_actions') {
      const action = payload.actions?.[0];
      const userId = payload.user?.id;

      if (!action || !userId) {
        res.status(400).json({ error: 'Invalid action payload' });
        return;
      }

      console.log(`Handling action: ${action.action_id} by user: ${userId}`);

      if (action.action_id === 'skip_rotation') {
        try {
          // Use KV storage for persistent skip rotation
          const { KVStorageService } = await import('../src/services/KVStorageService');
          const kvStorageService = new KVStorageService();
          
          // Advance to next user and persist in KV
          const newUser = await kvStorageService.advanceToNextUser();
          const state = await kvStorageService.loadRotationState();
          const currentDate = new Date();
          const periodInfo = getRotationPeriod(currentDate, state.config);

          // Update the original message
          const originalMessageTs = payload.message?.ts;
          if (originalMessageTs) {
            await slackService.updateMessage(originalMessageTs, newUser, periodInfo, state.config);
          }

          // Send confirmation
          await slackService.sendEphemeralMessage(
            userId,
            `✅ Rotation skipped! Next emcee is now <@${newUser.id}>.`
          );

          console.log(`Rotation skipped by ${userId}. New emcee: ${newUser.id} (persisted in KV)`);
          res.status(200).json({ text: 'Rotation updated and saved!' });
        } catch (error) {
          console.error('Error handling skip rotation:', error);
          
          try {
            await slackService.sendEphemeralMessage(
              userId,
              '❌ Sorry, there was an error skipping the rotation.'
            );
          } catch (ephemeralError) {
            console.error('Error sending ephemeral error message:', ephemeralError);
          }
          
          res.status(200).json({ text: 'Error occurred' });
        }
      } else if (action.action_id === 'show_schedule') {
        try {
          // Use KV storage to get current rotation state
          const { KVStorageService } = await import('../src/services/KVStorageService');
          const kvStorageService = new KVStorageService();
          const { getCurrentDateInTimezone, getRotationPeriod, getPeriodsBetween } = await import('../src/utils/dateUtils');
          
          // Get current rotation state from KV
          const state = await kvStorageService.loadRotationState();
          const currentDate = getCurrentDateInTimezone(config.timezone);
          
          // Generate schedule for next 6 periods
          const schedule: Array<{ user: any; periodInfo: any; periodNumber: number }> = [];
          for (let i = 0; i < 6; i++) {
            // Calculate target date for this period
            let targetDate = new Date(currentDate);
            if (state.config.frequency === 'weekly') {
              targetDate.setDate(targetDate.getDate() + (i * 7));
            } else if (state.config.frequency === 'bi-weekly') {
              targetDate.setDate(targetDate.getDate() + (i * 14));
            } else if (state.config.frequency === 'custom' && state.config.interval) {
              targetDate.setDate(targetDate.getDate() + (i * state.config.interval));
            }
            
            // Calculate which user should be active for this date
            const rotationStartDate = new Date(state.startDate);
            const periodsSinceStart = getPeriodsBetween(rotationStartDate, targetDate, state.config);
            const targetIndex = (state.currentIndex + periodsSinceStart) % state.users.length;
            const user = state.users[targetIndex];
            
            if (user) {
              const periodInfo = getRotationPeriod(targetDate, state.config);
              schedule.push({
                user,
                periodInfo,
                periodNumber: i + 1,
              });
            }
          }
          
          await slackService.sendScheduleMessage(userId, schedule);
          
          console.log(`Schedule sent to ${userId} (using KV data with ${state.users.length} users, current index: ${state.currentIndex})`);
          res.status(200).json({ text: 'Schedule sent!' });
        } catch (error) {
          console.error('Error showing schedule:', error);
          
          try {
            await slackService.sendEphemeralMessage(
              userId,
              '❌ Sorry, there was an error loading the schedule.'
            );
          } catch (ephemeralError) {
            console.error('Error sending ephemeral error message:', ephemeralError);
          }
          
          res.status(200).json({ text: 'Error occurred' });
        }
      } else {
        res.status(200).json({ text: 'Unknown action' });
      }
      return;
    }

    // Default response
    res.status(200).json({ message: 'OK' });

  } catch (error) {
    console.error('Error in Slack handler:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: (error as Error).message 
    });
  }
}; 