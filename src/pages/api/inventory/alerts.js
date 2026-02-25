/**
 * Stock Alerts API Route
 * Get low stock and expiring product alerts
 */
import prisma from '@/lib/prisma';
import { withCashier, apiHandler } from '@/middleware/withAuth';
import { parseDecimal, daysUntilExpiration } from '@/lib/utils';

async function getAlerts(req, res) {
  try {
    // Get all active inventory with product details
    const inventory = await prisma.inventory.findMany({
      where: { is_active: true },
      include: {
        products: {
          select: {
            product_id: true,
            product_code: true,
            product_name: true,
            unit: true,
            reorder_level: true,
            category: true
          }
        }
      }
    });
    
    // Aggregate stock by product
    const stockByProduct = {};
    inventory.forEach(inv => {
      const pid = inv.product_id;
      if (!stockByProduct[pid]) {
        stockByProduct[pid] = {
          product: inv.products,
          total_quantity: 0,
          batches: []
        };
      }
      stockByProduct[pid].total_quantity += inv.current_stock;
      stockByProduct[pid].batches.push({
        inventory_id: inv.inventory_id,
        current_stock: inv.current_stock,
        batch_number: inv.batch_number,
        expiration_date: inv.expiration_date,
        days_to_expiration: inv.expiration_date ? daysUntilExpiration(inv.expiration_date) : null
      });
    });
    
    // Find low stock items
    const lowStockAlerts = Object.values(stockByProduct)
      .filter(item => item.total_quantity <= item.product.reorder_level)
      .map(item => ({
        product_id: item.product.product_id,
        product_code: item.product.product_code,
        product_name: item.product.product_name,
        category: item.product.category,
        unit: item.product.unit,
        current_stock: item.total_quantity,
        reorder_level: item.product.reorder_level,
        shortage: item.product.reorder_level - item.total_quantity
      }))
      .sort((a, b) => a.shortage - b.shortage);
    
    // Find expiring items (within 30 days)
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    const expiringAlerts = inventory
      .filter(inv => 
        inv.expiration_date && 
        new Date(inv.expiration_date) <= thirtyDaysFromNow &&
        inv.current_stock > 0
      )
      .map(inv => ({
        inventory_id: inv.inventory_id,
        product_id: inv.products.product_id,
        product_code: inv.products.product_code,
        product_name: inv.products.product_name,
        batch_number: inv.batch_number,
        current_stock: inv.current_stock,
        expiration_date: inv.expiration_date,
        days_to_expiration: daysUntilExpiration(inv.expiration_date),
        is_expired: daysUntilExpiration(inv.expiration_date) < 0
      }))
      .sort((a, b) => a.days_to_expiration - b.days_to_expiration);
    
    // Find out of stock items
    const outOfStockAlerts = Object.values(stockByProduct)
      .filter(item => item.total_quantity === 0)
      .map(item => ({
        product_id: item.product.product_id,
        product_code: item.product.product_code,
        product_name: item.product.product_name,
        category: item.product.category
      }));
    
    return res.status(200).json({
      success: true,
      alerts: {
        low_stock: {
          count: lowStockAlerts.length,
          items: lowStockAlerts
        },
        expiring_soon: {
          count: expiringAlerts.filter(a => !a.is_expired).length,
          items: expiringAlerts.filter(a => !a.is_expired)
        },
        expired: {
          count: expiringAlerts.filter(a => a.is_expired).length,
          items: expiringAlerts.filter(a => a.is_expired)
        },
        out_of_stock: {
          count: outOfStockAlerts.length,
          items: outOfStockAlerts
        }
      },
      summary: {
        total_alerts: lowStockAlerts.length + expiringAlerts.length + outOfStockAlerts.length,
        critical: outOfStockAlerts.length + expiringAlerts.filter(a => a.is_expired).length
      }
    });
  } catch (error) {
    console.error('Get alerts error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch alerts'
    });
  }
}

export default apiHandler({
  GET: withCashier(getAlerts)
});
