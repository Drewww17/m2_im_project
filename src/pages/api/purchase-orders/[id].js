/**
 * Single Purchase Order API Routes
 */
import prisma from '@/lib/prisma';
import { withClerk, withManager, apiHandler } from '@/middleware/withAuth';
import { parseDecimal } from '@/lib/utils';

/**
 * GET /api/purchase-orders/[id]
 */
async function getPurchaseOrder(req, res) {
  const { id } = req.query;
  
  try {
    const order = await prisma.purchase_orders.findUnique({
      where: { po_id: parseInt(id) },
      include: {
        customers: true,
        purchase_order_details: {
          include: {
            products: {
              select: {
                product_id: true,
                product_code: true,
                product_name: true,
                unit: true,
                unit_price: true
              }
            }
          }
        }
      }
    });
    
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Purchase order not found'
      });
    }
    
    return res.status(200).json({
      success: true,
      order: {
        ...order,
        outstanding_balance: parseDecimal(order.outstanding_balance),
        purchase_order_details: order.purchase_order_details.map(d => ({
          ...d
        }))
      }
    });
  } catch (error) {
    console.error('Get purchase order error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch purchase order'
    });
  }
}

/**
 * DELETE /api/purchase-orders/[id]
 * Cancel purchase order
 */
async function cancelPurchaseOrder(req, res) {
  const { id } = req.query;
  const { reason } = req.body;
  
  try {
    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.purchase_orders.findUnique({
        where: { po_id: parseInt(id) }
      });
      
      if (!order) {
        throw new Error('Purchase order not found');
      }
      
      if (order.po_status === 'RECEIVED') {
        throw new Error('Cannot cancel a received order');
      }
      
      const amountToReverse = parseDecimal(order.outstanding_balance);
      
      // Create reversal ledger entry
      await tx.account_ledger.create({
        data: {
          account_type: 'customer',
          account_id: order.customer_id,
          reference_type: 'CANCELLED_PO',
          reference_id: order.po_id,
          debit: 0,
          credit: amountToReverse,
          created_at: new Date()
        }
      });
      
      // Update order status
      await tx.purchase_orders.update({
        where: { po_id: parseInt(id) },
        data: {
          po_status: 'CANCELLED',
          remarks: `${order.remarks || ''}\n[CANCELLED: ${reason || 'No reason'}]`.trim()
        }
      });
      
      return order;
    });
    
    return res.status(200).json({
      success: true,
      message: `Purchase order ${result.po_id} cancelled successfully`
    });
  } catch (error) {
    console.error('Cancel purchase order error:', error);
    return res.status(400).json({
      success: false,
      error: error.message || 'Failed to cancel purchase order'
    });
  }
}

export default apiHandler({
  GET: withClerk(getPurchaseOrder),
  DELETE: withManager(cancelPurchaseOrder)
});
