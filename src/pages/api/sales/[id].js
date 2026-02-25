/**
 * Single Sale API Routes
 * Get sale details, void sale
 */
import prisma from '@/lib/prisma';
import { withCashier, withManager, apiHandler } from '@/middleware/withAuth';
import { parseDecimal } from '@/lib/utils';

/**
 * GET /api/sales/[id]
 * Get complete sale details for receipt printing
 */
async function getSale(req, res) {
  const { id } = req.query;
  
  try {
    const sale = await prisma.sales.findUnique({
      where: { sale_id: parseInt(id) },
      include: {
        customers: true,
        employees: {
          select: { employee_id: true, employee_name: true }
        },
        sale_details: {
          include: {
            products: {
              select: {
                product_id: true,
                product_code: true,
                product_name: true,
                unit: true,
                barcode: true
              }
            }
          }
        }
      }
    });
    
    if (!sale) {
      return res.status(404).json({
        success: false,
        error: 'Sale not found'
      });
    }
    
    // Format for receipt
    const formattedSale = {
      ...sale,
      total_amount: parseDecimal(sale.total_amount),
      amount_paid: parseDecimal(sale.amount_paid),
      sale_details: sale.sale_details.map(detail => ({
        ...detail,
        unit_price: parseDecimal(detail.unit_price)
      })),
      customer: sale.customers ? {
        ...sale.customers,
        credit_limit: parseDecimal(sale.customers.credit_limit),
        credit_balance: parseDecimal(sale.customers.credit_balance)
      } : null
    };
    
    return res.status(200).json({
      success: true,
      sale: formattedSale
    });
  } catch (error) {
    console.error('Get sale error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch sale'
    });
  }
}

/**
 * DELETE /api/sales/[id]
 * Void a sale (Manager only)
 * Restores inventory
 */
async function voidSale(req, res) {
  const { id } = req.query;
  const { reason } = req.body;
  
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Get sale with details
      const sale = await tx.sales.findUnique({
        where: { sale_id: parseInt(id) },
        include: { sale_details: true }
      });
      
      if (!sale) {
        throw new Error('Sale not found');
      }
      
      if (!sale.is_active) {
        throw new Error('Sale is already voided');
      }
      
      // Restore inventory for each item
      for (const detail of sale.sale_details) {
        // Find or create inventory record
        const inventory = await tx.inventory.findFirst({
          where: {
            product_id: detail.product_id,
            is_active: true
          }
        });
        
        if (inventory) {
          await tx.inventory.update({
            where: { inventory_id: inventory.inventory_id },
            data: { current_stock: { increment: detail.quantity } }
          });
        } else {
          await tx.inventory.create({
            data: {
              product_id: detail.product_id,
              current_stock: detail.quantity
            }
          });
        }
        
        // Log stock restoration
        await tx.stock_log.create({
          data: {
            product_id: detail.product_id,
            change_type: 'RETURN',
            quantity: detail.quantity,
            reason: `Void sale #${sale.sale_id}: ${reason || 'No reason provided'}`,
            log_date: new Date(),
            employee_id: null
          }
        });
      }
      
      // If customer had credit, reverse it
      if (sale.customer_id && sale.sale_status !== 'PAID') {
        const creditAmount = parseDecimal(sale.total_amount) - parseDecimal(sale.amount_paid);
        
        await tx.customers.update({
          where: { customer_id: sale.customer_id },
          data: {
            credit_balance: { decrement: creditAmount }
          }
        });
        
        // Create reversal ledger entry
        await tx.account_ledger.create({
          data: {
            account_type: 'customer',
            account_id: sale.customer_id,
            reference_type: 'VOID_SALE',
            reference_id: sale.sale_id,
            debit: 0,
            credit: creditAmount
          }
        });
      }
      
      // Soft delete the sale
      await tx.sales.update({
        where: { sale_id: parseInt(id) },
        data: {
          is_active: false
        }
      });
      
      return sale;
    });
    
    return res.status(200).json({
      success: true,
      message: `Sale #${result.sale_id} voided successfully`
    });
  } catch (error) {
    console.error('Void sale error:', error);
    return res.status(400).json({
      success: false,
      error: error.message || 'Failed to void sale'
    });
  }
}

export default apiHandler({
  GET: withCashier(getSale),
  DELETE: withManager(voidSale)
});
