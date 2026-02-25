/**
 * Single Product API Routes
 */
import prisma from '@/lib/prisma';
import { withCashier, withClerk, withManager, apiHandler } from '@/middleware/withAuth';
import { parseDecimal } from '@/lib/utils';

/**
 * GET /api/products/[id]
 * Get product details with stock movement history
 */
async function getProduct(req, res) {
  const { id } = req.query;
  
  try {
    const product = await prisma.products.findUnique({
      where: { product_id: parseInt(id) },
      include: {
        suppliers: true,
        inventory: {
          where: { is_active: true },
          orderBy: { expiration_date: 'asc' }
        },
        stock_log: {
          orderBy: { log_date: 'desc' },
          take: 50
        }
      }
    });
    
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }
    
    const totalStock = product.inventory.reduce((sum, inv) => sum + (inv.current_stock || 0), 0);
    
    return res.status(200).json({
      success: true,
      product: {
        ...product,
        unit_price: parseDecimal(product.unit_price),
        srp: parseDecimal(product.srp),
        dealer_price: parseDecimal(product.dealer_price),
        total_stock: totalStock,
        is_low_stock: totalStock <= (product.reorder_level || 0)
      }
    });
  } catch (error) {
    console.error('Get product error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch product'
    });
  }
}

/**
 * PUT /api/products/[id]
 * Update product information
 */
async function updateProduct(req, res) {
  const { id } = req.query;
  const updateData = req.body;
  
  try {
    const product = await prisma.products.update({
      where: { product_id: parseInt(id) },
      data: {
        ...(updateData.productName && { product_name: updateData.productName }),
        ...(updateData.barcode !== undefined && { barcode: updateData.barcode }),
        ...(updateData.description !== undefined && { description: updateData.description }),
        ...(updateData.category !== undefined && { category: updateData.category }),
        ...(updateData.unit && { unit: updateData.unit }),
        ...(updateData.unitPrice !== undefined && { unit_price: updateData.unitPrice }),
        ...(updateData.srp !== undefined && { srp: updateData.srp }),
        ...(updateData.dealerPrice !== undefined && { dealer_price: updateData.dealerPrice }),
        ...(updateData.reorderLevel !== undefined && { reorder_level: updateData.reorderLevel }),
        ...(updateData.supplierId !== undefined && { supplier_id: updateData.supplierId }),
        ...(updateData.brand !== undefined && { brand: updateData.brand })
      }
    });
    
    return res.status(200).json({
      success: true,
      product: {
        ...product,
        unit_price: parseDecimal(product.unit_price),
        srp: parseDecimal(product.srp),
        dealer_price: parseDecimal(product.dealer_price)
      }
    });
  } catch (error) {
    console.error('Update product error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update product'
    });
  }
}

/**
 * DELETE /api/products/[id]
 * Soft delete a product
 */
async function deleteProduct(req, res) {
  const { id } = req.query;
  
  try {
    await prisma.products.update({
      where: { product_id: parseInt(id) },
      data: { is_active: false }
    });
    
    return res.status(200).json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    console.error('Delete product error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete product'
    });
  }
}

export default apiHandler({
  GET: withCashier(getProduct),
  PUT: withClerk(updateProduct),
  DELETE: withManager(deleteProduct)
});
