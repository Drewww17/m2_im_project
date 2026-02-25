/**
 * Suppliers API Routes
 * Supplier management
 */
import prisma from '@/lib/prisma';
import { withClerk, withManager, apiHandler } from '@/middleware/withAuth';
import { paginate, paginationMeta, sanitizeSearch, parseDecimal } from '@/lib/utils';

/**
 * GET /api/suppliers
 * List suppliers with purchase history
 */
async function getSuppliers(req, res) {
  const { page, pageSize, search, hasPayable } = req.query;
  const { skip, take, page: currentPage, pageSize: size } = paginate(page, pageSize);
  
  try {
    const where = { is_active: true };
    
    if (search) {
      const searchTerm = sanitizeSearch(search);
      where.OR = [
        { supplier_name: { contains: searchTerm } },
        { contact_number: { contains: searchTerm } }
      ];
    }
    
    if (hasPayable === 'true') {
      where.payable_balance = { gt: 0 };
    }
    
    const [suppliers, total] = await Promise.all([
      prisma.suppliers.findMany({
        where,
        skip,
        take,
        orderBy: { supplier_name: 'asc' },
        include: {
          _count: {
            select: { products: true }
          }
        }
      }),
      prisma.suppliers.count({ where })
    ]);
    
    const formattedSuppliers = suppliers.map(s => ({
      ...s,
      payable_balance: parseDecimal(s.payable_balance),
      product_count: s._count.products
    }));
    
    return res.status(200).json({
      success: true,
      suppliers: formattedSuppliers,
      pagination: paginationMeta(total, currentPage, size)
    });
  } catch (error) {
    console.error('Get suppliers error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch suppliers'
    });
  }
}

/**
 * POST /api/suppliers
 * Create a new supplier
 */
async function createSupplier(req, res) {
  const { supplierName, contactPerson, phone, email, address } = req.body;
  
  if (!supplierName) {
    return res.status(400).json({
      success: false,
      error: 'Supplier name is required'
    });
  }
  
  try {
    const supplier = await prisma.suppliers.create({
      data: {
        supplier_name: supplierName,
        contact_number: phone || null,
        payable_balance: 0
      }
    });
    
    return res.status(201).json({
      success: true,
      supplier: {
        ...supplier,
        payable_balance: parseDecimal(supplier.payable_balance)
      }
    });
  } catch (error) {
    console.error('Create supplier error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create supplier'
    });
  }
}

export default apiHandler({
  GET: withClerk(getSuppliers),
  POST: withClerk(createSupplier)
});
