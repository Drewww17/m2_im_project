/**
 * Restock Alerts API Route
 * Products that need to be reordered
 */
import prisma from '@/lib/prisma';
import { withClerk, apiHandler } from '@/middleware/withAuth';
import { parseDecimal } from '@/lib/utils';

async function getRestockAlerts(req, res) {
  try {
    // Get all products with inventory
    const products = await prisma.products.findMany({
      where: { is_active: true },
      include: {
        suppliers: {
          select: { supplier_id: true, supplier_name: true, contact_number: true }
        },
        inventory: {
          where: { is_active: true }
        }
      }
    });
    
    // Calculate which products need restocking
    const restockNeeded = products
      .map(product => {
        const totalStock = product.inventory.reduce((sum, inv) => sum + inv.current_stock, 0);
        const shortage = product.reorder_level - totalStock;
        
        return {
          product_id: product.product_id,
          product_code: product.product_code,
          product_name: product.product_name,
          category: product.category,
          unit: product.unit,
          current_stock: totalStock,
          reorder_level: product.reorder_level,
          shortage,
          suggested_order_qty: Math.max(shortage, product.reorder_level * 2), // Order at least 2x reorder level
          unit_price: parseDecimal(product.unit_price),
          supplier: product.suppliers
        };
      })
      .filter(p => p.shortage > 0)
      .sort((a, b) => b.shortage - a.shortage);
    
    // Group by supplier for easy ordering
    const bySupplier = {};
    restockNeeded.forEach(product => {
      const supplierId = product.supplier?.supplier_id || 'no_supplier';
      if (!bySupplier[supplierId]) {
        bySupplier[supplierId] = {
          supplier: product.supplier || { supplier_name: 'No Supplier Assigned' },
          products: []
        };
      }
      bySupplier[supplierId].products.push(product);
    });
    
    return res.status(200).json({
      success: true,
      alerts: {
        total_products_needed: restockNeeded.length,
        estimated_cost: restockNeeded.reduce((sum, p) => 
          sum + (p.suggested_order_qty * p.unit_price), 0
        ),
        products: restockNeeded,
        by_supplier: Object.values(bySupplier)
      }
    });
  } catch (error) {
    console.error('Get restock alerts error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch restock alerts'
    });
  }
}

export default apiHandler({
  GET: withClerk(getRestockAlerts)
});
