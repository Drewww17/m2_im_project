/**
 * Logout API Route
 * Clears authentication cookie
 */
import { serialize } from 'cookie';
import { apiHandler } from '@/middleware/withAuth';

async function logout(req, res) {
  // Clear the token cookie
  res.setHeader('Set-Cookie', serialize('token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0, // Expire immediately
    path: '/'
  }));
  
  return res.status(200).json({
    success: true,
    message: 'Logged out successfully'
  });
}

export default apiHandler({
  POST: logout
});
