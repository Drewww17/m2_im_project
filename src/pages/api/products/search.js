/**
 * Product Search API Route
 * Fast product lookup for POS barcode scanning
 */
import prisma from '@/lib/prisma';
import { withCashier, apiHandler } from '@/middleware/withAuth';
import { parseDecimal } from '@/lib/utils';

/**
 * GET /api/products/search
 * Quick search by barcode or product code
 */
async function searchProducts(req, res) {
  const { q, barcode, limit = 10 } = req.query;
  
  try {
    let where = { is_active: true };
    
    // Barcode exact match takes priority
    if (barcode) {
      where.OR = [
        { barcode },
        { product_code: barcode }
      ];
    } else if (q) {
      // Text search
      const searchTerm = q.trim();
      where.OR = [
        { product_name: { contains: searchTerm } },
        { product_code: { contains: searchTerm } },
        { barcode: { contains: searchTerm } }
      ];
    } else {
      return res.status(400).json({
        success: false,
        error: 'Search query (q) or barcode required'
      });
    }
    
    const products = await prisma.products.findMany({
      where,
      take: parseInt(limit),
      include: {
        inventory: {
          where: { is_active: true, current_stock: { gt: 0 } },
          select: {
            inventory_id: true,
            current_stock: true,
            batch_number: true,
            expiration_date: true
          },
          orderBy: { expiration_date: 'asc' } // FIFO - first expiring first
        }
      }
    });
    
    // Format with stock info
    const formattedProducts = products.map(product => {
      const totalStock = product.inventory.reduce((sum, inv) => sum + (inv.current_stock || 0), 0);
      
      return {
        product_id: product.product_id,
        product_code: product.product_code,
        barcode: product.barcode,
        product_name: product.product_name,
        unit: product.unit,
        selling_price: parseDecimal(product.srp),
        total_stock: totalStock,
        in_stock: totalStock > 0,
        inventory: product.inventory
      };
    });
    
    return res.status(200).json({
      success: true,
      products: formattedProducts,
      count: formattedProducts.length
    });
  } catch (error) {
    console.error('Search products error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to search products'
    });
  }
}

export default apiHandler({
  GET: withCashier(searchProducts)
});
