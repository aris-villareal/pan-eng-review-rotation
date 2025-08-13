import { kv } from '@vercel/kv';
import { User, RotationState } from '../types';

export class KVStorageService {
  private static readonly ROTATION_STATE_KEY = 'staff-doc-rotation-state';
  
  /**
   * Load rotation state from Vercel KV, fallback to embedded default if not found
   */
  async loadRotationState(): Promise<RotationState> {
    try {
      // Try to get from KV first
      const kvState = await kv.get<RotationState>(KVStorageService.ROTATION_STATE_KEY);
      
      if (kvState) {
        return kvState;
      }

      // Fallback: use embedded default state for staff documentation rotation
      const today = new Date().toISOString().split('T')[0];
      const defaultState: RotationState = {
        users: [
          { id: "staff.member1", startDate: today },
          { id: "staff.member2", startDate: today },
          { id: "staff.member3", startDate: today },
          { id: "staff.member4", startDate: today },
          { id: "staff.member5", startDate: today },
          // Add more staff members as needed - these will be manually updated
        ],
        currentIndex: 0,
        lastRotationDate: today,
        startDate: today,
        config: {
          frequency: "weekly",
          schedule: {
            dayOfWeek: 5, // Friday
            time: "09:00"
          }
        }
      };
      
      // Save default state to KV for future use
      await this.saveRotationState(defaultState);
      console.log('[KV] Initialized KV store with default staff documentation rotation state');
      
      return defaultState;
    } catch (error) {
      throw new Error(`Failed to load rotation state: ${(error as Error).message}`);
    }
  }

  /**
   * Save rotation state to Vercel KV
   */
  async saveRotationState(state: RotationState): Promise<void> {
    try {
      await kv.set(KVStorageService.ROTATION_STATE_KEY, state);
    } catch (error) {
      throw new Error(`Failed to save rotation state: ${(error as Error).message}`);
    }
  }

  /**
   * Update only the current index and last rotation date
   */
  async updateRotationState(currentIndex: number, lastRotationDate: string): Promise<void> {
    const state = await this.loadRotationState();
    state.currentIndex = currentIndex;
    state.lastRotationDate = lastRotationDate;
    await this.saveRotationState(state);
  }

  /**
   * Get the current user based on rotation state
   */
  async getCurrentUser(): Promise<User> {
    const state = await this.loadRotationState();
    
    if (state.users.length === 0) {
      throw new Error('No users in staff documentation rotation');
    }
    
    const currentUser = state.users[state.currentIndex];
    if (!currentUser) {
      throw new Error(`Invalid current index: ${state.currentIndex}`);
    }
    
    return currentUser;
  }

  /**
   * Manually advance to next user (for skip rotation)
   */
  async advanceToNextUser(): Promise<User> {
    const state = await this.loadRotationState();
    
    if (state.users.length === 0) {
      throw new Error('No users in staff documentation rotation');
    }
    
    // Calculate next index with wraparound
    const nextIndex = (state.currentIndex + 1) % state.users.length;
    const nextUser = state.users[nextIndex];
    
    if (!nextUser) {
      throw new Error(`Invalid next index: ${nextIndex}`);
    }
    
    // Update state in KV
    await this.updateRotationState(nextIndex, new Date().toISOString());
    
    console.log(`Staff documentation rotation advanced: ${state.users[state.currentIndex]?.id} → ${nextUser.id}`);
    return nextUser;
  }

  /**
   * Get current rotation state for external access (like GitHub Actions)
   */
  async getRotationStateForAction(): Promise<RotationState> {
    return this.loadRotationState();
  }

  /**
   * Get rotation statistics for monitoring
   */
  async getRotationStats(): Promise<{
    totalUsers: number;
    currentUser: string;
    rotationNumber: number;
    daysActive: number;
  }> {
    const state = await this.loadRotationState();
    const startDate = new Date(state.startDate);
    const currentDate = new Date();
    const daysActive = Math.floor((currentDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    return {
      totalUsers: state.users.length,
      currentUser: state.users[state.currentIndex]?.id || 'Unknown',
      rotationNumber: Math.floor(daysActive / 7) + 1,
      daysActive
    };
  }

  /**
   * Update user list (for manual management)
   */
  async updateUserList(users: User[]): Promise<void> {
    const state = await this.loadRotationState();
    
    // Preserve current rotation state if possible
    let newCurrentIndex = 0;
    const currentUserId = state.users[state.currentIndex]?.id;
    
    if (currentUserId) {
      const newIndex = users.findIndex(user => user.id === currentUserId);
      if (newIndex >= 0) {
        newCurrentIndex = newIndex;
      }
    }
    
    state.users = users;
    state.currentIndex = Math.min(newCurrentIndex, users.length - 1);
    
    await this.saveRotationState(state);
    console.log(`Updated user list for staff documentation rotation: ${users.length} users`);
  }
}