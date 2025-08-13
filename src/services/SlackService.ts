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
   * Send rotation notification to Slack channel for staff documentation rotation
   */
  async sendRotationNotification(user: User, periodInfo: PeriodInfo | WeekInfo, config?: RotationConfig): Promise<NotificationResult> {
    try {
      const message = this.formatStaffDocRotationMessage(user, periodInfo, config);
      
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
   * Format the staff documentation rotation message with rich Slack blocks
   */
  private formatStaffDocRotationMessage(user: User, periodInfo: PeriodInfo | WeekInfo, config?: RotationConfig) {
    const dateRange = formatDateRange(periodInfo.startDate, periodInfo.endDate);
    
    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '📄 Staff Documentation Rotation',
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Week of ${dateRange}*\n\nThis week's article presenter: <@${user.id}>`,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Reminder for Wednesday's staff meeting:*\n• Please prepare an interesting article to share\n• 5-10 minute presentation/discussion\n• Focus on industry trends, best practices, or innovation\n• Share the article link in advance if possible`,
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '⏭️ Skip to Next',
              emoji: true,
            },
            style: 'primary',
            action_id: 'skip_rotation',
            value: JSON.stringify({
              action: 'skip',
              currentUserId: user.id,
              timestamp: Date.now(),
            }),
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '📅 Show Schedule',
              emoji: true,
            },
            action_id: 'show_schedule',
            value: JSON.stringify({
              action: 'show_schedule',
              timestamp: Date.now(),
            }),
          },
        ],
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: 'Questions? Reach out to this week\'s presenter! 📚',
          },
        ],
      },
    ];

    const fallbackText = `📄 Staff Documentation Rotation\nWeek of ${dateRange}\n\nThis week's article presenter: ${user.name || user.id}\n\nReminder for Wednesday's staff meeting:\n• Please prepare an interesting article to share\n• 5-10 minute presentation/discussion\n• Focus on industry trends, best practices, or innovation\n• Share the article link in advance if possible\n\nQuestions? Reach out to this week's presenter! 📚`;

    return {
      blocks,
      fallbackText,
    };
  }

  /**
   * Format the original rotation message (kept for backward compatibility)
   */
  private formatRotationMessage(user: User, periodInfo: PeriodInfo | WeekInfo, config?: RotationConfig) {
    const dateRange = formatDateRange(periodInfo.startDate, periodInfo.endDate);
    
    // Dynamic messaging based on rotation frequency
    const periodType = this.getPeriodType(periodInfo, config);
    const responsibilityPeriod = this.getResponsibilityPeriod(config);
    
    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🍳 PAN Engineering Forum',
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `Next Emcee: <@${user.id}>`,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'https://postmanlabs.atlassian.net/wiki/spaces/PN/pages/5326733521/Engineering+Review+Session',
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '⏭️ Skip to Next Person',
              emoji: true,
            },
            style: 'primary',
            action_id: 'skip_rotation',
            value: JSON.stringify({
              action: 'skip',
              currentUserId: user.id,
              timestamp: Date.now(),
            }),
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '📅 Show Schedule',
              emoji: true,
            },
            action_id: 'show_schedule',
            value: JSON.stringify({
              action: 'show_schedule',
              timestamp: Date.now(),
            }),
          },
        ],
      },
    ];

    const fallbackText = `PAN Engineering Forum Next Emcee: ${user.name || user.id}\nhttps://postmanlabs.atlassian.net/wiki/spaces/PN/pages/5326733521/Engineering+Review+Session`;

    return {
      blocks,
      fallbackText,
    };
  }

  /**
   * Format upcoming schedule message
   */
  async formatScheduleMessage(schedule: Array<{ user: User; periodInfo: PeriodInfo; periodNumber: number }>): Promise<{ blocks: any[]; fallbackText: string }> {
    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '📅 Upcoming Article Presentation Schedule',
          emoji: true,
        },
      },
    ];

    // Add schedule items
    for (const item of schedule) {
      const dateRange = formatDateRange(item.periodInfo.startDate, item.periodInfo.endDate);
      const userInfo = await this.getUserInfo(item.user.id);
      const displayName = userInfo?.name || item.user.name || item.user.id;
      
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Week ${item.periodNumber}* (${dateRange})\n<@${item.user.id}> (${displayName}) - Article presenter`,
        },
      } as any);
    }

    const fallbackText = schedule
      .map(item => {
        const dateRange = formatDateRange(item.periodInfo.startDate, item.periodInfo.endDate);
        return `Week ${item.periodNumber} (${dateRange}): ${item.user.name || item.user.id} - Article presenter`;
      })
      .join('\n');

    return {
      blocks,
      fallbackText: `Upcoming Article Presentation Schedule:\n${fallbackText}`,
    };
  }

  /**
   * Send schedule as ephemeral message (only visible to the user who clicked)
   */
  async sendScheduleMessage(userId: string, schedule: Array<{ user: User; periodInfo: PeriodInfo; periodNumber: number }>): Promise<void> {
    const { blocks, fallbackText } = await this.formatScheduleMessage(schedule);
    
    await this.client.chat.postEphemeral({
      channel: this.channelId,
      user: userId,
      blocks,
      text: fallbackText,
    });
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
    if (!config) return "this week's presenter";
    
    switch (config.frequency) {
      case 'daily':
        return "today's presenter";
      case 'weekly':
        return "this week's presenter";
      case 'bi-weekly':
        return "this period's presenter";
      case 'monthly':
        return "this month's presenter";
      case 'custom':
        return "the current presenter";
      default:
        return "the current presenter";
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

  /**
   * Update an existing message with new content
   */
  async updateMessage(messageTs: string, user: User, periodInfo: PeriodInfo | WeekInfo, config?: RotationConfig): Promise<NotificationResult> {
    try {
      const message = this.formatStaffDocRotationMessage(user, periodInfo, config);
      
      const result = await this.client.chat.update({
        channel: this.channelId,
        ts: messageTs,
        blocks: message.blocks,
        text: message.fallbackText,
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

  /**
   * Send an ephemeral message (only visible to the user who clicked)
   */
  async sendEphemeralMessage(userId: string, text: string): Promise<NotificationResult> {
    try {
      const result = await this.client.chat.postEphemeral({
        channel: this.channelId,
        user: userId,
        text,
      });

      if (!result.ok) {
        throw new Error(`Slack API error: ${result.error || 'Unknown error'}`);
      }

      return {
        success: true,
        messageTs: result.message_ts,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Send a public message with blocks formatting to the channel
   */
  async sendPublicMessage(text: string, blocks?: any[]): Promise<NotificationResult> {
    try {
      const result = await this.client.chat.postMessage({
        channel: this.channelId,
        text,
        blocks,
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
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }
}