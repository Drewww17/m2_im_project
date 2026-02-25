/**
 * Bulk Conversion API Route
 * Convert bulk products to retail units
 * Example: 1 sack (50kg) → 50 retail packs (1kg each)
 */
import prisma from '@/lib/prisma';
import { withClerk, apiHandler } from '@/middleware/withAuth';
import { parseDecimal } from '@/lib/utils';

/**
 * POST /api/inventory/convert
 * Convert bulk product to retail units
 */
async function convertBulk(req, res) {
  const { 
    sourceProductId,   // Bulk product (e.g., sack)
    targetProductId,   // Retail product (e.g., retail pack)
    sourceQuantity,    // Number of bulk units to convert (e.g., 2 sacks)
    notes
  } = req.body;
  
  if (!sourceProductId || !targetProductId || !sourceQuantity) {
    return res.status(400).json({
      success: false,
      error: 'Source product, target product, and quantity are required'
    });
  }
  
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Get source product (bulk)
      const sourceProduct = await tx.products.findUnique({
        where: { product_id: sourceProductId },
        include: {
          inventory: {
            where: { is_active: true, current_stock: { gt: 0 } },
            orderBy: { expiration_date: 'asc' }
          }
        }
      });
      
      if (!sourceProduct) {
        throw new Error('Source product not found');
      }
      
      // Get target product (retail)
      const targetProduct = await tx.products.findUnique({
        where: { product_id: targetProductId }
      });
      
      if (!targetProduct) {
        throw new Error('Target product not found');
      }
      
      // Calculate conversion ratio
      // If target has conversion_ratio set, use it; otherwise default to 1:1
      const conversionRatio = targetProduct.quantity_per_case || 1;
      
      // Calculate quantities
      const totalSourceStock = sourceProduct.inventory.reduce((sum, inv) => sum + inv.current_stock, 0);
      
      if (totalSourceStock < sourceQuantity) {
        throw new Error(`Insufficient source stock. Available: ${totalSourceStock}, Requested: ${sourceQuantity}`);
      }
      
      const targetQuantityToAdd = sourceQuantity * conversionRatio;
      
      // Deduct from source inventory (FIFO)
      let remainingToDeduct = sourceQuantity;
      for (const inv of sourceProduct.inventory) {
        if (remainingToDeduct <= 0) break;
        
        const deductQty = Math.min(remainingToDeduct, inv.current_stock);
        await tx.inventory.update({
          where: { inventory_id: inv.inventory_id },
          data: { current_stock: inv.current_stock - deductQty }
        });
        remainingToDeduct -= deductQty;
      }
      
      // Add to target inventory
      // Check if target inventory exists, if not create one
      let targetInventory = await tx.inventory.findFirst({
        where: {
          product_id: targetProductId,
          is_active: true
        }
      });
      
      if (targetInventory) {
        await tx.inventory.update({
          where: { inventory_id: targetInventory.inventory_id },
          data: { current_stock: { increment: targetQuantityToAdd } }
        });
      } else {
        targetInventory = await tx.inventory.create({
          data: {
            product_id: targetProductId,
            current_stock: targetQuantityToAdd
          }
        });
      }
      
      // Log stock movements
      await tx.stock_log.create({
        data: {
          product_id: sourceProductId,
          change_type: 'CONVERSION',
          quantity: -sourceQuantity,
          reason: `Converted to ${targetProduct.product_name} (${targetQuantityToAdd} ${targetProduct.unit})`,
          employee_id: req.user.userId
        }
      });
      
      await tx.stock_log.create({
        data: {
          product_id: targetProductId,
          change_type: 'CONVERSION',
          quantity: targetQuantityToAdd,
          reason: `Converted from ${sourceProduct.product_name} (${sourceQuantity} ${sourceProduct.unit})`,
          employee_id: req.user.userId
        }
      });
      
      return {
        sourceProduct: {
          id: sourceProduct.product_id,
          name: sourceProduct.product_name,
          unit: sourceProduct.unit,
          quantity_deducted: sourceQuantity
        },
        targetProduct: {
          id: targetProduct.product_id,
          name: targetProduct.product_name,
          unit: targetProduct.unit,
          quantity_added: targetQuantityToAdd
        },
        conversion_ratio: conversionRatio
      };
    });
    
    return res.status(200).json({
      success: true,
      message: 'Bulk conversion completed successfully',
      conversion: result
    });
  } catch (error) {
    console.error('Bulk conversion error:', error);
    return res.status(400).json({
      success: false,
      error: error.message || 'Failed to convert bulk product'
    });
  }
}

export default apiHandler({
  POST: withClerk(convertBulk)
});
