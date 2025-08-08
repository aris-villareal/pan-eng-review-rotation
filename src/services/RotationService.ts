import { User, RotationState, PeriodInfo } from '../types';
import { StorageService } from './StorageService';
import { getISOWeek, getWeeksBetween, getCurrentDateInTimezone, isNewWeek, getRotationPeriod, getPeriodsBetween, isNewRotationPeriod } from '../utils/dateUtils';

export class RotationService {
  private storageService: StorageService;
  private timezone: string;

  constructor(storageService: StorageService, timezone: string = 'UTC') {
    this.storageService = storageService;
    this.timezone = timezone;
  }

  /**
   * Get the storage service instance
   */
  getStorageService(): StorageService {
    return this.storageService;
  }

  /**
   * Get the current forum owner based on rotation logic
   */
  async getCurrentForumOwner(): Promise<User> {
    const state = await this.storageService.loadRotationState();
    const currentDate = getCurrentDateInTimezone(this.timezone);
    
    // Check if we need to advance the rotation
    if (this.shouldAdvanceRotation(state, currentDate)) {
      await this.advanceRotation(state, currentDate);
      // Reload state after advancement
      const updatedState = await this.storageService.loadRotationState();
      return this.getUserAtIndex(updatedState, updatedState.currentIndex);
    }
    
    return this.getUserAtIndex(state, state.currentIndex);
  }

  /**
   * Get the current forum owner without advancing rotation (read-only)
   * Used by GitHub Actions and other read-only contexts
   */
  async getCurrentForumOwnerReadOnly(): Promise<User> {
    const state = await this.storageService.loadRotationState();
    return this.getUserAtIndex(state, state.currentIndex);
  }

  /**
   * Preview who will be the forum owner for a specific date
   */
  async previewForumOwner(targetDate: Date): Promise<User> {
    const state = await this.storageService.loadRotationState();
    const rotationStartDate = new Date(state.startDate);
    const periodsSinceStart = getPeriodsBetween(rotationStartDate, targetDate, state.config);
    const targetIndex = periodsSinceStart % state.users.length;
    
    return this.getUserAtIndex(state, targetIndex);
  }

  /**
   * Get rotation schedule for the next N periods
   */
  async getUpcomingRotation(periodsAhead: number = 4): Promise<Array<{ user: User; periodInfo: PeriodInfo; periodNumber: number }>> {
    const state = await this.storageService.loadRotationState();
    const currentDate = getCurrentDateInTimezone(this.timezone);
    const schedule = [];

    for (let i = 0; i < periodsAhead; i++) {
      const targetDate = this.getNextPeriodDate(currentDate, state.config, i);
      
      const user = await this.previewForumOwner(targetDate);
      const periodInfo = getRotationPeriod(targetDate, state.config);
      
      schedule.push({
        user,
        periodInfo,
        periodNumber: i + 1,
      });
    }

    return schedule;
  }

  /**
   * Calculate the date for the next rotation period
   */
  private getNextPeriodDate(currentDate: Date, config: any, periodsAhead: number): Date {
    const targetDate = new Date(currentDate);
    
    switch (config.frequency) {
      case 'daily':
        targetDate.setDate(currentDate.getDate() + periodsAhead);
        break;
      case 'weekly':
        targetDate.setDate(currentDate.getDate() + (periodsAhead * 7));
        break;
      case 'bi-weekly':
        targetDate.setDate(currentDate.getDate() + (periodsAhead * 14));
        break;
      case 'monthly':
        targetDate.setMonth(currentDate.getMonth() + periodsAhead);
        break;
      case 'custom':
        targetDate.setDate(currentDate.getDate() + (periodsAhead * (config.interval || 7)));
        break;
    }
    
    return targetDate;
  }

  /**
   * Manually advance rotation to next user
   */
  async advanceToNextUser(): Promise<User> {
    const state = await this.storageService.loadRotationState();
    const currentDate = getCurrentDateInTimezone(this.timezone);
    
    await this.advanceRotation(state, currentDate);
    
    return this.storageService.getCurrentUser();
  }

  /**
   * Reset rotation to a specific user
   */
  async setCurrentUser(userId: string): Promise<User> {
    const state = await this.storageService.loadRotationState();
    const userIndex = state.users.findIndex(user => user.id === userId);
    
    if (userIndex === -1) {
      throw new Error(`User with ID ${userId} not found in rotation`);
    }
    
    const currentDate = getCurrentDateInTimezone(this.timezone);
    await this.storageService.updateRotationState(userIndex, currentDate.toISOString());
    
    return state.users[userIndex]!;
  }

  /**
   * Get rotation statistics
   */
  async getRotationStats(): Promise<{
    totalUsers: number;
    currentUserIndex: number;
    periodsSinceStart: number;
    rotationsCompleted: number;
    lastRotationDate: string;
    rotationFrequency: string;
  }> {
    const state = await this.storageService.loadRotationState();
    const currentDate = getCurrentDateInTimezone(this.timezone);
    const startDate = new Date(state.startDate);
    const periodsSinceStart = getPeriodsBetween(startDate, currentDate, state.config);
    
    const frequencyDisplay = state.config.frequency === 'custom' 
      ? `Every ${state.config.interval} days`
      : state.config.frequency;
    
    return {
      totalUsers: state.users.length,
      currentUserIndex: state.currentIndex,
      periodsSinceStart,
      rotationsCompleted: Math.floor(periodsSinceStart / state.users.length),
      lastRotationDate: state.lastRotationDate,
      rotationFrequency: frequencyDisplay,
    };
  }

  /**
   * Check if rotation should advance based on current date and config
   */
  private shouldAdvanceRotation(state: RotationState, currentDate: Date): boolean {
    // Use configurable rotation period check
    if (isNewRotationPeriod(state.lastRotationDate, currentDate, state.config)) {
      return true;
    }
    
    // Also check if we're significantly behind (missed periods)
    const lastRotationDate = new Date(state.lastRotationDate);
    const periodsSinceLastRotation = getPeriodsBetween(lastRotationDate, currentDate, state.config);
    
    return periodsSinceLastRotation > 0;
  }

  /**
   * Advance the rotation and update state
   */
  private async advanceRotation(state: RotationState, currentDate: Date): Promise<void> {
    // Simply increment to next user
    const newIndex = (state.currentIndex + 1) % state.users.length;
    
    await this.storageService.updateRotationState(newIndex, currentDate.toISOString());
    
    console.log(`Rotation advanced to next user, new index: ${newIndex}`);
  }

  /**
   * Get user at specific index with bounds checking
   */
  private getUserAtIndex(state: RotationState, index: number): User {
    if (state.users.length === 0) {
      throw new Error('No users in rotation');
    }
    
    const safeIndex = index % state.users.length;
    const user = state.users[safeIndex];
    
    if (!user) {
      throw new Error(`User not found at index ${safeIndex}`);
    }
    
    return user;
  }

  /**
   * Validate that rotation is properly configured
   */
  async validateRotation(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    
    try {
      const state = await this.storageService.loadRotationState();
      
      if (state.users.length === 0) {
        errors.push('No users configured in rotation');
      }
      
      if (state.currentIndex >= state.users.length) {
        errors.push(`Current index (${state.currentIndex}) is out of bounds for ${state.users.length} users`);
      }
      
      // Check for duplicate user IDs
      const userIds = state.users.map(u => u.id);
      const uniqueIds = new Set(userIds);
      if (userIds.length !== uniqueIds.size) {
        errors.push('Duplicate user IDs found in rotation');
      }
      
      // Validate date format
      try {
        new Date(state.startDate);
        new Date(state.lastRotationDate);
      } catch {
        errors.push('Invalid date format in rotation state');
      }
      
    } catch (error) {
      errors.push(`Failed to load rotation state: ${(error as Error).message}`);
    }
    
    return {
      valid: errors.length === 0,
      errors,
    };
  }
} 