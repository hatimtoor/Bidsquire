import { NextApiRequest, NextApiResponse } from 'next';
import { databaseService } from '@/services/database';
import { verifyToken } from '@/services/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    try {
      const { userData, createdBy } = req.body;

      // Validate input
      if (!userData || !createdBy) {
        return res.status(400).json({
          error: 'User data and createdBy are required.'
        });
      }

      // Validate required fields
      if (!userData.name || !userData.email || !userData.password || !userData.role) {
        return res.status(400).json({
          error: 'Name, email, password, and role are required.'
        });
      }

      // Inherit org from the creating admin's JWT
      const decoded: any = verifyToken(req);
      const orgId = decoded?.orgId || null;

      // Ensure users are active by default unless explicitly disabled
      const userDataWithDefaults = {
        ...userData,
        isActive: userData.isActive !== false,
        orgId,
      };

      // Create user with credits
      const newUser = await databaseService.createUserWithCredits(userDataWithDefaults, createdBy);
      
      res.status(201).json({ 
        success: true,
        message: 'User created successfully',
        user: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
          isActive: newUser.isActive,
          createdAt: newUser.createdAt,
          updatedAt: newUser.updatedAt,
          createdBy: newUser.createdBy
        }
      });
    } catch (error) {
      console.error('Error creating user:', error);
      res.status(500).json({ 
        error: 'Failed to create user',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  } else if (req.method === 'DELETE') {
    try {
      const { userId } = req.query;
      
      if (!userId || typeof userId !== 'string') {
        return res.status(400).json({ 
          error: 'User ID is required.' 
        });
      }

      // Delete user (this will also delete their credits due to CASCADE)
      const success = await databaseService.deleteUser(userId);
      
      if (success) {
        res.status(200).json({ 
          success: true,
          message: 'User deleted successfully'
        });
      } else {
        res.status(404).json({ 
          error: 'User not found' 
        });
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      res.status(500).json({ 
        error: 'Failed to delete user',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  } else {
    res.setHeader('Allow', ['POST', 'DELETE']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
