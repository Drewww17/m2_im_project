/**
 * Ledger Report API Route
 */
import prisma from '@/lib/prisma';
import { withManager, apiHandler } from '@/middleware/withAuth';
import { paginate, paginationMeta, parseDecimal } from '@/lib/utils';

async function getLedger(req, res) {
  const { page, pageSize, accountType, customerId, supplierId, startDate, endDate } = req.query;
  const { skip, take, page: currentPage, pageSize: size } = paginate(page, pageSize);
  
  try {
    const where = {};
    
    if (accountType) where.account_type = accountType;
    if (customerId) {
      where.account_type = 'customer';
      where.account_id = parseInt(customerId);
    }
    if (supplierId) {
      where.account_type = 'supplier';
      where.account_id = parseInt(supplierId);
    }
    
    if (startDate || endDate) {
      where.created_at = {};
      if (startDate) where.created_at.gte = new Date(startDate);
      if (endDate) where.created_at.lte = new Date(endDate);
    }
    
    const [entries, total] = await Promise.all([
      prisma.account_ledger.findMany({
        where,
        skip,
        take,
        orderBy: { created_at: 'desc' }
      }),
      prisma.account_ledger.count({ where })
    ]);
    
    const formattedEntries = entries.map(entry => ({
      ...entry,
      debit: parseDecimal(entry.debit),
      credit: parseDecimal(entry.credit)
    }));
    
    return res.status(200).json({
      success: true,
      ledger: formattedEntries,
      pagination: paginationMeta(total, currentPage, size)
    });
  } catch (error) {
    console.error('Get ledger error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch ledger'
    });
  }
}

export default apiHandler({
  GET: withManager(getLedger)
});
