/**
 * Single Supplier API Routes
 */
import prisma from '@/lib/prisma';
import { withClerk, withManager, apiHandler } from '@/middleware/withAuth';
import { parseDecimal } from '@/lib/utils';

/**
 * GET /api/suppliers/[id]
 * Get supplier details with purchase history
 */
async function getSupplier(req, res) {
  const { id } = req.query;
  
  try {
    const supplier = await prisma.suppliers.findUnique({
      where: { supplier_id: parseInt(id) },
      include: {
        products: {
          where: { is_active: true },
          select: {
            product_id: true,
            product_code: true,
            product_name: true,
            unit: true,
            unit_price: true
          }
        }
      }
    });
    
    if (!supplier) {
      return res.status(404).json({
        success: false,
        error: 'Supplier not found'
      });
    }
    
    return res.status(200).json({
      success: true,
      supplier: {
        ...supplier,
        payable_balance: parseDecimal(supplier.payable_balance),
        products: supplier.products.map(p => ({
          ...p,
          unit_price: parseDecimal(p.unit_price)
        }))
      }
    });
  } catch (error) {
    console.error('Get supplier error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch supplier'
    });
  }
}

/**
 * PUT /api/suppliers/[id]
 * Update supplier
 */
async function updateSupplier(req, res) {
  const { id } = req.query;
  const { supplierName, phone } = req.body;
  
  try {
    const supplier = await prisma.suppliers.update({
      where: { supplier_id: parseInt(id) },
      data: {
        ...(supplierName && { supplier_name: supplierName }),
        ...(phone !== undefined && { contact_number: phone })
      }
    });
    
    return res.status(200).json({
      success: true,
      supplier: {
        ...supplier,
        payable_balance: parseDecimal(supplier.payable_balance)
      }
    });
  } catch (error) {
    console.error('Update supplier error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update supplier'
    });
  }
}

/**
 * DELETE /api/suppliers/[id]
 * Soft delete supplier
 */
async function deleteSupplier(req, res) {
  const { id } = req.query;
  
  try {
    await prisma.suppliers.update({
      where: { supplier_id: parseInt(id) },
      data: { is_active: false }
    });
    
    return res.status(200).json({
      success: true,
      message: 'Supplier deleted successfully'
    });
  } catch (error) {
    console.error('Delete supplier error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete supplier'
    });
  }
}

export default apiHandler({
  GET: withClerk(getSupplier),
  PUT: withClerk(updateSupplier),
  DELETE: withManager(deleteSupplier)
});
