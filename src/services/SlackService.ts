import { WebClient } from '@slack/web-api';
import { User, NotificationResult, WeekInfo, PeriodInfo, RotationConfig } from '../types';
import { formatDateRange } from '../utils/dateUtils';

export class SlackService {
  private client: WebClient;
  private channelId: string;

  constructor(botToken: string, channelId: string) {
    this.client = new WebClient(botToken);
    this.channelId = channelId;
  }

  /**
   * Send rotation notification to Slack channel
   */
  async sendRotationNotification(user: User, periodInfo: PeriodInfo | WeekInfo, config?: RotationConfig): Promise<NotificationResult> {
    try {
      const message = this.formatRotationMessage(user, periodInfo, config);
      
      const result = await this.client.chat.postMessage({
        channel: this.channelId,
        blocks: message.blocks,
        text: message.fallbackText,
        unfurl_links: false,
        unfurl_media: false,
      });

      if (!result.ok) {
        throw new Error(`Slack API error: ${result.error || 'Unknown error'}`);
      }

      return {
        success: true,
        messageTs: result.ts,
      };
    } catch (error) {
      console.error('Failed to send Slack notification:', error);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Test connection to Slack
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const authResult = await this.client.auth.test();
      
      if (!authResult.ok) {
        throw new Error(`Authentication failed: ${authResult.error || 'Unknown error'}`);
      }

      // Note: Skipping channel validation to avoid requiring channels:read scope
      // The bot will attempt to post when actually sending messages

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Get user information from Slack
   */
  async getUserInfo(userId: string): Promise<{ name: string; realName?: string } | null> {
    try {
      const result = await this.client.users.info({
        user: userId,
      });

      if (!result.ok || !result.user) {
        return null;
      }

      return {
        name: result.user.name || 'Unknown User',
        realName: result.user.real_name,
      };
    } catch (error) {
      // If we don't have users:read scope, gracefully return null
      // The app will use the names stored in users.json instead
      console.log(`Note: Unable to fetch user info for ${userId} (users:read scope not available)`);
      return null;
    }
  }

  /**
   * Format the rotation message with rich Slack blocks
   */
  private formatRotationMessage(user: User, periodInfo: PeriodInfo | WeekInfo, config?: RotationConfig) {
    const dateRange = formatDateRange(periodInfo.startDate, periodInfo.endDate);
    
    // Dynamic messaging based on rotation frequency
    const periodType = this.getPeriodType(periodInfo, config);
    const ownerTitle = this.getOwnerTitle(config);
    const responsibilityPeriod = this.getResponsibilityPeriod(config);
    
    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🏆 Forum Owner Rotation',
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${periodType} ${dateRange}*`,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${ownerTitle}: <@${user.id}>`,
        },
      },
      {
        type: 'divider',
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Role responsibilities:*\n• Monitor forum discussions\n• Escalate important issues\n• Facilitate team communication\n• ${responsibilityPeriod} summary`,
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Questions? Reach out to ${this.getCurrentOwnerReference(config)}! 👋`,
          },
        ],
      },
    ];

    const fallbackText = `Forum Owner Rotation - ${periodType} ${dateRange}\n\n${ownerTitle}: ${user.name || user.id}\n\nRole responsibilities:\n• Monitor forum discussions\n• Escalate important issues\n• Facilitate team communication\n• ${responsibilityPeriod} summary\n\nQuestions? Reach out to ${this.getCurrentOwnerReference(config)}! 👋`;

    return {
      blocks,
      fallbackText,
    };
  }

  /**
   * Get period type description
   */
  private getPeriodType(periodInfo: PeriodInfo | WeekInfo, config?: RotationConfig): string {
    if (!config) return 'Week of';
    
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
   * Get owner title based on frequency
   */
  private getOwnerTitle(config?: RotationConfig): string {
    if (!config) return "This week's forum owner";
    
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

  /**
   * Get responsibility summary period
   */
  private getResponsibilityPeriod(config?: RotationConfig): string {
    if (!config) return 'Weekly';
    
    switch (config.frequency) {
      case 'daily':
        return 'End-of-day';
      case 'weekly':
        return 'Weekly';
      case 'bi-weekly':
        return 'Bi-weekly';
      case 'monthly':
        return 'Monthly';
      case 'custom':
        return 'Period-end';
      default:
        return 'Regular';
    }
  }

  /**
   * Get current owner reference
   */
  private getCurrentOwnerReference(config?: RotationConfig): string {
    if (!config) return "this week's owner";
    
    switch (config.frequency) {
      case 'daily':
        return "today's owner";
      case 'weekly':
        return "this week's owner";
      case 'bi-weekly':
        return "this period's owner";
      case 'monthly':
        return "this month's owner";
      case 'custom':
        return "the current owner";
      default:
        return "the current owner";
    }
  }

  /**
   * Send a simple text message (for testing or fallback)
   */
  async sendSimpleMessage(text: string): Promise<NotificationResult> {
    try {
      const result = await this.client.chat.postMessage({
        channel: this.channelId,
        text,
      });

      if (!result.ok) {
        throw new Error(`Slack API error: ${result.error || 'Unknown error'}`);
      }

      return {
        success: true,
        messageTs: result.ts,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }
} 