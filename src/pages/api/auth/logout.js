/**
 * Logout API Route
 * Clears authentication cookie
 */
import { serialize } from 'cookie';
import { apiHandler } from '@/middleware/withAuth';

async function logout(req, res) {
  const clearCookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/'
  };

  // Clear all auth cookies
  res.setHeader('Set-Cookie', [
    serialize('accessToken', '', clearCookieOptions),
    serialize('refreshToken', '', clearCookieOptions),
    serialize('token', '', clearCookieOptions)
  ]);
  
  return res.status(200).json({
    success: true,
    message: 'Logged out successfully'
  });
}

export default apiHandler({
  POST: logout
});
