/**
 * Supply API Routes
 * CRUD operations for supply management (receiving goods from suppliers)
 */
import prisma from '@/lib/prisma';
import { withClerk, apiHandler } from '@/middleware/withAuth';
import { paginate, paginationMeta, sanitizeSearch, parseDecimal } from '@/lib/utils';

/**
 * GET /api/supply
 * List all supplies with pagination and search
 */
async function getSupplies(req, res) {
  const { page, pageSize, search, supplierId, startDate, endDate } = req.query;
  const { skip, take, page: currentPage, pageSize: size } = paginate(page, pageSize);
  
  try {
    const where = {};
    
    if (supplierId) {
      where.supplier_id = parseInt(supplierId);
    }
    
    if (startDate || endDate) {
      where.supply_date = {};
      if (startDate) where.supply_date.gte = new Date(startDate);
      if (endDate) where.supply_date.lte = new Date(endDate);
    }
    
    const [supplies, total] = await Promise.all([
      prisma.supply.findMany({
        where,
        skip,
        take,
        orderBy: { supply_date: 'desc' },
        include: {
          suppliers: {
            select: {
              supplier_id: true,
              supplier_name: true
            }
          },
          employees: {
            select: {
              employee_id: true,
              employee_name: true
            }
          },
          supply_details: {
            include: {
              products: {
                select: {
                  product_id: true,
                  product_name: true,
                  unit: true
                }
              }
            }
          }
        }
      }),
      prisma.supply.count({ where })
    ]);
    
    const formattedSupplies = supplies.map(s => ({
      ...s,
      total: parseDecimal(s.total),
      supply_details: s.supply_details.map(d => ({
        ...d,
        unit_cost: parseDecimal(d.unit_cost)
      }))
    }));
    
    return res.status(200).json({
      success: true,
      supplies: formattedSupplies,
      pagination: paginationMeta(total, currentPage, size)
    });
  } catch (error) {
    console.error('Get supplies error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch supplies'
    });
  }
}

/**
 * POST /api/supply
 * Create a new supply record
 */
async function createSupply(req, res) {
  const { supplierId, items, employeeId } = req.body;
  
  if (!supplierId || !items || items.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Supplier and at least one item are required'
    });
  }
  
  try {
    // Calculate total
    const total = items.reduce((sum, item) => 
      sum + (parseFloat(item.unitCost) * parseInt(item.quantity)), 0
    );
    
    const supply = await prisma.$transaction(async (tx) => {
      // Create supply record
      const newSupply = await tx.supply.create({
        data: {
          supplier_id: parseInt(supplierId),
          employee_id: employeeId ? parseInt(employeeId) : null,
          supply_date: new Date(),
          total: total
        }
      });
      
      // Create supply details
      for (const item of items) {
        await tx.supply_details.create({
          data: {
            supply_id: newSupply.supply_id,
            product_id: parseInt(item.productId),
            unit_type: item.unitType || null,
            unit_quantity: parseInt(item.quantity),
            unit_cost: parseFloat(item.unitCost)
          }
        });
        
        // Update inventory - add stock
        const existingInventory = await tx.inventory.findFirst({
          where: {
            product_id: parseInt(item.productId),
            is_active: true
          }
        });
        
        if (existingInventory) {
          await tx.inventory.update({
            where: { inventory_id: existingInventory.inventory_id },
            data: {
              current_stock: existingInventory.current_stock + parseInt(item.quantity)
            }
          });
        } else {
          await tx.inventory.create({
            data: {
              product_id: parseInt(item.productId),
              current_stock: parseInt(item.quantity),
              is_active: true
            }
          });
        }
        
        // Create stock log
        await tx.stock_log.create({
          data: {
            product_id: parseInt(item.productId),
            change_type: 'IN',
            quantity: parseInt(item.quantity),
            reason: `Supply from supplier #${supplierId}`,
            log_date: new Date(),
            employee_id: employeeId ? parseInt(employeeId) : null
          }
        });
      }
      
      // Update supplier payable balance
      await tx.suppliers.update({
        where: { supplier_id: parseInt(supplierId) },
        data: {
          payable_balance: { increment: total }
        }
      });
      
      return newSupply;
    });
    
    return res.status(201).json({
      success: true,
      supply: {
        ...supply,
        total: parseDecimal(supply.total)
      },
      message: 'Supply recorded successfully'
    });
  } catch (error) {
    console.error('Create supply error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create supply record'
    });
  }
}

export default apiHandler({
  GET: withClerk(getSupplies),
  POST: withClerk(createSupply)
});
