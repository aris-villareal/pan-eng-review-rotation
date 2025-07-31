import { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';

interface RotationState {
  users: Array<{ id: string; startDate: string }>;
  currentIndex: number;
  lastRotationDate: string;
  startDate: string;
  config: {
    frequency: string;
    schedule: {
      time: string;
      dayOfWeek?: number;
    };
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Get current state
    const currentState = await kv.get<RotationState>('rotation-state');
    
    if (!currentState) {
      return res.status(404).json({ error: 'No rotation state found in KV' });
    }

    console.log('Current state config:', JSON.stringify(currentState.config, null, 2));

    // Update the configuration to include dayOfWeek: 5 (Friday)
    const updatedState: RotationState = {
      ...currentState,
      config: {
        ...currentState.config,
        schedule: {
          ...currentState.config.schedule,
          dayOfWeek: 5  // Friday
        }
      }
    };

    // Save updated state
    await kv.set('rotation-state', updatedState);
    
    console.log('Updated KV state with Friday configuration');

    return res.status(200).json({
      success: true,
      message: 'KV state updated with Friday schedule',
      beforeConfig: currentState.config,
      afterConfig: updatedState.config,
      currentUser: updatedState.users[updatedState.currentIndex]
    });

  } catch (error) {
    console.error('Error updating KV:', error);
    return res.status(500).json({ 
      error: 'Failed to update KV state', 
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}