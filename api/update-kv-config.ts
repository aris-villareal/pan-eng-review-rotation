import { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get current state
    const currentState = await kv.get('rotation-state');
    
    if (!currentState) {
      return res.status(404).json({ error: 'No rotation state found in KV' });
    }

    console.log('Current state:', JSON.stringify(currentState, null, 2));

    // Update the configuration to include dayOfWeek: 5 (Friday)
    const updatedState = {
      ...currentState,
      config: {
        ...currentState.config,
        schedule: {
          ...currentState.config.schedule,
          dayOfWeek: 5  // Friday
        }
      },
      // Ensure steeve.bete is current (index 1)
      currentIndex: 1,
      lastRotationDate: new Date().toISOString()
    };

    // Save updated state
    await kv.set('rotation-state', updatedState);
    
    console.log('Updated KV state with dayOfWeek: 5 and steeve.bete as current');

    res.status(200).json({
      success: true,
      message: 'KV state updated successfully',
      updatedConfig: updatedState.config,
      currentUser: updatedState.users[updatedState.currentIndex]
    });

  } catch (error) {
    console.error('Error updating KV:', error);
    res.status(500).json({ 
      error: 'Failed to update KV state', 
      details: error.message 
    });
  }
}