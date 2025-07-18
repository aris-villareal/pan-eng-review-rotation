#!/usr/bin/env node

import { getConfig, validateConfig } from './config';
import { StorageService } from './services/StorageService';
import { SlackService } from './services/SlackService';
import { RotationService } from './services/RotationService';
import { getISOWeek } from './utils/dateUtils';

interface AppOptions {
  dryRun?: boolean;
  test?: boolean;
  preview?: number;
  stats?: boolean;
}

class RotationNotifierApp {
  private config = getConfig();
  private storageService: StorageService;
  private slackService: SlackService;
  private rotationService: RotationService;

  constructor() {
    validateConfig(this.config);
    
    this.storageService = new StorageService(
      this.config.usersFilePath,
      this.config.stateFilePath
    );
    
    this.slackService = new SlackService(
      this.config.slackBotToken,
      this.config.slackChannelId
    );
    
    this.rotationService = new RotationService(
      this.storageService,
      this.config.timezone
    );
  }

  /**
   * Main entry point - send weekly rotation notification
   */
  async run(options: AppOptions = {}): Promise<void> {
    try {
      console.log('🚀 Starting Slack rotation notifier...');
      
      // Validate rotation configuration
      await this.validateSetup();
      
      if (options.test) {
        await this.testConnection();
        return;
      }
      
      if (options.stats) {
        await this.showStats();
        return;
      }
      
      if (options.preview) {
        await this.showPreview(options.preview);
        return;
      }
      
      // Get current forum owner
      const currentUser = await this.rotationService.getCurrentForumOwner();
      const currentDate = new Date();
      const weekInfo = getISOWeek(currentDate);
      
      console.log(`📅 Current week: ${weekInfo.weekNumber} (${weekInfo.year})`);
      console.log(`👤 Forum owner: ${currentUser.name} (${currentUser.id})`);
      
      if (options.dryRun) {
        console.log('🔍 Dry run mode - no message will be sent');
        console.log('Message preview:');
        console.log(`Forum Owner Rotation - Week of ${weekInfo.startDate.toLocaleDateString()} - ${weekInfo.endDate.toLocaleDateString()}`);
        console.log(`This week's forum owner: ${currentUser.name}`);
        return;
      }
      
      // Send notification
      console.log('📤 Sending Slack notification...');
      const result = await this.slackService.sendRotationNotification(currentUser, weekInfo);
      
      if (result.success) {
        console.log('✅ Notification sent successfully!');
        if (result.messageTs) {
          console.log(`Message timestamp: ${result.messageTs}`);
        }
      } else {
        console.error('❌ Failed to send notification:', result.error);
        process.exit(1);
      }
      
    } catch (error) {
      console.error('💥 Application error:', (error as Error).message);
      process.exit(1);
    }
  }

  /**
   * Validate rotation setup and Slack connection
   */
  private async validateSetup(): Promise<void> {
    console.log('🔍 Validating setup...');
    
    // Validate rotation configuration
    const rotationValidation = await this.rotationService.validateRotation();
    if (!rotationValidation.valid) {
      throw new Error(`Rotation validation failed:\n${rotationValidation.errors.join('\n')}`);
    }
    
    // Test Slack connection
    const slackTest = await this.slackService.testConnection();
    if (!slackTest.success) {
      throw new Error(`Slack connection failed: ${slackTest.error}`);
    }
    
    console.log('✅ Setup validation complete');
  }

  /**
   * Test Slack connection and send a test message
   */
  private async testConnection(): Promise<void> {
    console.log('🧪 Testing Slack connection...');
    
    const connectionResult = await this.slackService.testConnection();
    if (!connectionResult.success) {
      throw new Error(`Connection test failed: ${connectionResult.error}`);
    }
    
    console.log('✅ Slack connection successful');
    
    // Send test message
    const testResult = await this.slackService.sendSimpleMessage(
      '🧪 Test message from Forum Rotation Notifier - connection working!'
    );
    
    if (testResult.success) {
      console.log('✅ Test message sent successfully');
    } else {
      throw new Error(`Test message failed: ${testResult.error}`);
    }
  }

  /**
   * Show rotation statistics
   */
  private async showStats(): Promise<void> {
    console.log('📊 Rotation Statistics:');
    
    const stats = await this.rotationService.getRotationStats();
    const currentUser = await this.rotationService.getCurrentForumOwner();
    
    console.log(`Total users: ${stats.totalUsers}`);
    console.log(`Current user: ${currentUser.name} (index ${stats.currentUserIndex})`);
    console.log(`Weeks since start: ${stats.weeksSinceStart}`);
    console.log(`Full rotations completed: ${stats.rotationsCompleted}`);
    console.log(`Last rotation: ${new Date(stats.lastRotationDate).toLocaleDateString()}`);
  }

  /**
   * Show upcoming rotation preview
   */
  private async showPreview(weeks: number): Promise<void> {
    console.log(`📅 Upcoming ${weeks} week rotation preview:`);
    
    const schedule = await this.rotationService.getUpcomingRotation(weeks);
    
    schedule.forEach(({ user, weekInfo, weekNumber }) => {
      const dateRange = `${weekInfo.startDate.toLocaleDateString()} - ${weekInfo.endDate.toLocaleDateString()}`;
      console.log(`Week ${weekNumber}: ${user.name} (${dateRange})`);
    });
  }
}

/**
 * CLI interface
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const options: AppOptions = {};
  
  // Parse command line arguments
  for (const arg of args) {
    switch (arg) {
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--test':
        options.test = true;
        break;
      case '--stats':
        options.stats = true;
        break;
      default:
        if (arg.startsWith('--preview=')) {
          const weeks = parseInt(arg.split('=')[1] || '4', 10);
          options.preview = isNaN(weeks) ? 4 : weeks;
        }
    }
  }
  
  const app = new RotationNotifierApp();
  await app.run(options);
}

// Only run if this file is executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error.message);
    process.exit(1);
  });
}

export { RotationNotifierApp }; 