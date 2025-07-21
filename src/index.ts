#!/usr/bin/env node

import { getConfig, validateConfig } from './config';
import { StorageService } from './services/StorageService';
import { SlackService } from './services/SlackService';
import { RotationService } from './services/RotationService';
import { SlackInteractionHandler } from './services/SlackInteractionHandler';
import { getISOWeek, getRotationPeriod } from './utils/dateUtils';
import { RotationState } from './types';

interface AppOptions {
  dryRun?: boolean;
  test?: boolean;
  preview?: number;
  stats?: boolean;
  server?: boolean;
  useKV?: boolean;
}

/**
 * Service that can read rotation state from KV via API
 */
class KVRemoteStorageService {
  private apiUrl: string;
  
  constructor(apiUrl: string) {
    this.apiUrl = apiUrl;
  }
  
  async loadRotationState(): Promise<RotationState> {
    try {
  
      
      // Use built-in fetch or node-fetch fallback
      let fetchFn: any = globalThis.fetch;
      if (!fetchFn) {
        const nodeFetch = await import('node-fetch');
        fetchFn = nodeFetch.default;
      }
      
      const response = await fetchFn(this.apiUrl);
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();
      if (!result.success || !result.data) {
        throw new Error(`API response invalid: ${result.message || 'Unknown error'}`);
      }
      
  
      return result.data;
    } catch (error) {
      throw new Error(`Failed to load rotation state from KV API: ${(error as Error).message}`);
    }
  }
  
  // Implement other required methods as no-ops since GitHub Action only reads
  async saveRotationState(): Promise<void> {
    throw new Error('GitHub Action should not save state - use KV API instead');
  }
  
  async updateRotationState(): Promise<void> {
    throw new Error('GitHub Action should not update state - use Slack buttons instead');
  }
  
  async getCurrentUser(): Promise<any> {
    const state = await this.loadRotationState();
    return state.users[state.currentIndex];
  }
  
  async addUser(): Promise<void> {
    throw new Error('GitHub Action should not modify users');
  }
  
  async removeUser(): Promise<void> {
    throw new Error('GitHub Action should not modify users');
  }
}

class RotationNotifierApp {
  private config = getConfig();
  private storageService: StorageService | KVRemoteStorageService;
  private slackService: SlackService;
  private rotationService: RotationService;
  private interactionHandler?: SlackInteractionHandler;

  constructor(useKV: boolean = false) {
    validateConfig(this.config);
    
    if (useKV) {
      // Use KV storage via API endpoint
              const kvApiUrl = process.env.KV_API_URL || 'https://pan-eng-review-rotation-nqrqbz941-aris-villareals-projects.vercel.app/api/rotation-state';

      this.storageService = new KVRemoteStorageService(kvApiUrl);
    } else {
      // Use local file storage

      this.storageService = new StorageService(
        this.config.usersFilePath,
        this.config.stateFilePath
      );
    }
    
    this.slackService = new SlackService(
      this.config.slackBotToken,
      this.config.slackChannelId
    );
    
    this.rotationService = new RotationService(
      this.storageService as any,
      this.config.timezone
    );

    // Initialize interaction handler if signing secret is provided
    if (this.config.slackSigningSecret && this.config.enableInteractions) {
      this.interactionHandler = new SlackInteractionHandler(
        this.config.slackSigningSecret,
        this.config.slackBotToken,
        this.slackService,
        this.rotationService
      );
    }
  }

  /**
   * Main entry point - send weekly rotation notification
   */
  async run(options: AppOptions = {}): Promise<void> {
    // Handle server mode first
    if (options.server) {
      return this.startServer();
    }

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
      
      // Get current forum owner and rotation state
      // Use read-only method for KV to avoid auto-advancement in GitHub Actions
      const currentUser = this.storageService instanceof KVRemoteStorageService 
        ? await this.rotationService.getCurrentForumOwnerReadOnly()
        : await this.rotationService.getCurrentForumOwner();
      const rotationState = await this.storageService.loadRotationState();
      const currentDate = new Date();
      const periodInfo = getRotationPeriod(currentDate, rotationState.config);
      
      console.log(`📅 Current ${rotationState.config.frequency} period: ${periodInfo.periodNumber} (${periodInfo.year})`);
      console.log(`👤 Forum owner: ${currentUser.name || currentUser.id} (${currentUser.id})`);
      
      if (options.dryRun) {
        console.log('🔍 Dry run mode - no message will be sent');
        console.log('Message preview:');
        console.log(`Forum Owner Rotation - ${this.getPeriodDescription(rotationState.config)} ${periodInfo.startDate.toLocaleDateString()} - ${periodInfo.endDate.toLocaleDateString()}`);
        console.log(`${this.getOwnerDescription(rotationState.config)}: ${currentUser.name || currentUser.id}`);
        return;
      }
      
      // Send notification
      console.log('📤 Sending Slack notification...');
      const result = await this.slackService.sendRotationNotification(currentUser, periodInfo, rotationState.config);
      
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
    const currentUser = this.storageService instanceof KVRemoteStorageService 
      ? await this.rotationService.getCurrentForumOwnerReadOnly()
      : await this.rotationService.getCurrentForumOwner();
    
    console.log(`Total users: ${stats.totalUsers}`);
    console.log(`Current user: ${currentUser.name || currentUser.id} (index ${stats.currentUserIndex})`);
    console.log(`Periods since start: ${stats.periodsSinceStart}`);
    console.log(`Rotation frequency: ${stats.rotationFrequency}`);
    console.log(`Full rotations completed: ${stats.rotationsCompleted}`);
    console.log(`Last rotation: ${new Date(stats.lastRotationDate).toLocaleDateString()}`);
  }

  /**
   * Show upcoming rotation preview
   */
  private async showPreview(periods: number): Promise<void> {
    console.log(`📅 Upcoming ${periods} rotation period preview:`);
    
    const schedule = await this.rotationService.getUpcomingRotation(periods);
    
    schedule.forEach(({ user, periodInfo, periodNumber }) => {
      const dateRange = `${periodInfo.startDate.toLocaleDateString()} - ${periodInfo.endDate.toLocaleDateString()}`;
      console.log(`Period ${periodNumber}: ${user.name || user.id} (${dateRange})`);
    });
  }

  /**
   * Get period description for console output
   */
  private getPeriodDescription(config: any): string {
    switch (config.frequency) {
      case 'daily':
        return 'Day of';
      case 'weekly':
        return 'Week of';
      case 'bi-weekly':
        return 'Bi-week of';
      case 'monthly':
        return 'Month of';
      case 'custom':
        return `${config.interval}-day period of`;
      default:
        return 'Period of';
    }
  }

  /**
   * Start the interactive server
   */
  private async startServer(): Promise<void> {
    if (!this.interactionHandler) {
      throw new Error('Interactive features not configured. Please set SLACK_SIGNING_SECRET and ENABLE_INTERACTIONS=true');
    }

    console.log('🚀 Starting Slack interaction server...');
    console.log(`📡 Server will listen on port ${this.config.serverPort}`);
    console.log('💡 Use Ctrl+C to stop the server');
    
    await this.interactionHandler.start(this.config.serverPort);
    
    // Keep the process running
    process.on('SIGINT', async () => {
      console.log('\n🛑 Gracefully shutting down...');
      if (this.interactionHandler) {
        await this.interactionHandler.stop();
      }
      process.exit(0);
    });
  }

  /**
   * Get owner description for console output
   */
  private getOwnerDescription(config: any): string {
    switch (config.frequency) {
      case 'daily':
        return "Today's forum owner";
      case 'weekly':
        return "This week's forum owner";
      case 'bi-weekly':
        return "This bi-week's forum owner";
      case 'monthly':
        return "This month's forum owner";
      case 'custom':
        return "This period's forum owner";
      default:
        return "Current forum owner";
    }
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
      case '--server':
        options.server = true;
        break;
      case '--use-kv':
        options.useKV = true;
        break;
      default:
        if (arg.startsWith('--preview=')) {
          const weeks = parseInt(arg.split('=')[1] || '4', 10);
          options.preview = isNaN(weeks) ? 4 : weeks;
        } else if (arg === '--help' || arg === '-h') {
          console.log(`
Usage: npm start [options]

Options:
  --dry-run       Run without sending Slack messages
  --test          Test Slack connection only
  --stats         Show rotation statistics
  --server        Start interactive server for button handling
  --use-kv        Use KV storage (read from deployed API)
  --preview=N     Preview next N periods (default: 4)
  --help, -h      Show this help message

Examples:
  npm start                    # Normal rotation notification
  npm start -- --dry-run      # Test run without sending messages
  npm start -- --test         # Test Slack connection
  npm start -- --server       # Start interactive server
  npm start -- --preview=6    # Preview next 6 periods
`);
          process.exit(0);
        }
    }
  }
  
  const app = new RotationNotifierApp(options.useKV);
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