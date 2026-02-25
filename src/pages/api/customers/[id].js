/**
 * Single Customer API Routes
 * Get, update, and delete individual customers
 */
import prisma from '@/lib/prisma';
import { withCashier, withClerk, withManager, apiHandler } from '@/middleware/withAuth';
import { parseDecimal } from '@/lib/utils';

/**
 * GET /api/customers/[id]
 * Get customer details with transaction history
 */
async function getCustomer(req, res) {
  const { id } = req.query;
  
  try {
    const customer = await prisma.customers.findUnique({
      where: { customer_id: parseInt(id) },
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
        }
      }
    });
    
    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found'
      });
    }
    
    // Format decimal values
    const formattedCustomer = {
      ...customer,
      credit_limit: parseDecimal(customer.credit_limit),
      credit_balance: parseDecimal(customer.credit_balance),
      sales: customer.sales.map(s => ({
        ...s,
        total_amount: parseDecimal(s.total_amount)
      }))
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
    const customer = await prisma.customers.update({
      where: { customer_id: parseInt(id) },
      data: {
        ...(customerName && { customer_name: customerName }),
        ...(customerType && { customer_type: customerType }),
        ...(phone !== undefined && { contact_number: phone }),
        ...(creditLimit !== undefined && { credit_limit: creditLimit })
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
  GET: withCashier(getCustomer),
  PUT: withClerk(updateCustomer),
  DELETE: withManager(deleteCustomer)
});
