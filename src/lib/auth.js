/**
 * Authentication Utilities
 * Handles JWT token generation and verification
 */
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const isProduction = process.env.NODE_ENV === 'production';
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

if (isProduction && !JWT_SECRET) {
  throw new Error('JWT_SECRET is required in production');
}

const EFFECTIVE_JWT_SECRET = JWT_SECRET || 'dev-only-jwt-secret-change-me';

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
export function generateToken(user) {
  const payload = {
    userId: user.user_id,
    username: user.username,
    role: user.role,
    fullName: user.full_name
  };
  
  return jwt.sign(payload, EFFECTIVE_JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Verify and decode a JWT token
 * @param {string} token - JWT token
 * @returns {Object|null} Decoded payload or null if invalid
 */
export function verifyToken(token) {
  try {
    return jwt.verify(token, EFFECTIVE_JWT_SECRET);
  } catch (error) {
    console.error('Token verification failed:', error.message);
    return null;
  }
}

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
