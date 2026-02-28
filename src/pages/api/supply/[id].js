/**
 * Individual Supply API Routes
 * GET, PUT, DELETE operations for a specific supply
 */
import prisma from '@/lib/prisma';
import { withClerk, apiHandler } from '@/middleware/withAuth';
import { parseDecimal } from '@/lib/utils';

/**
 * GET /api/supply/[id]
 * Get supply by ID with details
 */
async function getSupply(req, res) {
  const { id } = req.query;
  
  try {
    const supply = await prisma.supply.findUnique({
      where: { supply_id: parseInt(id) },
      include: {
        suppliers: {
          select: {
            supplier_id: true,
            supplier_name: true,
            contact_number: true
          }
        },
        employees: {
          select: {
            employee_id: true,
            employee_name: true
          }
        },
        supply_details: {
          include: {
            products: {
              select: {
                product_id: true,
                product_name: true,
                product_code: true,
                unit: true
              }
            }
          }
        }
      }
    });
    
    if (!supply) {
      return res.status(404).json({
        success: false,
        error: 'Supply not found'
      });
    }
    
    return res.status(200).json({
      success: true,
      supply: {
        ...supply,
        total: parseDecimal(supply.total),
        supply_details: supply.supply_details.map(d => ({
          ...d,
          unit_cost: parseDecimal(d.unit_cost)
        }))
      }
    });
  } catch (error) {
    console.error('Get supply error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch supply'
    });
  }
}

/**
 * DELETE /api/supply/[id]
 * Delete/void a supply record (reverses inventory changes)
 */
async function deleteSupply(req, res) {
  const { id } = req.query;
  
  try {
    const supply = await prisma.supply.findUnique({
      where: { supply_id: parseInt(id) },
      include: {
        supply_details: true
      }
    });
    
    if (!supply) {
      return res.status(404).json({
        success: false,
        error: 'Supply not found'
      });
    }
    
    await prisma.$transaction(async (tx) => {
      // Reverse inventory changes
      for (const detail of supply.supply_details) {
        const inventory = await tx.inventory.findFirst({
          where: {
            product_id: detail.product_id,
            is_active: true
          }
        });
        
        if (inventory) {
          await tx.inventory.update({
            where: { inventory_id: inventory.inventory_id },
            data: {
              current_stock: Math.max(0, inventory.current_stock - detail.unit_quantity)
            }
          });
        }
        
        // Create reversal stock log
        await tx.stock_log.create({
          data: {
            product_id: detail.product_id,
            change_type: 'OUT',
            quantity: detail.unit_quantity,
            reason: `Voided supply #${id}`,
            log_date: new Date()
          }
        });
      }
      
      // Reverse supplier payable
      if (supply.supplier_id) {
        await tx.suppliers.update({
          where: { supplier_id: supply.supplier_id },
          data: {
            payable_balance: { decrement: parseDecimal(supply.total) }
          }
        });
      }
      
      // Delete supply details
      await tx.supply_details.deleteMany({
        where: { supply_id: parseInt(id) }
      });
      
      // Delete supply
      await tx.supply.delete({
        where: { supply_id: parseInt(id) }
      });
    });
    
    return res.status(200).json({
      success: true,
      message: 'Supply voided successfully'
    });
  } catch (error) {
    console.error('Delete supply error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to void supply'
    });
  }
}

export default apiHandler({
  GET: withClerk(getSupply),
  DELETE: withClerk(deleteSupply)
});
