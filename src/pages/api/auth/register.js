/**
 * User Registration API Route
 * Manager-only: Create new user accounts
 */
import prisma from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { withManager, apiHandler } from '@/middleware/withAuth';
import { validateRequired } from '@/lib/utils';

async function createUser(req, res) {
  const { username, password, fullName, role } = req.body;
  
  // Validate required fields
  const validation = validateRequired(req.body, ['username', 'password', 'fullName', 'role']);
  if (!validation.valid) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields',
      missing: validation.missing
    });
  }
  
  // Validate role
  const validRoles = ['CASHIER', 'CLERK', 'MANAGER'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid role',
      validRoles
    });
  }
  
  try {
    // Check if username already exists
    const existingUser = await prisma.users.findUnique({
      where: { username: username.toLowerCase() }
    });
    
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: 'Username already exists'
      });
    }
    
    // Hash password and create user
    const passwordHash = await hashPassword(password);
    
    const user = await prisma.users.create({
      data: {
        username: username.toLowerCase(),
        password_hash: passwordHash,
        full_name: fullName,
        role: role,
        is_active: true,
        updated_at: new Date()
      },
      select: {
        user_id: true,
        username: true,
        full_name: true,
        role: true,
        is_active: true,
        created_at: true
      }
    });
    
    return res.status(201).json({
      success: true,
      user
    });
  } catch (error) {
    console.error('User registration error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create user'
    });
  }
}

async function getUsers(req, res) {
  try {
    const users = await prisma.users.findMany({
      select: {
        user_id: true,
        username: true,
        full_name: true,
        role: true,
        is_active: true,
        created_at: true
      },
      orderBy: { created_at: 'desc' }
    });
    
    return res.status(200).json({
      success: true,
      users
    });
  } catch (error) {
    console.error('Get users error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch users'
    });
  }
}

export default apiHandler({
  POST: withManager(createUser),
  GET: withManager(getUsers)
});
