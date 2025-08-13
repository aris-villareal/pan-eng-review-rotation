import * as dotenv from 'dotenv';
import { AppConfig } from '../types';
import path from 'path';

// Load environment variables
dotenv.config();

export function getConfig(): AppConfig {
  const requiredVars = ['SLACK_BOT_TOKEN', 'SLACK_CHANNEL_ID'];
  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  return {
    slackBotToken: process.env.SLACK_BOT_TOKEN!,
    slackChannelId: process.env.SLACK_CHANNEL_ID!,
    slackSigningSecret: process.env.SLACK_SIGNING_SECRET,
    timezone: process.env.TIMEZONE || 'UTC',
    usersFilePath: path.join(__dirname, 'users.json'),
    stateFilePath: path.join(__dirname, 'rotation-state.json'),
    enableInteractions: process.env.ENABLE_INTERACTIONS === 'true',
    serverPort: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
  };
}

export function validateConfig(config: AppConfig): void {
  if (!config.slackBotToken.startsWith('xoxb-')) {
    throw new Error('Invalid Slack bot token format. Expected token starting with "xoxb-"');
  }
} 