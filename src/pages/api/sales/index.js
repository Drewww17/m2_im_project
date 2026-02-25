/**
 * Sales API Routes
 * POS Sales creation and management
 * NOTE: Stock reduction is handled by database triggers - DO NOT duplicate logic here
 */
import prisma from '@/lib/prisma';
import { withCashier, withManager, apiHandler } from '@/middleware/withAuth';
import { paginate, paginationMeta, generateInvoiceNumber, parseDecimal } from '@/lib/utils';

/**
 * GET /api/sales
 * List sales with filters
 */
async function getSales(req, res) {
  const { page, pageSize, startDate, endDate, customerId, cashierId, paymentStatus } = req.query;
  const { skip, take, page: currentPage, pageSize: size } = paginate(page, pageSize);
  
  try {
    // Build where clause
    const where = { is_active: true };
    
    if (startDate || endDate) {
      where.sale_date = {};
      if (startDate) where.sale_date.gte = new Date(startDate);
      if (endDate) where.sale_date.lte = new Date(endDate);
    }
    
    if (customerId) where.customer_id = parseInt(customerId);
    if (cashierId) where.employee_id = parseInt(cashierId);
    if (paymentStatus) where.sale_status = paymentStatus;
    
    const [sales, total] = await Promise.all([
      prisma.sales.findMany({
        where,
        skip,
        take,
        orderBy: { sale_date: 'desc' },
        include: {
          customers: {
            select: { customer_id: true, customer_name: true, customer_type: true }
          },
          employees: {
            select: { employee_id: true, employee_name: true }
          },
          sale_details: {
            include: {
              products: {
                select: { product_id: true, product_name: true, product_code: true, unit: true }
              }
            }
          }
        }
      }),
      prisma.sales.count({ where })
    ]);
    
    // Format decimal values
    const formattedSales = sales.map(sale => ({
      ...sale,
      total_amount: parseDecimal(sale.total_amount),
      amount_paid: parseDecimal(sale.amount_paid),
      sale_details: sale.sale_details.map(detail => ({
        ...detail,
        unit_price: parseDecimal(detail.unit_price)
      }))
    }));
    
    return res.status(200).json({
      success: true,
      sales: formattedSales,
      pagination: paginationMeta(total, currentPage, size)
    });
  } catch (error) {
    console.error('Get sales error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch sales'
    });
  }
}

/**
 * POST /api/sales
 * Create a new sale (POS transaction)
 * Stock validation happens at DB level via triggers
 */
async function createSale(req, res) {
  const {
    customerId,
    items, // Array of { productId, quantity, unitPrice, discount }
    discount = 0,
    tax = 0,
    amountPaid,
    paymentMethod, // CASH, CREDIT, MIXED
    notes
  } = req.body;
  
  // Validate items
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'At least one item is required'
    });
  }
  
  try {
    // Use transaction to ensure ACID compliance
    const result = await prisma.$transaction(async (tx) => {
      // Calculate totals
      let subtotal = 0;
      const saleDetails = [];
      
      for (const item of items) {
        // Get product info to verify pricing
        const product = await tx.products.findUnique({
          where: { product_id: item.productId },
          include: {
            inventory: {
              where: { is_active: true, current_stock: { gt: 0 } },
              orderBy: { expiration_date: 'asc' }
            }
          }
        });
        
        if (!product) {
          throw new Error(`Product ${item.productId} not found`);
        }
        
        // Calculate total available stock
        const totalStock = product.inventory.reduce((sum, inv) => sum + inv.current_stock, 0);
        
        if (totalStock < item.quantity) {
          throw new Error(`Insufficient stock for ${product.product_name}. Available: ${totalStock}, Requested: ${item.quantity}`);
        }
        
        const unitPrice = item.unitPrice || parseDecimal(product.unit_price);
        const itemSubtotal = (item.quantity * unitPrice);
        
        subtotal += itemSubtotal;
        
        saleDetails.push({
          product_id: item.productId,
          quantity: item.quantity,
          unit_price: unitPrice
        });
        
        // Deduct from inventory (FIFO - first expiring first)
        let remainingQty = item.quantity;
        for (const inv of product.inventory) {
          if (remainingQty <= 0) break;
          
          const deductQty = Math.min(remainingQty, inv.current_stock);
          await tx.inventory.update({
            where: { inventory_id: inv.inventory_id },
            data: { current_stock: inv.current_stock - deductQty }
          });
          remainingQty -= deductQty;
        }
      }
      
      const totalAmount = subtotal;
      const paidAmount = amountPaid || totalAmount;
      
      // Determine sale status
      let saleStatus = 'PAID';
      if (paidAmount < totalAmount) {
        saleStatus = paidAmount > 0 ? 'PARTIAL' : 'UNPAID';
      }
      
      // Create the sale
      const sale = await tx.sales.create({
        data: {
          sale_date: new Date(),
          customer_id: customerId || null,
          employee_id: null,
          total_amount: totalAmount,
          amount_paid: paidAmount,
          payment_method: paymentMethod || 'CASH',
          sale_status: saleStatus,
          sale_details: {
            create: saleDetails
          }
        },
        include: {
          sale_details: {
            include: {
              products: {
                select: { product_id: true, product_name: true, product_code: true, unit: true }
              }
            }
          },
          customers: true,
          employees: {
            select: { employee_id: true, employee_name: true }
          }
        }
      });
      
      // Log stock movements
      for (const detail of saleDetails) {
        await tx.stock_log.create({
          data: {
            product_id: detail.product_id,
            change_type: 'SALE',
            quantity: -detail.quantity,
            reason: `Sale #${sale.sale_id}`,
            log_date: new Date(),
            employee_id: null
          }
        });
      }
      
      // If customer exists and has outstanding balance (credit sale)
      if (customerId && saleStatus !== 'PAID') {
        const creditAmount = totalAmount - paidAmount;
        
        // Update customer credit balance
        await tx.customers.update({
          where: { customer_id: customerId },
          data: {
            credit_balance: {
              increment: creditAmount
            }
          }
        });
        
        // Create ledger entry
        await tx.account_ledger.create({
          data: {
            account_type: 'customer',
            account_id: customerId,
            reference_type: 'SALE',
            reference_id: sale.sale_id,
            debit: creditAmount,
            credit: 0
          }
        });
      }
      
      // Create transaction record
      await tx.agrivet_transactions.create({
        data: {
          ref_id: String(sale.sale_id),
          transaction_date: new Date(),
          transaction_type: 'SALE',
          account_name: customerId ? `Customer #${customerId}` : 'Walk-in',
          amount: totalAmount,
          remarks: `Sale #${sale.sale_id}`
        }
      });
      
      return sale;
    });
    
    // Format response
    const formattedSale = {
      ...result,
      total_amount: parseDecimal(result.total_amount),
      amount_paid: parseDecimal(result.amount_paid),
      sale_details: result.sale_details.map(detail => ({
        ...detail,
        unit_price: parseDecimal(detail.unit_price)
      }))
    };
    
    return res.status(201).json({
      success: true,
      sale: formattedSale
    });
  } catch (error) {
    console.error('Create sale error:', error);
    return res.status(400).json({
      success: false,
      error: error.message || 'Failed to create sale'
    });
  }
}

export default apiHandler({
  GET: withCashier(getSales),
  POST: withCashier(createSale)
});
