/**
 * Authentication API Routes
 * Handles user login, logout, and registration
 */
import prisma from '@/lib/prisma';
import { hashPassword, verifyPassword, generateToken } from '@/lib/auth';
import { withAuth, withManager, apiHandler } from '@/middleware/withAuth';
import { validateRequired } from '@/lib/utils';
import { serialize } from 'cookie';

/**
 * POST /api/auth/login
 * Authenticate user and return JWT token
 */
async function login(req, res) {
  const { username, password } = req.body;
  
  // Validate required fields
  const validation = validateRequired(req.body, ['username', 'password']);
  if (!validation.valid) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields',
      missing: validation.missing
    });
  }
  
  try {
    // Find user by username
    const user = await prisma.users.findUnique({
      where: { username: username.toLowerCase() }
    });
    
    if (!user || !user.is_active) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }
    
    // Verify password
    const isValid = await verifyPassword(password, user.password_hash);
    
    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }
    
    // Generate JWT token
    const token = generateToken(user);
    
    // Set HTTP-only cookie
    res.setHeader('Set-Cookie', serialize('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24 hours
      path: '/'
    }));
    
    return res.status(200).json({
      success: true,
      token,
      user: {
        userId: user.user_id,
        username: user.username,
        fullName: user.full_name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      error: 'Login failed'
    });
  }
}

export default apiHandler({
  POST: login
});
