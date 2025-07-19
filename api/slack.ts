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

  // Use correct paths for deployed files - they're in dist/config in Vercel
  const usersFilePath = path.join(process.cwd(), 'dist/config/users.json');
  const stateFilePath = path.join(process.cwd(), 'dist/config/rotation-state.json');

  console.log(`[DEBUG] Looking for users file at: ${usersFilePath}`);
  console.log(`[DEBUG] Looking for state file at: ${stateFilePath}`);

  const storageService = new StorageService(usersFilePath, stateFilePath);
  const slackService = new SlackService(cleanBotToken, config.slackChannelId);
  const rotationService = new RotationService(storageService, config.timezone);

  return { config, slackService, rotationService, getRotationPeriod };
}

export default async (req: VercelRequest, res: VercelResponse) => {
  try {
    console.log(`[DEBUG] Request method: ${req.method}`);
    console.log(`[DEBUG] Content-Type: ${req.headers['content-type']}`);

    // Handle GET requests (for URL verification)
    if (req.method === 'GET') {
      res.status(200).json({ message: 'Slack bot endpoint is running' });
      return;
    }

    // Only handle POST requests
    if (req.method !== 'POST') {
      console.log(`[DEBUG] Method not allowed: ${req.method}`);
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    console.log(`[DEBUG] Initializing services...`);
    const { config, slackService, rotationService, getRotationPeriod } = await initializeServices();
    console.log(`[DEBUG] Services initialized successfully`);
    
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
    
    console.log(`[DEBUG] Raw body length: ${rawBody.length}`);
    console.log(`[DEBUG] First 200 chars of raw body: ${rawBody.substring(0, 200)}`);
    
    // Verify Slack signature using raw body
    const signature = req.headers['x-slack-signature'] as string;
    const timestamp = req.headers['x-slack-request-timestamp'] as string;
    
    console.log(`[DEBUG] Signature: ${signature}`);
    console.log(`[DEBUG] Timestamp: ${timestamp}`);
    
    if (signature && timestamp) {
      // Clean the signing secret of any whitespace/newlines
      const cleanSigningSecret = config.slackSigningSecret.replace(/[\r\n\t\s]/g, '');
      console.log(`[DEBUG] Original signing secret length: ${config.slackSigningSecret.length}`);
      console.log(`[DEBUG] Cleaned signing secret length: ${cleanSigningSecret.length}`);
      
      const isValid = verifySlackSignature(rawBody, signature, timestamp, cleanSigningSecret);
      console.log(`[DEBUG] Signature verification result: ${isValid}`);
      
      if (!isValid) {
        // Generate our own signature for debugging
        const time = Math.floor(new Date().getTime() / 1000);
        const sigBasestring = 'v0:' + timestamp + ':' + rawBody;
        const mySignature = 'v0=' + crypto.createHmac('sha256', cleanSigningSecret).update(sigBasestring, 'utf8').digest('hex');
        
        console.log(`[DEBUG] Time difference: ${Math.abs(time - parseInt(timestamp))} seconds`);
        console.log(`[DEBUG] Sig basestring: ${sigBasestring.substring(0, 100)}...`);
        console.log(`[DEBUG] Expected signature: ${mySignature}`);
        console.log(`[DEBUG] Received signature: ${signature}`);
        
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
    } else {
      console.log(`[DEBUG] No signature or timestamp provided`);
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
          console.log(`[DEBUG] Parsed form-encoded payload type: ${payload.type}`);
        } else {
          throw new Error('No payload parameter found in form data');
        }
      } else {
        // For JSON requests
        payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        console.log(`[DEBUG] Parsed JSON payload type: ${payload.type}`);
      }
    } catch (e) {
      console.log(`[DEBUG] Failed to parse payload:`, e);
      res.status(400).json({ error: 'Invalid payload format' });
      return;
    }

    // Handle URL verification
    if (payload.type === 'url_verification') {
      console.log(`[DEBUG] URL verification challenge: ${payload.challenge}`);
      res.status(200).json({ challenge: payload.challenge });
      return;
    }

    // Handle interactive components (button clicks)
    if (payload.type === 'interactive_message' || payload.type === 'block_actions') {
      const action = payload.actions?.[0];
      const userId = payload.user?.id;

      console.log(`[DEBUG] Interactive payload received`);
      console.log(`[DEBUG] Action: ${action?.action_id}`);
      console.log(`[DEBUG] User ID: ${userId}`);

      if (!action || !userId) {
        console.log(`[DEBUG] Invalid action payload - missing action or userId`);
        res.status(400).json({ error: 'Invalid action payload' });
        return;
      }

      console.log(`Handling action: ${action.action_id} by user: ${userId}`);

      if (action.action_id === 'skip_rotation') {
        try {
          console.log(`[DEBUG] Processing skip_rotation...`);
          
          // Advance to next user
          const newUser = await rotationService.advanceToNextUser();
          const state = await rotationService.getStorageService().loadRotationState();
          const currentDate = new Date();
          const periodInfo = getRotationPeriod(currentDate, state.config);

          console.log(`[DEBUG] New user: ${newUser.id}`);

          // Update the original message
          const originalMessageTs = payload.message?.ts;
          if (originalMessageTs) {
            console.log(`[DEBUG] Updating message: ${originalMessageTs}`);
            await slackService.updateMessage(originalMessageTs, newUser, periodInfo, state.config);
          }

          // Send confirmation
          console.log(`[DEBUG] Sending ephemeral message to ${userId}`);
          await slackService.sendEphemeralMessage(
            userId,
            `✅ Rotation skipped! Next emcee is now <@${newUser.id}>.`
          );

          console.log(`Rotation skipped by ${userId}. New emcee: ${newUser.id}`);
          res.status(200).json({ text: 'Rotation updated!' });
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
          console.log(`[DEBUG] Processing show_schedule...`);
          
          const schedule = await rotationService.getUpcomingRotation(6);
          await slackService.sendScheduleMessage(userId, schedule);
          
          console.log(`Schedule sent to ${userId}`);
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
        console.log(`[DEBUG] Unknown action: ${action.action_id}`);
        res.status(200).json({ text: 'Unknown action' });
      }
      return;
    }

    // Default response
    console.log(`[DEBUG] Default response for payload type: ${payload.type}`);
    res.status(200).json({ message: 'OK' });

  } catch (error) {
    console.error('Error in Slack handler:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: (error as Error).message 
    });
  }
}; 