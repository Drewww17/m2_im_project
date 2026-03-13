/**
 * Single Customer API Routes
 * Get, update, and delete individual customers
 */
import prisma from '@/lib/prisma';
import { withClerk, withManager, apiHandler } from '@/middleware/withAuth';
import { parseDecimal } from '@/lib/utils';
import {
  getOpenPurchaseOrderBalance,
  isVipCustomer,
  normalizeCreditLimit,
  normalizeCustomerType
} from '@/lib/customerAccounts';

/**
 * GET /api/customers/[id]
 * Get customer details with transaction history
 */
async function getCustomer(req, res) {
  const { id } = req.query;
  const customerId = parseInt(id);
  
  try {
    const [customer, ledgerEntries, openPurchaseOrderBalance] = await Promise.all([
      prisma.customers.findUnique({
        where: { customer_id: customerId },
        include: {
          sales: {
            where: { is_active: true },
            orderBy: { sale_date: 'desc' },
            take: 20,
            select: {
              sale_id: true,
              sale_date: true,
              total_amount: true,
              sale_status: true,
              payment_method: true
            }
          },
          purchase_orders: {
            orderBy: { order_date: 'desc' },
            take: 10,
            select: {
              po_id: true,
              order_date: true,
              po_status: true,
              outstanding_balance: true,
              priority: true
            }
          }
        }
      }),
      prisma.account_ledger.findMany({
        where: {
          account_type: 'customer',
          account_id: customerId
        },
        orderBy: { created_at: 'desc' },
        take: 15
      }),
      getOpenPurchaseOrderBalance(prisma, customerId)
    ]);
    
    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found'
      });
    }
    
    // Format decimal values
    const creditLimit = parseDecimal(customer.credit_limit);
    const creditBalance = parseDecimal(customer.credit_balance);
    const { sales, purchase_orders, ...customerRecord } = customer;
    const totalExposure = creditBalance + openPurchaseOrderBalance;

    const formattedCustomer = {
      ...customerRecord,
      credit_limit: creditLimit,
      credit_balance: creditBalance,
      sales: sales.map((sale) => ({
        ...sale,
        total_amount: parseDecimal(sale.total_amount)
      })),
      recent_orders: purchase_orders.map((order) => ({
        ...order,
        outstanding_balance: parseDecimal(order.outstanding_balance)
      })),
      recent_ledger: ledgerEntries.map((entry) => ({
        ...entry,
        debit: parseDecimal(entry.debit),
        credit: parseDecimal(entry.credit)
      })),
      summary: {
        sale_count: sales.length,
        order_count: purchase_orders.length,
        open_po_balance: openPurchaseOrderBalance,
        total_exposure: totalExposure,
        available_credit: Math.max(0, creditLimit - totalExposure),
        account_enabled: isVipCustomer(customer.customer_type)
      }
    };
    
    return res.status(200).json({
      success: true,
      customer: formattedCustomer
    });
  } catch (error) {
    console.error('Get customer error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch customer'
    });
  }
}

/**
 * PUT /api/customers/[id]
 * Update customer information
 */
async function updateCustomer(req, res) {
  const { id } = req.query;
  const { customerName, customerType, phone, email, address, creditLimit } = req.body;
  
  try {
    const customerId = parseInt(id);
    const [existingCustomer, openPurchaseOrderBalance] = await Promise.all([
      prisma.customers.findUnique({
        where: { customer_id: customerId }
      }),
      getOpenPurchaseOrderBalance(prisma, customerId)
    ]);

    if (!existingCustomer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found'
      });
    }

    const nextCustomerType = normalizeCustomerType(customerType ?? existingCustomer.customer_type);
    const currentCustomerType = normalizeCustomerType(existingCustomer.customer_type);
    const nextCreditLimit =
      creditLimit !== undefined
        ? parseDecimal(creditLimit)
        : parseDecimal(existingCustomer.credit_limit);
    const currentCreditBalance = parseDecimal(existingCustomer.credit_balance);
    const totalExposure = currentCreditBalance + openPurchaseOrderBalance;

    if (customerType !== undefined && currentCustomerType === 'VIP' && nextCustomerType !== 'VIP' && totalExposure > 0) {
      return res.status(400).json({
        success: false,
        error: 'Settle the customer balance and open order balances before removing VIP account access'
      });
    }

    if (nextCustomerType !== 'VIP' && creditLimit !== undefined && nextCreditLimit > 0) {
      return res.status(400).json({
        success: false,
        error: 'Only VIP customers can have a credit limit or account balance'
      });
    }

    if (nextCustomerType === 'VIP' && normalizeCreditLimit(nextCustomerType, nextCreditLimit) < totalExposure) {
      return res.status(400).json({
        success: false,
        error: 'Credit limit cannot be lower than the customer outstanding exposure'
      });
    }

    const customer = await prisma.customers.update({
      where: { customer_id: customerId },
      data: {
        ...(customerName && { customer_name: customerName }),
        ...(customerType && { customer_type: nextCustomerType }),
        ...(phone !== undefined && { contact_number: phone }),
        ...(creditLimit !== undefined || customerType !== undefined
          ? { credit_limit: normalizeCreditLimit(nextCustomerType, nextCreditLimit) }
          : {})
      }
    });
    
    return res.status(200).json({
      success: true,
      customer: {
        ...customer,
        credit_limit: parseDecimal(customer.credit_limit),
        credit_balance: parseDecimal(customer.credit_balance)
      }
    });
  } catch (error) {
    console.error('Update customer error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update customer'
    });
  }
}

/**
 * DELETE /api/customers/[id]
 * Soft delete a customer
 */
async function deleteCustomer(req, res) {
  const { id } = req.query;
  
  try {
    await prisma.customers.update({
      where: { customer_id: parseInt(id) },
      data: { is_active: false }
    });
    
    return res.status(200).json({
      success: true,
      message: 'Customer deleted successfully'
    });
  } catch (error) {
    console.error('Delete customer error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete customer'
    });
  }
}

export default apiHandler({
  GET: withClerk(getCustomer),
  PUT: withClerk(updateCustomer),
  DELETE: withManager(deleteCustomer)
});
