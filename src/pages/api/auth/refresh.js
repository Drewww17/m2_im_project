/**
 * Refresh Session API Route
 * Issues a new short-lived access token using a valid refresh token cookie
 */
import prisma from '@/lib/prisma';
import {
  verifyRefreshToken,
  generateAccessToken,
  generateRefreshToken,
  getAccessCookieMaxAgeSeconds,
  getRefreshCookieMaxAgeSeconds
} from '@/lib/auth';
import { apiHandler } from '@/middleware/withAuth';
import { serialize } from 'cookie';

async function refreshSession(req, res) {
  const refreshToken = req.cookies?.refreshToken;

  if (!refreshToken) {
    return res.status(401).json({
      success: false,
      error: 'Refresh token is required',
      code: 'NO_REFRESH_TOKEN'
    });
  }

  const decoded = verifyRefreshToken(refreshToken);

  if (!decoded) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired refresh token',
      code: 'INVALID_REFRESH_TOKEN'
    });
  }

  try {
    const user = await prisma.users.findUnique({
      where: { user_id: decoded.userId }
    });

    if (!user || !user.is_active) {
      return res.status(401).json({
        success: false,
        error: 'User is inactive or does not exist',
        code: 'INVALID_USER'
      });
    }

    const accessToken = generateAccessToken(user);
    // Rotate refresh token each refresh call to limit replay windows.
    const newRefreshToken = generateRefreshToken(user);

    const accessCookieMaxAge = getAccessCookieMaxAgeSeconds();
    const refreshCookieMaxAge = getRefreshCookieMaxAgeSeconds();

    const baseCookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    };

    const accessCookieOptions = { ...baseCookieOptions };
    const refreshCookieOptions = { ...baseCookieOptions };

    if (accessCookieMaxAge !== null) {
      accessCookieOptions.maxAge = accessCookieMaxAge;
    }

    if (refreshCookieMaxAge !== null) {
      refreshCookieOptions.maxAge = refreshCookieMaxAge;
    }

    res.setHeader('Set-Cookie', [
      serialize('accessToken', accessToken, accessCookieOptions),
      serialize('refreshToken', newRefreshToken, refreshCookieOptions),
      // Keep legacy cookie while clients migrate.
      serialize('token', accessToken, accessCookieOptions)
    ]);

    return res.status(200).json({
      success: true,
      user: {
        userId: user.user_id,
        username: user.username,
        fullName: user.full_name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Refresh session error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to refresh session',
      code: 'REFRESH_ERROR'
    });
  }
}

export default apiHandler({
  POST: refreshSession
});
