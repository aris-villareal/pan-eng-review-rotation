import { kv } from '@vercel/kv';
import { User, RotationState } from '../types';

export class KVStorageService {
  private static readonly ROTATION_STATE_KEY = 'rotation-state';
  
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

      // Fallback: use embedded default state
      const defaultState: RotationState = {
        users: [
          { id: "aris.villareal", startDate: "2025-07-18" },
          { id: "steeve.bete", startDate: "2025-07-18" },
          { id: "eddie.davies", startDate: "2025-07-18" },
          { id: "dmitry.doronin", startDate: "2025-07-18" },
          { id: "joseph.gaudierdepew", startDate: "2025-07-18" },
          { id: "alex.morton", startDate: "2025-07-18" },
          { id: "aron.nochenson", startDate: "2025-07-18" },
          { id: "basile.barrincio", startDate: "2025-07-18" },
          { id: "malki.davis", startDate: "2025-07-18" },
          { id: "jia.kim", startDate: "2025-07-18" },
          { id: "jessye.coleman-shapir", startDate: "2025-07-18" },
          { id: "sohum.dalal", startDate: "2025-07-18" },
          { id: "andras.varadi", startDate: "2025-07-18" },
          { id: "matthew.colozzo", startDate: "2025-07-18" }
        ],
        currentIndex: 0,
        lastRotationDate: "2025-07-21",
        startDate: "2025-07-18",
        config: {
          frequency: "weekly",
          schedule: {
            dayOfWeek: 5,
            time: "09:00"
          }
        }
      };
      
      // Save default state to KV for future use
      await this.saveRotationState(defaultState);
      console.log('[KV] Initialized KV store with default state');
      
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
      throw new Error('No users in rotation');
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
      throw new Error('No users in rotation');
    }
    
    // Calculate next index with wraparound
    const nextIndex = (state.currentIndex + 1) % state.users.length;
    const nextUser = state.users[nextIndex];
    
    if (!nextUser) {
      throw new Error(`Invalid next index: ${nextIndex}`);
    }
    
    // Update state in KV
    await this.updateRotationState(nextIndex, new Date().toISOString());
    
    console.log(`Rotation advanced: ${state.users[state.currentIndex]?.id} → ${nextUser.id}`);
    return nextUser;
  }

  /**
   * Get current rotation state for external access (like GitHub Actions)
   */
  async getRotationStateForAction(): Promise<RotationState> {
    return this.loadRotationState();
  }
} 