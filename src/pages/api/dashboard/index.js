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
    
    // Expiring products - products expiring within 30 days
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    
    const expiringInventory = await prisma.inventory.findMany({
      where: {
        is_active: true,
        current_stock: { gt: 0 },
        expiration_date: {
          lte: thirtyDaysFromNow,
          gte: new Date()
        }
      },
      include: {
        products: {
          select: {
            product_id: true,
            product_name: true,
            product_code: true,
            unit: true
          }
        }
      },
      orderBy: { expiration_date: 'asc' }
    });

    // Already expired products
    const expiredInventory = await prisma.inventory.findMany({
      where: {
        is_active: true,
        current_stock: { gt: 0 },
        expiration_date: {
          lt: new Date()
        }
      },
      include: {
        products: {
          select: {
            product_id: true,
            product_name: true,
            product_code: true,
            unit: true
          }
        }
      },
      orderBy: { expiration_date: 'asc' }
    });

    const expirationAlerts = {
      expiring_soon: expiringInventory.map(inv => ({
        inventory_id: inv.inventory_id,
        product_name: inv.products?.product_name,
        product_code: inv.products?.product_code,
        current_stock: inv.current_stock,
        unit: inv.products?.unit,
        expiration_date: inv.expiration_date,
        days_until_expiry: Math.ceil((new Date(inv.expiration_date) - new Date()) / (1000 * 60 * 60 * 24))
      })),
      already_expired: expiredInventory.map(inv => ({
        inventory_id: inv.inventory_id,
        product_name: inv.products?.product_name,
        product_code: inv.products?.product_code,
        current_stock: inv.current_stock,
        unit: inv.products?.unit,
        expiration_date: inv.expiration_date,
        days_expired: Math.ceil((new Date() - new Date(inv.expiration_date)) / (1000 * 60 * 60 * 24))
      })),
      expiring_count: expiringInventory.length,
      expired_count: expiredInventory.length
    };

    // Low stock alerts - products at or below reorder level
    const lowStockInventory = await prisma.inventory.findMany({
      where: {
        is_active: true
      },
      include: {
        products: {
          select: {
            product_id: true,
            product_name: true,
            product_code: true,
            unit: true,
            reorder_level: true
          }
        }
      }
    });

    // Filter to only items at or below reorder level
    const lowStockItems = lowStockInventory
      .filter(inv => inv.products && inv.current_stock <= (inv.products.reorder_level || 0))
      .map(inv => ({
        inventory_id: inv.inventory_id,
        product_name: inv.products?.product_name,
        product_code: inv.products?.product_code,
        current_stock: inv.current_stock,
        unit: inv.products?.unit,
        reorder_level: inv.products?.reorder_level || 0,
        is_out_of_stock: inv.current_stock === 0
      }))
      .sort((a, b) => a.current_stock - b.current_stock);

    const lowStockAlerts = {
      items: lowStockItems,
      low_stock_count: lowStockItems.filter(i => i.current_stock > 0).length,
      out_of_stock_count: lowStockItems.filter(i => i.current_stock === 0).length,
      total_count: lowStockItems.length
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
        purchases: purchaseSummary,
        expiration_alerts: expirationAlerts,
        low_stock_alerts: lowStockAlerts
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
