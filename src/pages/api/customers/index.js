/**
 * Customers API Routes
 * CRUD operations for customer management
 */
import prisma from '@/lib/prisma';
import { withCashier, withClerk, apiHandler } from '@/middleware/withAuth';
import { paginate, paginationMeta, sanitizeSearch, parseDecimal } from '@/lib/utils';

/**
 * GET /api/customers
 * List all customers with pagination and search
 */
async function getCustomers(req, res) {
  const { page, pageSize, search, type, hasCredit } = req.query;
  const { skip, take, page: currentPage, pageSize: size } = paginate(page, pageSize);
  
  try {
    // Build where clause
    const where = { is_active: true };
    
    if (search) {
      const searchTerm = sanitizeSearch(search);
      where.OR = [
        { customer_name: { contains: searchTerm } },
        { contact_number: { contains: searchTerm } }
      ];
    }
    
    if (type) {
      where.customer_type = type;
    }
    
    if (hasCredit === 'true') {
      where.credit_balance = { gt: 0 };
    }
    
    // Execute query
    const [customers, total] = await Promise.all([
      prisma.customers.findMany({
        where,
        skip,
        take,
        orderBy: { customer_name: 'asc' },
        select: {
          customer_id: true,
          customer_name: true,
          customer_type: true,
          contact_number: true,
          credit_limit: true,
          credit_balance: true,
          created_at: true
        }
      }),
      prisma.customers.count({ where })
    ]);
    
    // Parse decimal values
    const formattedCustomers = customers.map(c => ({
      ...c,
      credit_limit: parseDecimal(c.credit_limit),
      credit_balance: parseDecimal(c.credit_balance)
    }));
    
    return res.status(200).json({
      success: true,
      customers: formattedCustomers,
      pagination: paginationMeta(total, currentPage, size)
    });
  } catch (error) {
    console.error('Get customers error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch customers'
    });
  }
}

/**
 * POST /api/customers
 * Create a new customer
 */
async function createCustomer(req, res) {
  const { customerName, customerType, phone, email, address, creditLimit } = req.body;
  
  if (!customerName) {
    return res.status(400).json({
      success: false,
      error: 'Customer name is required'
    });
  }
  
  try {
    const customer = await prisma.customers.create({
      data: {
        customer_name: customerName,
        customer_type: customerType || 'WALK_IN',
        contact_number: phone || null,
        credit_limit: creditLimit || 0,
        credit_balance: 0
      }
    });
    
    return res.status(201).json({
      success: true,
      customer: {
        ...customer,
        credit_limit: parseDecimal(customer.credit_limit),
        credit_balance: parseDecimal(customer.credit_balance)
      }
    });
  } catch (error) {
    console.error('Create customer error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create customer'
    });
  }
}

export default apiHandler({
  GET: withCashier(getCustomers),
  POST: withCashier(createCustomer)
});
