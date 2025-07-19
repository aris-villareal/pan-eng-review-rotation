export interface User {
  id: string; // Slack user ID
  name?: string; // Optional display name (Slack will resolve automatically)
  startDate: string; // ISO date string when user joined rotation
}

export interface RotationConfig {
  frequency: 'daily' | 'weekly' | 'bi-weekly' | 'monthly' | 'custom';
  interval?: number; // For custom frequency (days)
  schedule?: {
    dayOfWeek?: number; // 0=Sunday, 1=Monday, etc. (for weekly/bi-weekly)
    dayOfMonth?: number; // 1-31 (for monthly)
    time?: string; // HH:MM format (for GitHub Actions)
  };
}

export interface RotationState {
  users: User[];
  currentIndex: number;
  lastRotationDate: string; // ISO date string
  startDate: string; // ISO date string when rotation began
  config: RotationConfig;
}

export interface AppConfig {
  slackBotToken: string;
  slackChannelId: string;
  slackSigningSecret?: string;
  timezone: string;
  usersFilePath: string;
  stateFilePath: string;
  enableInteractions?: boolean;
  serverPort?: number;
}

export interface PeriodInfo {
  periodNumber: number;
  startDate: Date;
  endDate: Date;
  year: number;
  type: 'day' | 'week' | 'month' | 'custom';
}

// Backwards compatibility
export interface WeekInfo extends PeriodInfo {
  weekNumber: number;
}

export interface NotificationResult {
  success: boolean;
  messageTs?: string;
  error?: string;
} 