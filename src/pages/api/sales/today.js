/**
 * Today's Sales API Route
 * Quick summary for cashier dashboard
 */
import prisma from '@/lib/prisma';
import { withCashier, apiHandler } from '@/middleware/withAuth';
import { parseDecimal } from '@/lib/utils';

async function getTodaySales(req, res) {
  const { cashierId } = req.query;
  
  try {
    // Get start of today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const where = {
      is_active: true,
      sale_date: { gte: today }
    };
    
    // Optionally filter by cashier
    if (cashierId) {
      where.employee_id = parseInt(cashierId);
    }
    
    const sales = await prisma.sales.findMany({
      where,
      orderBy: { sale_date: 'desc' },
      include: {
        customers: {
          select: { customer_name: true, customer_type: true }
        },
        sale_details: {
          select: { quantity: true }
        }
      }
    });
    
    // Calculate summary
    const summary = {
      totalSales: sales.length,
      totalRevenue: sales.reduce((sum, s) => sum + parseDecimal(s.total_amount), 0),
      totalCash: sales
        .filter(s => s.payment_method === 'CASH')
        .reduce((sum, s) => sum + parseDecimal(s.amount_paid), 0),
      totalCredit: sales
        .filter(s => s.payment_method === 'CREDIT' || s.sale_status !== 'PAID')
        .reduce((sum, s) => sum + (parseDecimal(s.total_amount) - parseDecimal(s.amount_paid)), 0),
      totalItems: sales.reduce((sum, s) => 
        sum + s.sale_details.reduce((itemSum, d) => itemSum + d.quantity, 0), 0
      )
    };
    
    return res.status(200).json({
      success: true,
      summary,
      recentSales: sales.slice(0, 10).map(s => ({
        sale_id: s.sale_id,
        customer_name: s.customers?.customer_name || 'Walk-in',
        total_amount: parseDecimal(s.total_amount),
        payment_method: s.payment_method,
        sale_status: s.sale_status,
        sale_date: s.sale_date
      }))
    });
  } catch (error) {
    console.error('Get today sales error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch today sales'
    });
  }
}

export default apiHandler({
  GET: withCashier(getTodaySales)
});
