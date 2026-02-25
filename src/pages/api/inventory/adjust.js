/**
 * Stock Adjustment API Route
 * Manager-only manual stock adjustments
 */
import prisma from '@/lib/prisma';
import { withManager, apiHandler } from '@/middleware/withAuth';

/**
 * POST /api/inventory/adjust
 * Manual stock adjustment with reason logging
 */
async function adjustStock(req, res) {
  const { inventoryId, productId, adjustmentType, quantity, reason } = req.body;
  
  if (!quantity || !reason) {
    return res.status(400).json({
      success: false,
      error: 'Quantity and reason are required'
    });
  }
  
  if (!inventoryId && !productId) {
    return res.status(400).json({
      success: false,
      error: 'Either inventoryId or productId is required'
    });
  }
  
  const adjustmentQty = adjustmentType === 'DECREASE' ? -Math.abs(quantity) : Math.abs(quantity);
  
  try {
    const result = await prisma.$transaction(async (tx) => {
      let inventory;
      
      if (inventoryId) {
        // Adjust specific inventory record
        inventory = await tx.inventory.findUnique({
          where: { inventory_id: inventoryId },
          include: { products: true }
        });
        
        if (!inventory) {
          throw new Error('Inventory record not found');
        }
        
        const newQuantity = inventory.current_stock + adjustmentQty;
        if (newQuantity < 0) {
          throw new Error(`Cannot reduce stock below 0. Current: ${inventory.current_stock}`);
        }
        
        await tx.inventory.update({
          where: { inventory_id: inventoryId },
          data: { current_stock: newQuantity }
        });
        
      } else {
        // Adjust product's primary inventory or create new
        inventory = await tx.inventory.findFirst({
          where: {
            product_id: productId,
            is_active: true
          },
          include: { products: true }
        });
        
        if (inventory) {
          const newQuantity = inventory.current_stock + adjustmentQty;
          if (newQuantity < 0) {
            throw new Error(`Cannot reduce stock below 0. Current: ${inventory.current_stock}`);
          }
          
          await tx.inventory.update({
            where: { inventory_id: inventory.inventory_id },
            data: { current_stock: newQuantity }
          });
        } else {
          if (adjustmentQty < 0) {
            throw new Error('Cannot decrease stock - no inventory record exists');
          }
          
          const product = await tx.products.findUnique({
            where: { product_id: productId }
          });
          
          if (!product) {
            throw new Error('Product not found');
          }
          
          inventory = await tx.inventory.create({
            data: {
              product_id: productId,
              current_stock: adjustmentQty
            },
            include: { products: true }
          });
        }
      }
      
      // Log the adjustment
      await tx.stock_log.create({
        data: {
          product_id: inventory.product_id,
          change_type: 'ADJUSTMENT',
          quantity: adjustmentQty,
          reason: `Manual adjustment by manager: ${reason}`,
          employee_id: req.user.userId
        }
      });
      
      return {
        product: inventory.products,
        adjustment: adjustmentQty,
        reason
      };
    });
    
    return res.status(200).json({
      success: true,
      message: 'Stock adjustment recorded successfully',
      adjustment: result
    });
  } catch (error) {
    console.error('Stock adjustment error:', error);
    return res.status(400).json({
      success: false,
      error: error.message || 'Failed to adjust stock'
    });
  }
}

export default apiHandler({
  POST: withManager(adjustStock)
});
