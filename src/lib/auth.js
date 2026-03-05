/**
 * Authentication Utilities
 * Handles JWT token generation and verification
 */
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const isProduction = process.env.NODE_ENV === 'production';
const JWT_SECRET = process.env.JWT_SECRET;
const ACCESS_TOKEN_EXPIRES_IN = process.env.ACCESS_TOKEN_EXPIRES_IN || process.env.JWT_EXPIRES_IN || '15m';
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '30d';
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || JWT_SECRET;
const NON_EXPIRING_VALUES = new Set(['never', 'none', 'off', 'false', '0']);

if (isProduction && !JWT_SECRET) {
  throw new Error('JWT_SECRET is required in production');
}

if (isProduction && !REFRESH_TOKEN_SECRET) {
  throw new Error('REFRESH_TOKEN_SECRET is required in production');
}

const EFFECTIVE_JWT_SECRET = JWT_SECRET || 'dev-only-jwt-secret-change-me';
const EFFECTIVE_REFRESH_SECRET = REFRESH_TOKEN_SECRET || 'dev-only-refresh-secret-change-me';

function parseDurationToSeconds(value) {
  const normalized = String(value).trim().toLowerCase();
  const matched = normalized.match(/^(\d+)([smhdw])$/);

  if (!matched) {
    return null;
  }

  const amount = Number(matched[1]);
  const unit = matched[2];
  const multipliers = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400,
    w: 604800,
  };

  return amount * multipliers[unit];
}

function isNonExpiringDuration(value) {
  return NON_EXPIRING_VALUES.has(String(value).trim().toLowerCase());
}

export function isAccessTokenNonExpiring() {
  return isNonExpiringDuration(ACCESS_TOKEN_EXPIRES_IN);
}

function getCookieMaxAgeSeconds(duration, fallbackSeconds = 86400) {
  if (isNonExpiringDuration(duration)) {
    return null;
  }

  const parsedSeconds = parseDurationToSeconds(duration);
  return parsedSeconds ?? fallbackSeconds;
}

export function getAccessCookieMaxAgeSeconds() {
  return getCookieMaxAgeSeconds(ACCESS_TOKEN_EXPIRES_IN, 60 * 15);
}

export function getRefreshCookieMaxAgeSeconds() {
  return getCookieMaxAgeSeconds(REFRESH_TOKEN_EXPIRES_IN, 60 * 60 * 24 * 30);
}

function createTokenPayload(user) {
  return {
    userId: user.user_id,
    username: user.username,
    role: user.role,
    fullName: user.full_name
  };
}

/**
 * Hash a password using bcrypt
 * @param {string} password - Plain text password
 * @returns {Promise<string>} Hashed password
 */
export async function hashPassword(password) {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
}

/**
 * Verify a password against a hash
 * @param {string} password - Plain text password
 * @param {string} hash - Stored hash
 * @returns {Promise<boolean>} True if password matches
 */
export async function verifyPassword(password, hash) {
  return await bcrypt.compare(password, hash);
}

/**
 * Generate a JWT token for a user
 * @param {Object} user - User object
 * @returns {string} JWT token
 */
export function generateAccessToken(user) {
  const payload = createTokenPayload(user);

  if (isAccessTokenNonExpiring()) {
    return jwt.sign(payload, EFFECTIVE_JWT_SECRET);
  }

  return jwt.sign(payload, EFFECTIVE_JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES_IN });
}

export function generateRefreshToken(user) {
  const payload = {
    userId: user.user_id,
    type: 'refresh'
  };

  if (isNonExpiringDuration(REFRESH_TOKEN_EXPIRES_IN)) {
    return jwt.sign(payload, EFFECTIVE_REFRESH_SECRET);
  }

  return jwt.sign(payload, EFFECTIVE_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRES_IN });
}

/**
 * Verify and decode a JWT token
 * @param {string} token - JWT token
 * @returns {Object|null} Decoded payload or null if invalid
 */
export function verifyAccessToken(token) {
  try {
    return jwt.verify(token, EFFECTIVE_JWT_SECRET);
  } catch (error) {
    console.error('Token verification failed:', error.message);
    return null;
  }
}

export function verifyRefreshToken(token) {
  try {
    const decoded = jwt.verify(token, EFFECTIVE_REFRESH_SECRET);
    return decoded.type === 'refresh' ? decoded : null;
  } catch (error) {
    console.error('Refresh token verification failed:', error.message);
    return null;
  }
}

// Backward-compatible aliases
export const generateToken = generateAccessToken;
export const verifyToken = verifyAccessToken;

/**
 * Extract token from request headers or cookies
 * @param {Object} req - HTTP request object
 * @returns {string|null} Token or null
 */
export function extractToken(req) {
  // Check Authorization header first
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  // Check cookies
  if (req.cookies && req.cookies.accessToken) {
    return req.cookies.accessToken;
  }

  // Backward compatibility with older cookie name
  if (req.cookies && req.cookies.token) {
    return req.cookies.token;
  }
  
  return null;
}

/**
 * Role hierarchy for permission checking
 */
export const ROLE_HIERARCHY = {
  CASHIER: 1,
  CLERK: 2,
  MANAGER: 3
};

/**
 * Check if a role has at least a certain permission level
 * @param {string} userRole - User's role
 * @param {string} requiredRole - Minimum required role
 * @returns {boolean} True if user has sufficient permissions
 */
export function hasPermission(userRole, requiredRole) {
  const userLevel = ROLE_HIERARCHY[userRole] || 0;
  const requiredLevel = ROLE_HIERARCHY[requiredRole] || 0;
  return userLevel >= requiredLevel;
}
