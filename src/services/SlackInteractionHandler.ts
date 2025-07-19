import { App } from '@slack/bolt';
import { SlackService } from './SlackService';
import { RotationService } from './RotationService';
import { getRotationPeriod } from '../utils/dateUtils';

export class SlackInteractionHandler {
  private app: App;
  private slackService: SlackService;
  private rotationService: RotationService;

  constructor(
    signingSecret: string,
    botToken: string,
    slackService: SlackService,
    rotationService: RotationService
  ) {
    this.app = new App({
      signingSecret,
      token: botToken,
      processBeforeResponse: true,
    });

    this.slackService = slackService;
    this.rotationService = rotationService;
    
    this.setupHandlers();
  }

  /**
   * Setup all Slack interaction handlers
   */
  private setupHandlers(): void {
    // Handle skip rotation button
    this.app.action('skip_rotation', async ({ ack, body, client, logger }) => {
      await ack();

      try {
        const userId = body.user.id;
        const originalMessageTs = (body as any).message?.ts;

        // Advance to next user
        const newUser = await this.rotationService.advanceToNextUser();
        const state = await this.rotationService.getStorageService().loadRotationState();
        const currentDate = new Date();
        const periodInfo = getRotationPeriod(currentDate, state.config);

        // Update the original message with new rotation info
        if (originalMessageTs) {
          await this.slackService.updateMessage(originalMessageTs, newUser, periodInfo, state.config);
        }

        // Send confirmation to the user who clicked
        await this.slackService.sendEphemeralMessage(
          userId,
          `✅ Rotation skipped! Next emcee is now <@${newUser.id}>.`
        );

        logger.info(`Rotation skipped by user ${userId}. New emcee: ${newUser.id}`);
      } catch (error) {
        logger.error('Error handling skip rotation:', error);
        
        // Send error message to user
        await this.slackService.sendEphemeralMessage(
          body.user.id,
          '❌ Sorry, there was an error skipping the rotation. Please try again or contact an admin.'
        );
      }
    });

    // Handle show schedule button
    this.app.action('show_schedule', async ({ ack, body, logger }) => {
      await ack();

      try {
        const userId = body.user.id;
        
        // Get upcoming rotation schedule
        const schedule = await this.rotationService.getUpcomingRotation(6);
        
        // Send schedule as ephemeral message
        await this.slackService.sendScheduleMessage(userId, schedule);

        logger.info(`Schedule requested by user ${userId}`);
      } catch (error) {
        logger.error('Error showing schedule:', error);
        
        // Send error message to user
        await this.slackService.sendEphemeralMessage(
          body.user.id,
          '❌ Sorry, there was an error loading the schedule. Please try again or contact an admin.'
        );
      }
    });

    // Handle slash commands (optional)
    this.app.command('/skip-rotation', async ({ ack, body, client, logger }) => {
      await ack();

      try {
        const userId = body.user_id;
        
        // Advance to next user
        const newUser = await this.rotationService.advanceToNextUser();
        const state = await this.rotationService.getStorageService().loadRotationState();
        const currentDate = new Date();
        const periodInfo = getRotationPeriod(currentDate, state.config);

        // Send new rotation notification
        await this.slackService.sendRotationNotification(newUser, periodInfo, state.config);

        // Send confirmation to the user who used the command
        await this.slackService.sendEphemeralMessage(
          userId,
          `✅ Rotation skipped! Next emcee is now <@${newUser.id}>.`
        );

        logger.info(`Rotation skipped via slash command by user ${userId}. New emcee: ${newUser.id}`);
      } catch (error) {
        logger.error('Error handling skip rotation slash command:', error);
        
        // Send error response
        await this.slackService.sendEphemeralMessage(
          body.user_id,
          '❌ Sorry, there was an error skipping the rotation. Please try again or contact an admin.'
        );
      }
    });

    this.app.command('/rotation-schedule', async ({ ack, body, logger }) => {
      await ack();

      try {
        const userId = body.user_id;
        
        // Get upcoming rotation schedule
        const schedule = await this.rotationService.getUpcomingRotation(6);
        
        // Send schedule as ephemeral message
        await this.slackService.sendScheduleMessage(userId, schedule);

        logger.info(`Schedule requested via slash command by user ${userId}`);
      } catch (error) {
        logger.error('Error showing schedule via slash command:', error);
        
        // Send error response
        await this.slackService.sendEphemeralMessage(
          body.user_id,
          '❌ Sorry, there was an error loading the schedule. Please try again or contact an admin.'
        );
      }
    });
  }

  /**
   * Start the Bolt app server
   */
  async start(port: number = 3000): Promise<void> {
    await this.app.start(port);
    console.log(`⚡️ Slack app is listening on port ${port}!`);
  }

  /**
   * Stop the Bolt app server
   */
  async stop(): Promise<void> {
    await this.app.stop();
    console.log('🛑 Slack app stopped');
  }

  /**
   * Get the Express receiver for integration with existing servers
   */
  getReceiver(): any {
    return (this.app as any).receiver;
  }
} 