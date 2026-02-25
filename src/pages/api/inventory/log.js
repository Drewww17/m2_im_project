/**
 * Stock Log API Route
 * View stock movement history
 */
import prisma from '@/lib/prisma';
import { withClerk, apiHandler } from '@/middleware/withAuth';
import { paginate, paginationMeta } from '@/lib/utils';

async function getStockLog(req, res) {
  const { page, pageSize, productId, transactionType, startDate, endDate } = req.query;
  const { skip, take, page: currentPage, pageSize: size } = paginate(page, pageSize);
  
  try {
    // Build where clause
    const where = {};
    
    if (productId) {
      where.product_id = parseInt(productId);
    }
    
    if (transactionType) {
      where.change_type = transactionType;
    }
    
    if (startDate || endDate) {
      where.log_date = {};
      if (startDate) where.log_date.gte = new Date(startDate);
      if (endDate) where.log_date.lte = new Date(endDate);
    }
    
    const [logs, total] = await Promise.all([
      prisma.stock_log.findMany({
        where,
        skip,
        take,
        orderBy: { log_date: 'desc' },
        include: {
          products: {
            select: {
              product_id: true,
              product_code: true,
              product_name: true,
              unit: true
            }
          }
        }
      }),
      prisma.stock_log.count({ where })
    ]);
    
    return res.status(200).json({
      success: true,
      logs,
      pagination: paginationMeta(total, currentPage, size)
    });
  } catch (error) {
    console.error('Get stock log error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch stock log'
    });
  }
}

export default apiHandler({
  GET: withClerk(getStockLog)
});
