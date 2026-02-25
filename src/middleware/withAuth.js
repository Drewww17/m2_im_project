/**
 * Authentication and Authorization Middleware
 * Protects API routes based on authentication and role requirements
 */
import { verifyToken, extractToken, hasPermission } from '@/lib/auth';

/**
 * Higher-order function to protect API routes
 * @param {Function} handler - API route handler
 * @param {Object} options - Configuration options
 * @param {string[]} options.allowedRoles - Roles allowed to access this route
 * @returns {Function} Protected handler
 */
export function withAuth(handler, options = {}) {
  return async (req, res) => {
    try {
      // Extract and verify token
      const token = extractToken(req);
      
      if (!token) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'NO_TOKEN'
        });
      }
      
      const decoded = verifyToken(token);
      
      if (!decoded) {
        return res.status(401).json({
          success: false,
          error: 'Invalid or expired token',
          code: 'INVALID_TOKEN'
        });
      }
      
      // Check role-based access if roles are specified
      if (options.allowedRoles && options.allowedRoles.length > 0) {
        const hasAccess = options.allowedRoles.some(role => 
          hasPermission(decoded.role, role) || decoded.role === role
        );
        
        if (!hasAccess) {
          return res.status(403).json({
            success: false,
            error: 'Insufficient permissions',
            code: 'FORBIDDEN',
            requiredRoles: options.allowedRoles,
            userRole: decoded.role
          });
        }
      }
      
      // Attach user to request
      req.user = decoded;
      
      // Call the actual handler
      return await handler(req, res);
    } catch (error) {
      console.error('Auth middleware error:', error);
      return res.status(500).json({
        success: false,
        error: 'Authentication error',
        code: 'AUTH_ERROR'
      });
    }
  };
}

/**
 * Role-specific middleware shortcuts
 */
export const withCashier = (handler) => withAuth(handler, { 
  allowedRoles: ['CASHIER', 'CLERK', 'MANAGER'] 
});

export const withClerk = (handler) => withAuth(handler, { 
  allowedRoles: ['CLERK', 'MANAGER'] 
});

export const withManager = (handler) => withAuth(handler, { 
  allowedRoles: ['MANAGER'] 
});

/**
 * API Route handler wrapper with method validation
 * @param {Object} handlers - Object mapping HTTP methods to handlers
 * @returns {Function} Combined handler
 */
export function apiHandler(handlers) {
  return async (req, res) => {
    const method = req.method.toUpperCase();
    
    if (!handlers[method]) {
      res.setHeader('Allow', Object.keys(handlers));
      return res.status(405).json({
        success: false,
        error: `Method ${method} not allowed`,
        code: 'METHOD_NOT_ALLOWED'
      });
    }
    
    try {
      return await handlers[method](req, res);
    } catch (error) {
      console.error(`API Error [${method}]:`, error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'SERVER_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };
}
