/**
 * Products API Routes
 * Product management and search
 */
import prisma from '@/lib/prisma';
import { withCashier, withClerk, apiHandler } from '@/middleware/withAuth';
import { paginate, paginationMeta, sanitizeSearch, parseDecimal } from '@/lib/utils';

/**
 * GET /api/products
 * List products with search, category filter, and stock info
 */
async function getProducts(req, res) {
  const { page, pageSize, search, category, barcode, lowStock } = req.query;
  const { skip, take, page: currentPage, pageSize: size } = paginate(page, pageSize);
  
  try {
    // Build where clause
    const where = { is_active: true };
    
    if (search) {
      const searchTerm = sanitizeSearch(search);
      where.OR = [
        { product_name: { contains: searchTerm } },
        { product_code: { contains: searchTerm } },
        { barcode: { contains: searchTerm } }
      ];
    }
    
    if (barcode) {
      where.barcode = barcode;
    }
    
    if (category) {
      where.category = category;
    }
    
    // Execute query with inventory aggregation
    const [products, total] = await Promise.all([
      prisma.products.findMany({
        where,
        skip,
        take,
        orderBy: { product_name: 'asc' },
        include: {
          suppliers: {
            select: { supplier_id: true, supplier_name: true }
          },
          inventory: {
            where: { is_active: true },
            select: {
              inventory_id: true,
              current_stock: true,
              batch_number: true,
              expiration_date: true
            }
          }
        }
      }),
      prisma.products.count({ where })
    ]);
    
    // Format products with stock totals
    const formattedProducts = products.map(product => {
      const totalStock = product.inventory.reduce((sum, inv) => sum + (inv.current_stock || 0), 0);
      const isLowStock = totalStock <= (product.reorder_level || 0);
      
      return {
        product_id: product.product_id,
        product_code: product.product_code,
        barcode: product.barcode,
        product_name: product.product_name,
        description: product.description,
        category: product.category,
        unit: product.unit,
        unit_price: parseDecimal(product.unit_price),
        srp: parseDecimal(product.srp),
        dealer_price: parseDecimal(product.dealer_price),
        reorder_level: product.reorder_level,
        brand: product.brand,
        supplier: product.suppliers,
        total_stock: totalStock,
        is_low_stock: isLowStock,
        inventory: product.inventory
      };
    });
    
    // Filter low stock if requested
    const filteredProducts = lowStock === 'true' 
      ? formattedProducts.filter(p => p.is_low_stock)
      : formattedProducts;
    
    return res.status(200).json({
      success: true,
      products: filteredProducts,
      pagination: paginationMeta(total, currentPage, size)
    });
  } catch (error) {
    console.error('REAL ERROR:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * POST /api/products
 * Create a new product
 */
async function createProduct(req, res) {
  const { 
    productCode, barcode, productName, description, category, 
    unit, unitPrice, srp, dealerPrice, reorderLevel, supplierId, brand
  } = req.body;
  
  if (!productName) {
    return res.status(400).json({
      success: false,
      error: 'Required field: productName'
    });
  }
  
  try {
    // Check for duplicate product name
    const existing = await prisma.products.findFirst({
      where: { product_name: productName }
    });
    
    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'Product name already exists'
      });
    }
    
    const product = await prisma.products.create({
      data: {
        product_code: productCode || null,
        barcode: barcode || null,
        product_name: productName,
        description: description || null,
        category: category || null,
        unit: unit || null,
        unit_price: unitPrice || 0,
        srp: srp || null,
        dealer_price: dealerPrice || null,
        reorder_level: reorderLevel || 10,
        supplier_id: supplierId || null,
        brand: brand || null
      }
    });
    
    return res.status(201).json({
      success: true,
      product: {
        ...product,
        unit_price: parseDecimal(product.unit_price),
        srp: parseDecimal(product.srp),
        dealer_price: parseDecimal(product.dealer_price)
      }
    });
  } catch (error) {
    console.error('Create product error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create product'
    });
  }
}

export default apiHandler({
  GET: withCashier(getProducts),
  POST: withClerk(createProduct)
});
