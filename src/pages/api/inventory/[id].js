/**
 * Individual Inventory API Routes
 * GET, PUT, DELETE operations for a specific inventory record
 */
import prisma from '@/lib/prisma';
import { withClerk, apiHandler } from '@/middleware/withAuth';
import { parseDecimal, daysUntilExpiration, isExpiringSoon, isExpired } from '@/lib/utils';

/**
 * GET /api/inventory/[id]
 * Get inventory record by ID
 */
async function getInventory(req, res) {
  const { id } = req.query;
  
  try {
    const inventory = await prisma.inventory.findUnique({
      where: { inventory_id: parseInt(id) },
      include: {
        products: {
          select: {
            product_id: true,
            product_code: true,
            product_name: true,
            unit: true,
            reorder_level: true,
            unit_price: true
          }
        }
      }
    });
    
    if (!inventory) {
      return res.status(404).json({
        success: false,
        error: 'Inventory record not found'
      });
    }
    
    const daysToExpire = inventory.expiration_date ? daysUntilExpiration(inventory.expiration_date) : null;
    
    return res.status(200).json({
      success: true,
      inventory: {
        inventory_id: inventory.inventory_id,
        product: inventory.products,
        batch_number: inventory.batch_number,
        current_stock: inventory.current_stock,
        expiration_date: inventory.expiration_date,
        days_to_expiration: daysToExpire,
        is_expiring_soon: inventory.expiration_date ? isExpiringSoon(inventory.expiration_date) : false,
        is_expired: inventory.expiration_date ? isExpired(inventory.expiration_date) : false,
        is_low_stock: inventory.current_stock <= inventory.products.reorder_level,
        value: inventory.current_stock * parseDecimal(inventory.products.unit_price)
      }
    });
  } catch (error) {
    console.error('Get inventory error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch inventory record'
    });
  }
}

/**
 * PUT /api/inventory/[id]
 * Update inventory record (batch number, expiration date)
 */
async function updateInventory(req, res) {
  const { id } = req.query;
  const { batchNumber, expirationDate, currentStock, notes } = req.body;
  
  try {
    const existing = await prisma.inventory.findUnique({
      where: { inventory_id: parseInt(id) },
      include: { products: { select: { product_name: true } } }
    });
    
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Inventory record not found'
      });
    }

    let parsedStock;
    if (currentStock !== undefined) {
      parsedStock = parseInt(currentStock);
      if (Number.isNaN(parsedStock) || parsedStock < 0) {
        return res.status(400).json({
          success: false,
          error: 'Stock quantity must be a non-negative number'
        });
      }
    }
    
    const result = await prisma.$transaction(async (tx) => {
      // Update inventory
      const updated = await tx.inventory.update({
        where: { inventory_id: parseInt(id) },
        data: {
          current_stock: parsedStock !== undefined ? parsedStock : existing.current_stock,
          batch_number: batchNumber !== undefined ? (batchNumber || null) : existing.batch_number,
          expiration_date: expirationDate !== undefined ? (expirationDate ? new Date(expirationDate) : null) : existing.expiration_date
        },
        include: {
          products: {
            select: {
              product_id: true,
              product_code: true,
              product_name: true,
              unit: true,
              reorder_level: true,
              unit_price: true
            }
          }
        }
      });
      
      // Log the change
      const changes = [];
      const stockDiff = parsedStock !== undefined ? parsedStock - existing.current_stock : 0;
      if (parsedStock !== undefined && parsedStock !== existing.current_stock) {
        changes.push(`Stock: ${existing.current_stock} -> ${parsedStock}`);
      }
      if (batchNumber !== undefined && batchNumber !== existing.batch_number) {
        changes.push(`Batch: ${existing.batch_number || 'N/A'} -> ${batchNumber || 'N/A'}`);
      }
      if (expirationDate !== undefined) {
        const oldDate = existing.expiration_date ? new Date(existing.expiration_date).toLocaleDateString() : 'N/A';
        const newDate = expirationDate ? new Date(expirationDate).toLocaleDateString() : 'N/A';
        if (oldDate !== newDate) {
          changes.push(`Expiry: ${oldDate} -> ${newDate}`);
        }
      }
      
      if (changes.length > 0) {
        await tx.stock_log.create({
          data: {
            product_id: updated.product_id,
            change_type: 'ADJUSTMENT',
            quantity: stockDiff,
            reason: `Inventory update: ${changes.join(', ')}${notes ? ` - ${notes}` : ''}`,
            log_date: new Date(),
            employee_id: req.user?.userId || null
          }
        });
      }
      
      return updated;
    });
    
    const daysToExpire = result.expiration_date ? daysUntilExpiration(result.expiration_date) : null;
    
    return res.status(200).json({
      success: true,
      inventory: {
        inventory_id: result.inventory_id,
        product: result.products,
        batch_number: result.batch_number,
        current_stock: result.current_stock,
        expiration_date: result.expiration_date,
        days_to_expiration: daysToExpire,
        is_expiring_soon: result.expiration_date ? isExpiringSoon(result.expiration_date) : false,
        is_expired: result.expiration_date ? isExpired(result.expiration_date) : false,
        is_low_stock: result.current_stock <= result.products.reorder_level,
        value: result.current_stock * parseDecimal(result.products.unit_price)
      },
      message: 'Inventory updated successfully'
    });
  } catch (error) {
    console.error('Update inventory error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update inventory record'
    });
  }
}

/**
 * DELETE /api/inventory/[id]
 * Deactivate inventory record
 */
async function deleteInventory(req, res) {
  const { id } = req.query;
  
  try {
    const existing = await prisma.inventory.findUnique({
      where: { inventory_id: parseInt(id) },
      include: { products: { select: { product_name: true, product_id: true } } }
    });
    
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Inventory record not found'
      });
    }
    
    await prisma.$transaction(async (tx) => {
      // Deactivate
      await tx.inventory.update({
        where: { inventory_id: parseInt(id) },
        data: { is_active: false }
      });
      
      // Log
      await tx.stock_log.create({
        data: {
          product_id: existing.product_id,
          change_type: 'ADJUSTMENT',
          quantity: -existing.current_stock,
          reason: `Inventory record deactivated (Batch: ${existing.batch_number || 'N/A'})`,
          log_date: new Date(),
          employee_id: req.user?.userId || null
        }
      });
    });
    
    return res.status(200).json({
      success: true,
      message: 'Inventory record deactivated'
    });
  } catch (error) {
    console.error('Delete inventory error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete inventory record'
    });
  }
}

export default apiHandler({
  GET: withClerk(getInventory),
  PUT: withClerk(updateInventory),
  DELETE: withClerk(deleteInventory)
});
