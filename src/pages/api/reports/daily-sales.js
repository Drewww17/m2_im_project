/**
 * Daily Sales Report API Route
 */
import prisma from '@/lib/prisma';
import { withClerk, apiHandler } from '@/middleware/withAuth';
import { parseDecimal } from '@/lib/utils';

async function getDailySalesReport(req, res) {
  const { date } = req.query;
  
  // Default to today
  const reportDate = date ? new Date(date) : new Date();
  const startOfDay = new Date(reportDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(reportDate);
  endOfDay.setHours(23, 59, 59, 999);
  
  try {
    const sales = await prisma.sales.findMany({
      where: {
        is_active: true,
        sale_date: { gte: startOfDay, lte: endOfDay }
      },
      include: {
        customers: {
          select: { customer_name: true, customer_type: true }
        },
        employees: {
          select: { employee_name: true }
        },
        sale_details: {
          include: {
            products: {
              select: { product_name: true, product_code: true, unit: true }
            }
          }
        }
      },
      orderBy: { sale_date: 'asc' }
    });
    
    // Format sales
    const formattedSales = sales.map(sale => ({
      sale_id: sale.sale_id,
      sale_date: sale.sale_date,
      customer: sale.customers?.customer_name || 'Walk-in',
      cashier: sale.employees?.employee_name || 'Unknown',
      total_amount: parseDecimal(sale.total_amount),
      amount_paid: parseDecimal(sale.amount_paid),
      payment_method: sale.payment_method,
      sale_status: sale.sale_status,
      items: sale.sale_details.map(d => ({
        product: d.products?.product_name,
        quantity: d.quantity,
        unit: d.products?.unit,
        unit_price: parseDecimal(d.unit_price),
        subtotal: d.quantity * parseDecimal(d.unit_price)
      }))
    }));
    
    // Summary
    const summary = {
      date: reportDate.toISOString().split('T')[0],
      total_transactions: sales.length,
      total_sales: sales.reduce((sum, s) => sum + parseDecimal(s.total_amount), 0),
      cash_received: sales
        .filter(s => s.payment_method === 'CASH' || s.payment_method === 'MIXED')
        .reduce((sum, s) => sum + parseDecimal(s.amount_paid), 0),
      credit_sales: sales
        .filter(s => s.sale_status !== 'PAID')
        .reduce((sum, s) => sum + (parseDecimal(s.total_amount) - parseDecimal(s.amount_paid)), 0)
    };
    
    return res.status(200).json({
      success: true,
      report: {
        summary,
        sales: formattedSales
      }
    });
  } catch (error) {
    console.error('Get daily report error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate daily report'
    });
  }
}

export default apiHandler({
  GET: withClerk(getDailySalesReport)
});
