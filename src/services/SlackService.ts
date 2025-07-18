import { WebClient } from '@slack/web-api';
import { User, NotificationResult, WeekInfo } from '../types';
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
  async sendRotationNotification(user: User, weekInfo: WeekInfo): Promise<NotificationResult> {
    try {
      const message = this.formatRotationMessage(user, weekInfo);
      
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

      // Test if bot can post to the channel
      const channelInfo = await this.client.conversations.info({
        channel: this.channelId,
      });

      if (!channelInfo.ok) {
        throw new Error(`Channel access failed: ${channelInfo.error || 'Unknown error'}`);
      }

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
      console.error(`Failed to get user info for ${userId}:`, error);
      return null;
    }
  }

  /**
   * Format the rotation message with rich Slack blocks
   */
  private formatRotationMessage(user: User, weekInfo: WeekInfo) {
    const dateRange = formatDateRange(weekInfo.startDate, weekInfo.endDate);
    
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
          text: `*Week of ${dateRange}*`,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `This week's forum owner: <@${user.id}>`,
        },
      },
      {
        type: 'divider',
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Role responsibilities:*\n• Monitor forum discussions\n• Escalate important issues\n• Facilitate team communication\n• Weekly summary on Friday',
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: 'Questions? Reach out to this week\'s owner! 👋',
          },
        ],
      },
    ];

    const fallbackText = `Forum Owner Rotation - Week of ${dateRange}\n\nThis week's forum owner: ${user.name}\n\nRole responsibilities:\n• Monitor forum discussions\n• Escalate important issues\n• Facilitate team communication\n• Weekly summary on Friday\n\nQuestions? Reach out to this week's owner! 👋`;

    return {
      blocks,
      fallbackText,
    };
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