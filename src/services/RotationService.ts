import { User, RotationState } from '../types';
import { StorageService } from './StorageService';
import { getISOWeek, getWeeksBetween, getCurrentDateInTimezone, isNewWeek } from '../utils/dateUtils';

export class RotationService {
  private storageService: StorageService;
  private timezone: string;

  constructor(storageService: StorageService, timezone: string = 'UTC') {
    this.storageService = storageService;
    this.timezone = timezone;
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
   * Preview who will be the forum owner for a specific week
   */
  async previewForumOwner(targetDate: Date): Promise<User> {
    const state = await this.storageService.loadRotationState();
    const rotationStartDate = new Date(state.startDate);
    const weeksSinceStart = getWeeksBetween(rotationStartDate, targetDate);
    const targetIndex = weeksSinceStart % state.users.length;
    
    return this.getUserAtIndex(state, targetIndex);
  }

  /**
   * Get rotation schedule for the next N weeks
   */
  async getUpcomingRotation(weeksAhead: number = 4): Promise<Array<{ user: User; weekInfo: any; weekNumber: number }>> {
    const state = await this.storageService.loadRotationState();
    const currentDate = getCurrentDateInTimezone(this.timezone);
    const schedule = [];

    for (let i = 0; i < weeksAhead; i++) {
      const targetDate = new Date(currentDate);
      targetDate.setDate(currentDate.getDate() + (i * 7));
      
      const user = await this.previewForumOwner(targetDate);
      const weekInfo = getISOWeek(targetDate);
      
      schedule.push({
        user,
        weekInfo,
        weekNumber: i + 1,
      });
    }

    return schedule;
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
    weeksSinceStart: number;
    rotationsCompleted: number;
    lastRotationDate: string;
  }> {
    const state = await this.storageService.loadRotationState();
    const currentDate = getCurrentDateInTimezone(this.timezone);
    const startDate = new Date(state.startDate);
    const weeksSinceStart = getWeeksBetween(startDate, currentDate);
    
    return {
      totalUsers: state.users.length,
      currentUserIndex: state.currentIndex,
      weeksSinceStart,
      rotationsCompleted: Math.floor(weeksSinceStart / state.users.length),
      lastRotationDate: state.lastRotationDate,
    };
  }

  /**
   * Check if rotation should advance based on current date
   */
  private shouldAdvanceRotation(state: RotationState, currentDate: Date): boolean {
    // Always advance if it's a new week
    if (isNewWeek(state.lastRotationDate, currentDate)) {
      return true;
    }
    
    // Also check if we're significantly behind (missed weeks)
    const lastRotationDate = new Date(state.lastRotationDate);
    const weeksSinceLastRotation = getWeeksBetween(lastRotationDate, currentDate);
    
    return weeksSinceLastRotation > 0;
  }

  /**
   * Advance the rotation and update state
   */
  private async advanceRotation(state: RotationState, currentDate: Date): Promise<void> {
    const lastRotationDate = new Date(state.lastRotationDate);
    const weeksSinceLastRotation = getWeeksBetween(lastRotationDate, currentDate);
    
    if (weeksSinceLastRotation <= 0) {
      return; // No advancement needed
    }
    
    // Calculate new index based on weeks passed
    const newIndex = (state.currentIndex + weeksSinceLastRotation) % state.users.length;
    
    await this.storageService.updateRotationState(newIndex, currentDate.toISOString());
    
    console.log(`Rotation advanced: ${weeksSinceLastRotation} week(s) passed, new index: ${newIndex}`);
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