/**
 * Utility Functions for AgriVet System
 */

/**
 * Generate a unique invoice number
 * Format: INV-YYYYMMDD-XXXXX
 * @returns {string} Invoice number
 */
export function generateInvoiceNumber() {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `INV-${dateStr}-${random}`;
}

/**
 * Generate a unique PO number
 * Format: PO-YYYYMMDD-XXXXX
 * @returns {string} PO number
 */
export function generatePONumber() {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `PO-${dateStr}-${random}`;
}

/**
 * Format currency for display
 * @param {number} amount - Amount to format
 * @param {string} currency - Currency code (default: PHP)
 * @returns {string} Formatted currency string
 */
export function formatCurrency(amount, currency = 'PHP') {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: currency
  }).format(amount);
}

/**
 * Format date for display
 * @param {Date|string} date - Date to format
 * @param {Object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted date string
 */
export function formatDate(date, options = {}) {
  const defaultOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  };
  
  return new Intl.DateTimeFormat('en-PH', { ...defaultOptions, ...options })
    .format(new Date(date));
}

/**
 * Format date-time for display
 * @param {Date|string} date - Date to format
 * @returns {string} Formatted date-time string
 */
export function formatDateTime(date) {
  return formatDate(date, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Calculate days until expiration
 * @param {Date|string} expirationDate - Expiration date
 * @returns {number} Days until expiration (negative if expired)
 */
export function daysUntilExpiration(expirationDate) {
  const now = new Date();
  const expiry = new Date(expirationDate);
  const diffTime = expiry - now;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Check if a product is expiring soon (within 30 days)
 * @param {Date|string} expirationDate - Expiration date
 * @returns {boolean} True if expiring within 30 days
 */
export function isExpiringSoon(expirationDate) {
  const days = daysUntilExpiration(expirationDate);
  return days >= 0 && days <= 30;
}

/**
 * Check if a product is expired
 * @param {Date|string} expirationDate - Expiration date
 * @returns {boolean} True if expired
 */
export function isExpired(expirationDate) {
  return daysUntilExpiration(expirationDate) < 0;
}

/**
 * Paginate results
 * @param {number} page - Current page (1-indexed)
 * @param {number} pageSize - Items per page
 * @returns {Object} Skip and take values for Prisma
 */
export function paginate(page = 1, pageSize = 20) {
  const validPage = Math.max(1, parseInt(page) || 1);
  const validPageSize = Math.min(100, Math.max(1, parseInt(pageSize) || 20));
  
  return {
    skip: (validPage - 1) * validPageSize,
    take: validPageSize,
    page: validPage,
    pageSize: validPageSize
  };
}

/**
 * Create pagination metadata
 * @param {number} total - Total items
 * @param {number} page - Current page
 * @param {number} pageSize - Items per page
 * @returns {Object} Pagination metadata
 */
export function paginationMeta(total, page, pageSize) {
  const totalPages = Math.ceil(total / pageSize);
  
  return {
    total,
    page,
    pageSize,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1
  };
}

/**
 * Sanitize search input to prevent injection
 * @param {string} input - User input
 * @returns {string} Sanitized input
 */
export function sanitizeSearch(input) {
  if (!input) return '';
  return input.trim().replace(/[%_]/g, '\\$&');
}

/**
 * Parse decimal values from database
 * @param {any} value - Value to parse
 * @returns {number} Parsed number
 */
export function parseDecimal(value) {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  return parseFloat(value.toString()) || 0;
}

/**
 * Calculate subtotal for line items
 * @param {number} quantity - Item quantity
 * @param {number} unitPrice - Unit price
 * @param {number} discount - Discount amount (default: 0)
 * @returns {number} Subtotal
 */
export function calculateSubtotal(quantity, unitPrice, discount = 0) {
  return (quantity * unitPrice) - discount;
}

/**
 * Validate required fields in request body
 * @param {Object} body - Request body
 * @param {string[]} requiredFields - List of required field names
 * @returns {Object} Validation result { valid: boolean, missing: string[] }
 */
export function validateRequired(body, requiredFields) {
  const missing = requiredFields.filter(field => {
    const value = body[field];
    return value === undefined || value === null || value === '';
  });
  
  return {
    valid: missing.length === 0,
    missing
  };
}
