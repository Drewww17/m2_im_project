/**
 * Authentication API Routes
 * Handles user login, logout, and registration
 */
import prisma from '@/lib/prisma';
import {
  verifyPassword,
  generateAccessToken,
  generateRefreshToken,
  getAccessCookieMaxAgeSeconds,
  getRefreshCookieMaxAgeSeconds
} from '@/lib/auth';
import { consumeRateLimit, getRequestIp } from '@/lib/rateLimit';
import { apiHandler } from '@/middleware/withAuth';
import { validateRequired } from '@/lib/utils';
import { serialize } from 'cookie';

const LOGIN_RATE_LIMIT = Number(process.env.AUTH_LOGIN_RATE_LIMIT || 10);
const LOGIN_WINDOW_MS = Number(process.env.AUTH_LOGIN_WINDOW_MS || 60_000);

/**
 * POST /api/auth/login
 * Authenticate user and return JWT token
 */
async function login(req, res) {
  const { username, password } = req.body;
  const ip = getRequestIp(req);
  const limiterKey = `${ip}:${String(username || '').toLowerCase()}`;
  const rateCheck = consumeRateLimit({
    bucketName: 'auth-login',
    key: limiterKey,
    limit: LOGIN_RATE_LIMIT,
    windowMs: LOGIN_WINDOW_MS
  });

  res.setHeader('X-RateLimit-Limit', String(LOGIN_RATE_LIMIT));
  res.setHeader('X-RateLimit-Remaining', String(rateCheck.remaining));

  if (!rateCheck.allowed) {
    res.setHeader('Retry-After', String(rateCheck.retryAfterSeconds));
    return res.status(429).json({
      success: false,
      error: 'Too many login attempts. Please try again later.',
      code: 'RATE_LIMITED',
      retryAfterSeconds: rateCheck.retryAfterSeconds
    });
  }
  
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
    
    // Generate access + refresh tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
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
    
    // Set HTTP-only access + refresh cookies
    res.setHeader('Set-Cookie', [
      serialize('accessToken', accessToken, accessCookieOptions),
      serialize('refreshToken', refreshToken, refreshCookieOptions),
      // Keep legacy cookie for backward compatibility while old sessions rotate out
      serialize('token', accessToken, accessCookieOptions)
    ]);
    
    return res.status(200).json({
      success: true,
      token: accessToken,
      user: {
        userId: user.user_id,
        username: user.username,
        fullName: user.full_name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);

    const prismaCode = error?.code;
    const errorName = error?.name || '';
    const errorMsg = error?.message || '';

    // Known Prisma error codes
    const prismaErrors = {
      P1000: 'Database authentication failed',
      P1001: 'Cannot reach database server',
      P1002: 'Database server timed out',
      P1003: 'Database does not exist',
      P1008: 'Database operation timed out',
      P1017: 'Database server closed the connection',
      P2002: 'Duplicate record conflict',
      P2021: 'Database table does not exist (schema not pushed)',
      P2010: 'Raw query failed',
    };

    if (prismaCode && prismaErrors[prismaCode]) {
      return res.status(500).json({
        success: false,
        error: prismaErrors[prismaCode],
        code: `DB_${prismaCode}`
      });
    }

    // Surface enough detail to diagnose remotely
    const debugHint = prismaCode
      ? `Prisma ${prismaCode}`
      : errorName
        ? `${errorName}: ${errorMsg.slice(0, 120)}`
        : errorMsg.slice(0, 120);

    return res.status(500).json({
      success: false,
      error: 'Login failed due to server configuration',
      code: 'LOGIN_SERVER_ERROR',
      hint: debugHint
    });
  }
}

export default apiHandler({
  POST: login
});
