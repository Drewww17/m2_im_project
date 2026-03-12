/**
 * Record Delivery API Route
 * Process receiving of purchase order items
 * Stock increase is recorded here (triggers may also apply)
 */
import prisma from '@/lib/prisma';
import { withClerk, apiHandler } from '@/middleware/withAuth';
import { parseDecimal } from '@/lib/utils';
import { assertBusinessDayOpen } from '@/lib/businessDay';

/**
 * POST /api/purchase-orders/[id]/receive
 * Record receipt of goods from purchase order
 */
async function receiveDelivery(req, res) {
  const { id } = req.query;
  const { 
    items, // Array of { poDetailId, quantity }
    remarks 
  } = req.body;
  
  if (!items || items.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Items to receive are required'
    });
  }
  
  try {
    const result = await prisma.$transaction(async (tx) => {
      await assertBusinessDayOpen(tx);

      const order = await tx.purchase_orders.findUnique({
        where: { po_id: parseInt(id) },
        include: { purchase_order_details: true }
      });
      
      if (!order) {
        throw new Error('Purchase order not found');
      }
      
      if (order.po_status === 'CANCELLED') {
        throw new Error('Cannot receive cancelled order');
      }
      
      for (const item of items) {
        const detail = order.purchase_order_details.find(d => d.po_detail_id === item.poDetailId);
        
        if (!detail) {
          throw new Error(`Order detail ${item.poDetailId} not found`);
        }
        
        const receiveQty = item.quantity || detail.quantity;
        
        if (receiveQty <= 0) continue;
        
        // Add to inventory
        await tx.inventory.create({
          data: {
            product_id: detail.product_id,
            current_stock: receiveQty
          }
        });
        
        // Log stock movement
        await tx.stock_log.create({
          data: {
            product_id: detail.product_id,
            change_type: 'PURCHASE',
            quantity: receiveQty,
            reason: `Received from PO #${order.po_id}`,
            log_date: new Date(),
            employee_id: req.user.userId
          }
        });
      }
      
      // Update order status
      await tx.purchase_orders.update({
        where: { po_id: order.po_id },
        data: {
          po_status: 'RECEIVED',
          remarks: remarks ? `${order.remarks || ''}\n${remarks}`.trim() : order.remarks
        }
      });

      await tx.agrivet_transactions.create({
        data: {
          ref_id: `PO-RECEIVE-${order.po_id}`,
          transaction_date: new Date(),
          transaction_type: 'PO_RECEIPT',
          account_name: `Purchase Order #${order.po_id}`,
          amount: order.purchase_order_details.reduce((sum, detail) => sum + (detail.quantity || 0), 0),
          remarks: remarks || `Received purchase order #${order.po_id}`
        }
      });
      
      return {
        po_id: order.po_id,
        po_status: 'RECEIVED',
        items_received: items.length
      };
    });
    
    return res.status(200).json({
      success: true,
      message: 'Delivery recorded successfully',
      result
    });
  } catch (error) {
    console.error('Receive delivery error:', error);
    return res.status(400).json({
      success: false,
      error: error.message || 'Failed to record delivery'
    });
  }
}

export default apiHandler({
  POST: withClerk(receiveDelivery)
});
