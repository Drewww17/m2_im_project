/**
 * Inventory API Routes
 * Stock management, alerts, and inventory views
 */
import prisma from '@/lib/prisma';
import { withCashier, withClerk, apiHandler } from '@/middleware/withAuth';
import { paginate, paginationMeta, parseDecimal, daysUntilExpiration, isExpiringSoon, isExpired } from '@/lib/utils';

/**
 * GET /api/inventory
 * List inventory with stock levels and alerts
 */
async function getInventory(req, res) {
  const { page, pageSize, productId, lowStock, expiringSoon, expired } = req.query;
  const { skip, take, page: currentPage, pageSize: size } = paginate(page, pageSize);
  
  try {
    // Build where clause
    const where = { is_active: true };
    
    if (productId) {
      where.product_id = parseInt(productId);
    }
    
    // Get inventory with product info
    const inventory = await prisma.inventory.findMany({
      where,
      include: {
        products: {
          select: {
            product_id: true,
            product_code: true,
            product_name: true,
            unit: true,
            reorder_level: true,
            category: true,
            unit_price: true
          }
        }
      },
      orderBy: [
        { expiration_date: 'asc' }
      ]
    });
    
    // Format and add status flags
    let formattedInventory = inventory.map(inv => {
      const daysToExpire = inv.expiration_date ? daysUntilExpiration(inv.expiration_date) : null;
      
      return {
        inventory_id: inv.inventory_id,
        product: inv.products,
        batch_number: inv.batch_number,
        current_stock: inv.current_stock,
        expiration_date: inv.expiration_date,
        days_to_expiration: daysToExpire,
        is_expiring_soon: inv.expiration_date ? isExpiringSoon(inv.expiration_date) : false,
        is_expired: inv.expiration_date ? isExpired(inv.expiration_date) : false,
        is_low_stock: inv.current_stock <= inv.products.reorder_level,
        value: inv.current_stock * parseDecimal(inv.products.unit_price)
      };
    });
    
    // Apply filters
    if (lowStock === 'true') {
      formattedInventory = formattedInventory.filter(inv => inv.is_low_stock);
    }
    
    if (expiringSoon === 'true') {
      formattedInventory = formattedInventory.filter(inv => inv.is_expiring_soon);
    }
    
    if (expired === 'true') {
      formattedInventory = formattedInventory.filter(inv => inv.is_expired);
    }
    
    // Paginate
    const total = formattedInventory.length;
    const paginatedInventory = formattedInventory.slice(skip, skip + take);
    
    return res.status(200).json({
      success: true,
      inventory: paginatedInventory,
      pagination: paginationMeta(total, currentPage, size)
    });
  } catch (error) {
    console.error('Get inventory error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch inventory'
    });
  }
}

/**
 * POST /api/inventory
 * Add new inventory record (for manual additions)
 */
async function addInventory(req, res) {
  const { productId, quantity, batchNumber, expirationDate, location, notes } = req.body;
  
  if (!productId || !quantity) {
    return res.status(400).json({
      success: false,
      error: 'Product ID and quantity are required'
    });
  }
  
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Create inventory record
      const inventory = await tx.inventory.create({
        data: {
          product_id: productId,
          current_stock: parseInt(quantity),
          batch_number: batchNumber || null,
          expiration_date: expirationDate ? new Date(expirationDate) : null
        },
        include: {
          products: {
            select: { product_name: true, product_code: true }
          }
        }
      });
      
      // Log the stock addition
      await tx.stock_log.create({
        data: {
          product_id: productId,
          change_type: 'ADJUSTMENT',
          quantity: parseInt(quantity),
          reason: notes || `Manual inventory addition - Batch: ${batchNumber || 'N/A'}`,
          employee_id: req.user.userId
        }
      });
      
      return inventory;
    });
    
    return res.status(201).json({
      success: true,
      inventory: result
    });
  } catch (error) {
    console.error('Add inventory error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to add inventory'
    });
  }
}

export default apiHandler({
  GET: withCashier(getInventory),
  POST: withClerk(addInventory)
});
