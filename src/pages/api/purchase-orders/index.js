/**
 * Purchase Orders API Routes
 * Create and manage purchase orders
 * NOTE: Stock increases are handled by database triggers on delivery
 */
import prisma from '@/lib/prisma';
import { withClerk, apiHandler } from '@/middleware/withAuth';
import { paginate, paginationMeta, parseDecimal } from '@/lib/utils';

/**
 * GET /api/purchase-orders
 * List purchase orders
 */
async function getPurchaseOrders(req, res) {
  const { page, pageSize, customerId, poStatus, startDate, endDate } = req.query;
  const { skip, take, page: currentPage, pageSize: size } = paginate(page, pageSize);
  
  try {
    const where = {};
    
    if (customerId) where.customer_id = parseInt(customerId);
    if (poStatus) where.po_status = poStatus;
    
    if (startDate || endDate) {
      where.order_date = {};
      if (startDate) where.order_date.gte = new Date(startDate);
      if (endDate) where.order_date.lte = new Date(endDate);
    }
    
    const [orders, total] = await Promise.all([
      prisma.purchase_orders.findMany({
        where,
        skip,
        take,
        orderBy: { order_date: 'desc' },
        include: {
          customers: {
            select: { customer_id: true, customer_name: true }
          },
          purchase_order_details: {
            include: {
              products: {
                select: { product_id: true, product_name: true, product_code: true, unit: true }
              }
            }
          }
        }
      }),
      prisma.purchase_orders.count({ where })
    ]);
    
    const formattedOrders = orders.map(order => ({
      ...order,
      outstanding_balance: parseDecimal(order.outstanding_balance),
      purchase_order_details: order.purchase_order_details.map(detail => ({
        ...detail
      }))
    }));
    
    return res.status(200).json({
      success: true,
      orders: formattedOrders,
      pagination: paginationMeta(total, currentPage, size)
    });
  } catch (error) {
    console.error('Get purchase orders error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch purchase orders'
    });
  }
}

/**
 * POST /api/purchase-orders
 * Create a new purchase order
 */
async function createPurchaseOrder(req, res) {
  const {
    customerId,
    items, // Array of { productId, quantity }
    outstandingBalance = 0,
    remarks
  } = req.body;
  
  if (!customerId || !items || items.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Customer ID and items are required'
    });
  }
  
  try {
    const result = await prisma.$transaction(async (tx) => {
      const orderDetails = [];
      
      for (const item of items) {
        const product = await tx.products.findUnique({
          where: { product_id: item.productId }
        });
        
        if (!product) {
          throw new Error(`Product ${item.productId} not found`);
        }
        
        orderDetails.push({
          product_id: item.productId,
          quantity: item.quantity
        });
      }
      
      // Create purchase order
      const order = await tx.purchase_orders.create({
        data: {
          customer_id: customerId,
          order_date: new Date(),
          po_status: 'PENDING',
          outstanding_balance: outstandingBalance,
          handled_by: req.user.userId,
          remarks,
          purchase_order_details: {
            create: orderDetails
          }
        },
        include: {
          customers: true,
          purchase_order_details: {
            include: {
              products: {
                select: { product_id: true, product_name: true, product_code: true, unit: true }
              }
            }
          }
        }
      });
      
      // Create ledger entry
      await tx.account_ledger.create({
        data: {
          account_type: 'customer',
          account_id: customerId,
          reference_type: 'PURCHASE_ORDER',
          reference_id: order.po_id,
          debit: outstandingBalance,
          credit: 0,
          created_at: new Date()
        }
      });
      
      return order;
    });
    
    return res.status(201).json({
      success: true,
      order: {
        ...result,
        outstanding_balance: parseDecimal(result.outstanding_balance)
      }
    });
  } catch (error) {
    console.error('Create purchase order error:', error);
    return res.status(400).json({
      success: false,
      error: error.message || 'Failed to create purchase order'
    });
  }
}

export default apiHandler({
  GET: withClerk(getPurchaseOrders),
  POST: withClerk(createPurchaseOrder)
});
