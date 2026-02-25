/**
 * Financial Dashboard API Route
 * Financial reports and summaries
 */
import prisma from '@/lib/prisma';
import { withManager, apiHandler } from '@/middleware/withAuth';
import { parseDecimal } from '@/lib/utils';

async function getDashboard(req, res) {
  const { startDate, endDate } = req.query;
  
  // Default to current month if no dates provided
  const now = new Date();
  const start = startDate ? new Date(startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
  const end = endDate ? new Date(endDate) : now;
  
  try {
    // Get sales data
    const sales = await prisma.sales.findMany({
      where: {
        is_active: true,
        sale_date: { gte: start, lte: end }
      },
      include: {
        sale_details: true
      }
    });
    
    // Calculate sales summary
    const salesSummary = {
      total_transactions: sales.length,
      total_revenue: sales.reduce((sum, s) => sum + parseDecimal(s.total_amount), 0),
      total_collected: sales.reduce((sum, s) => sum + parseDecimal(s.amount_paid), 0),
      total_credit: sales.reduce((sum, s) => {
        const credit = parseDecimal(s.total_amount) - parseDecimal(s.amount_paid);
        return sum + (credit > 0 ? credit : 0);
      }, 0),
      total_items_sold: sales.reduce((sum, s) => 
        sum + s.sale_details.reduce((itemSum, d) => itemSum + d.quantity, 0), 0
      ),
      average_transaction: sales.length > 0 
        ? sales.reduce((sum, s) => sum + parseDecimal(s.total_amount), 0) / sales.length 
        : 0
    };
    
    // Sales by payment method
    const byPaymentMethod = {
      CASH: { count: 0, amount: 0 },
      CREDIT: { count: 0, amount: 0 },
      MIXED: { count: 0, amount: 0 }
    };
    
    sales.forEach(sale => {
      const method = sale.payment_method || 'CASH';
      if (byPaymentMethod[method]) {
        byPaymentMethod[method].count++;
        byPaymentMethod[method].amount += parseDecimal(sale.total_amount);
      }
    });
    
    // Daily sales for chart
    const dailySales = {};
    sales.forEach(sale => {
      const date = sale.sale_date.toISOString().split('T')[0];
      if (!dailySales[date]) {
        dailySales[date] = { date, revenue: 0, transactions: 0 };
      }
      dailySales[date].revenue += parseDecimal(sale.total_amount);
      dailySales[date].transactions++;
    });
    
    // Get customer credit outstanding
    const customersWithCredit = await prisma.customers.findMany({
      where: {
        is_active: true,
        credit_balance: { gt: 0 }
      },
      select: {
        customer_id: true,
        customer_name: true,
        credit_balance: true,
        credit_limit: true
      },
      orderBy: { credit_balance: 'desc' }
    });
    
    const creditSummary = {
      total_outstanding: customersWithCredit.reduce((sum, c) => sum + parseDecimal(c.credit_balance), 0),
      customer_count: customersWithCredit.length,
      top_debtors: customersWithCredit.slice(0, 10).map(c => ({
        ...c,
        credit_balance: parseDecimal(c.credit_balance),
        credit_limit: parseDecimal(c.credit_limit)
      }))
    };
    
    // Get supplier payables
    const suppliersWithPayable = await prisma.suppliers.findMany({
      where: {
        is_active: true,
        payable_balance: { gt: 0 }
      },
      select: {
        supplier_id: true,
        supplier_name: true,
        payable_balance: true
      },
      orderBy: { payable_balance: 'desc' }
    });
    
    const payablesSummary = {
      total_payable: suppliersWithPayable.reduce((sum, s) => sum + parseDecimal(s.payable_balance), 0),
      supplier_count: suppliersWithPayable.length,
      top_payables: suppliersWithPayable.slice(0, 10).map(s => ({
        ...s,
        payable_balance: parseDecimal(s.payable_balance)
      }))
    };
    
    // Inventory valuation
    const inventory = await prisma.inventory.findMany({
      where: { is_active: true },
      include: {
        products: {
          select: { unit_price: true, srp: true, product_name: true }
        }
      }
    });
    
    const inventoryValuation = {
      total_cost_value: inventory.reduce((sum, inv) => 
        sum + ((inv.current_stock || 0) * parseDecimal(inv.products?.unit_price)), 0
      ),
      total_retail_value: inventory.reduce((sum, inv) => 
        sum + ((inv.current_stock || 0) * parseDecimal(inv.products?.srp)), 0
      ),
      total_items: inventory.reduce((sum, inv) => sum + (inv.current_stock || 0), 0),
      potential_profit: 0 // Will be calculated
    };
    inventoryValuation.potential_profit = inventoryValuation.total_retail_value - inventoryValuation.total_cost_value;
    
    // Purchase orders summary
    const purchaseOrders = await prisma.purchase_orders.findMany({
      where: {
        order_date: { gte: start, lte: end }
      }
    });
    
    const purchaseSummary = {
      total_orders: purchaseOrders.length,
      total_value: purchaseOrders.reduce((sum, po) => sum + parseDecimal(po.outstanding_balance), 0),
      pending_orders: purchaseOrders.filter(po => po.po_status === 'PENDING').length,
      received_orders: purchaseOrders.filter(po => po.po_status === 'RECEIVED').length
    };
    
    return res.status(200).json({
      success: true,
      dashboard: {
        period: { start, end },
        sales: salesSummary,
        sales_by_payment: byPaymentMethod,
        daily_sales: Object.values(dailySales).sort((a, b) => a.date.localeCompare(b.date)),
        customer_credit: creditSummary,
        supplier_payables: payablesSummary,
        inventory: inventoryValuation,
        purchases: purchaseSummary
      }
    });
  } catch (error) {
    console.error('Get dashboard error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard data'
    });
  }
}

export default apiHandler({
  GET: withManager(getDashboard)
});
