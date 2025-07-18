export interface User {
  id: string; // Slack user ID
  name: string; // Display name
  startDate: string; // ISO date string when user joined rotation
}

export interface RotationState {
  users: User[];
  currentIndex: number;
  lastRotationDate: string; // ISO date string
  startDate: string; // ISO date string when rotation began
}

export interface AppConfig {
  slackBotToken: string;
  slackChannelId: string;
  timezone: string;
  usersFilePath: string;
  stateFilePath: string;
}

export interface WeekInfo {
  weekNumber: number;
  startDate: Date;
  endDate: Date;
  year: number;
}

export interface NotificationResult {
  success: boolean;
  messageTs?: string;
  error?: string;
} 