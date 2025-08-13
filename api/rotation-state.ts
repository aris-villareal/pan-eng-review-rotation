import { VercelRequest, VercelResponse } from '@vercel/node';

export default async (req: VercelRequest, res: VercelResponse) => {
  try {
    // Only allow GET requests
    if (req.method !== 'GET') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    // Import KV storage service
    const { KVStorageService } = await import('../src/services/KVStorageService');
    const kvStorageService = new KVStorageService();

    // Get current rotation state
    const state = await kvStorageService.getRotationStateForAction();



    // Return the rotation state
    res.status(200).json({
      success: true,
      data: state,
      message: 'Rotation state retrieved from KV store'
    });

  } catch (error) {
    console.error('Error getting rotation state:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: (error as Error).message 
    });
  }
}; 