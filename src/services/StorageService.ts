import fs from 'fs/promises';
import path from 'path';
import { RotationState, User, RotationConfig } from '../types';

export class StorageService {
  private usersFilePath: string;
  private stateFilePath: string;

  constructor(usersFilePath: string, stateFilePath: string) {
    this.usersFilePath = usersFilePath;
    this.stateFilePath = stateFilePath;
  }

  /**
   * Load rotation state from file
   */
  async loadRotationState(): Promise<RotationState> {
    try {
      const data = await fs.readFile(this.usersFilePath, 'utf-8');
      const state = JSON.parse(data) as RotationState;
      
      // Backwards compatibility: Add default config if missing
      if (!state.config) {
        state.config = this.getDefaultRotationConfig();
      }
      
      // Validate the loaded state
      this.validateRotationState(state);
      
      return state;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(`Users file not found: ${this.usersFilePath}`);
      }
      throw new Error(`Failed to load rotation state: ${(error as Error).message}`);
    }
  }

  /**
   * Get default rotation configuration for backwards compatibility
   */
  private getDefaultRotationConfig(): RotationConfig {
    return {
      frequency: 'weekly',
      schedule: {
        dayOfWeek: 1, // Monday
        time: '09:00',
      },
    };
  }

  /**
   * Save rotation state to file
   */
  async saveRotationState(state: RotationState): Promise<void> {
    try {
      // Validate before saving
      this.validateRotationState(state);
      
      // Ensure directory exists
      await fs.mkdir(path.dirname(this.stateFilePath), { recursive: true });
      
      // Write to temporary file first, then rename for atomicity
      const tempFile = `${this.stateFilePath}.tmp`;
      await fs.writeFile(tempFile, JSON.stringify(state, null, 2), 'utf-8');
      await fs.rename(tempFile, this.stateFilePath);
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
   * Add a new user to the rotation
   */
  async addUser(user: User): Promise<void> {
    const state = await this.loadRotationState();
    
    // Check if user already exists
    const existingUser = state.users.find(u => u.id === user.id);
    if (existingUser) {
      throw new Error(`User with ID ${user.id} already exists in rotation`);
    }
    
    state.users.push(user);
    await this.saveRotationState(state);
  }

  /**
   * Remove a user from the rotation
   */
  async removeUser(userId: string): Promise<void> {
    const state = await this.loadRotationState();
    const userIndex = state.users.findIndex(u => u.id === userId);
    
    if (userIndex === -1) {
      throw new Error(`User with ID ${userId} not found in rotation`);
    }
    
    // Adjust current index if necessary
    if (userIndex < state.currentIndex) {
      state.currentIndex--;
    } else if (userIndex === state.currentIndex && state.currentIndex >= state.users.length - 1) {
      state.currentIndex = 0;
    }
    
    state.users.splice(userIndex, 1);
    
    if (state.users.length === 0) {
      throw new Error('Cannot remove last user from rotation');
    }
    
    await this.saveRotationState(state);
  }

  /**
   * Get current user in rotation
   */
  async getCurrentUser(): Promise<User> {
    const state = await this.loadRotationState();
    
    if (state.users.length === 0) {
      throw new Error('No users found in rotation');
    }
    
    const currentIndex = state.currentIndex % state.users.length;
    return state.users[currentIndex]!;
  }

  /**
   * Validate rotation state structure
   */
  private validateRotationState(state: RotationState): void {
    if (!state.users || !Array.isArray(state.users)) {
      throw new Error('Invalid rotation state: users must be an array');
    }
    
    if (state.users.length === 0) {
      throw new Error('Invalid rotation state: must have at least one user');
    }
    
    if (typeof state.currentIndex !== 'number' || state.currentIndex < 0) {
      throw new Error('Invalid rotation state: currentIndex must be a non-negative number');
    }
    
    if (!state.lastRotationDate || !state.startDate) {
      throw new Error('Invalid rotation state: missing required date fields');
    }
    
    if (!state.config) {
      throw new Error('Invalid rotation state: missing config field');
    }
    
    // Validate rotation config
    this.validateRotationConfig(state.config);
    
    // Validate each user
    state.users.forEach((user, index) => {
      if (!user.id || !user.startDate) {
        throw new Error(`Invalid user at index ${index}: missing required fields (id, startDate)`);
      }
    });
  }

  /**
   * Validate rotation configuration
   */
  private validateRotationConfig(config: RotationConfig): void {
    const validFrequencies = ['daily', 'weekly', 'bi-weekly', 'monthly', 'custom'];
    if (!validFrequencies.includes(config.frequency)) {
      throw new Error(`Invalid rotation frequency: ${config.frequency}`);
    }
    
    if (config.frequency === 'custom' && (!config.interval || config.interval < 1)) {
      throw new Error('Custom frequency requires a positive interval value');
    }
    
    if (config.schedule?.dayOfWeek !== undefined) {
      if (config.schedule.dayOfWeek < 0 || config.schedule.dayOfWeek > 6) {
        throw new Error('dayOfWeek must be between 0 (Sunday) and 6 (Saturday)');
      }
    }
    
    if (config.schedule?.dayOfMonth !== undefined) {
      if (config.schedule.dayOfMonth < 1 || config.schedule.dayOfMonth > 31) {
        throw new Error('dayOfMonth must be between 1 and 31');
      }
    }
  }
} 