import { parseDecimal } from '@/lib/utils';

const CUSTOMER_PAYMENT_TYPES = new Set(['PAYMENT', 'CUSTOMER_PAYMENT']);
const SUPPLIER_PAYMENT_TYPES = new Set(['SUPPLIER_PAYMENT']);

function pad(value) {
  return String(value).padStart(2, '0');
}

export function getBusinessDateString(dateInput = new Date()) {
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    return dateInput;
  }

  const date = dateInput instanceof Date ? new Date(dateInput) : new Date(dateInput);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function getBusinessDayRange(dateInput = new Date()) {
  const businessDate = getBusinessDateString(dateInput);
  return {
    businessDate,
    start: new Date(`${businessDate}T00:00:00`),
    end: new Date(`${businessDate}T23:59:59.999`)
  };
}

export function formatBusinessDayRecord(day) {
  if (!day) {
    return null;
  }

  const optionalDecimal = (value) =>
    value === null || value === undefined ? null : parseDecimal(value);

  return {
    ...day,
    opening_cash: parseDecimal(day.opening_cash),
    actual_cash_on_hand: optionalDecimal(day.actual_cash_on_hand),
    expected_cash_on_hand: parseDecimal(day.expected_cash_on_hand),
    cash_variance: optionalDecimal(day.cash_variance),
    sales_total: parseDecimal(day.sales_total),
    cash_sales_total: parseDecimal(day.cash_sales_total),
    online_sales_total: parseDecimal(day.online_sales_total),
    credit_sales_total: parseDecimal(day.credit_sales_total),
    customer_payments_total: parseDecimal(day.customer_payments_total),
    supplier_payments_total: parseDecimal(day.supplier_payments_total),
    purchase_orders_total: parseDecimal(day.purchase_orders_total),
    supplies_total: parseDecimal(day.supplies_total),
    total_cash_inflows: parseDecimal(day.total_cash_inflows),
    total_cash_outflows: parseDecimal(day.total_cash_outflows)
  };
}

function isCashLikeFundSource(value) {
  const normalized = String(value || '').trim().toUpperCase();
  return normalized === '' || normalized === 'CASH' || normalized === 'MIXED';
}

function getSaleCashAmount(sale) {
  const paymentMethod = String(sale.payment_method || '').toUpperCase();
  if (paymentMethod === 'CASH') {
    return parseDecimal(sale.amount_paid);
  }

  if (paymentMethod === 'MIXED') {
    return parseDecimal(sale.cash_amount);
  }

  return 0;
}

function getSaleOnlineAmount(sale) {
  const paymentMethod = String(sale.payment_method || '').toUpperCase();
  if (paymentMethod === 'MIXED') {
    return parseDecimal(sale.online_amount);
  }

  return 0;
}

function buildBalanceSheet({
  businessDate,
  openingCash,
  expectedCashOnHand,
  actualCashOnHand = null,
  onlineReceiptsTotal,
  customerReceivablesTotal,
  supplierPayablesTotal,
  inventoryValue,
  totalCashInflows,
  totalCashOutflows,
  salesTotal
}) {
  const closingCashBasis = actualCashOnHand ?? expectedCashOnHand;
  const totalAssets =
    closingCashBasis +
    onlineReceiptsTotal +
    customerReceivablesTotal +
    inventoryValue;
  const totalLiabilities = supplierPayablesTotal;

  return {
    as_of: businessDate,
    assets: {
      opening_cash: openingCash,
      expected_cash_on_hand: expectedCashOnHand,
      actual_cash_on_hand: actualCashOnHand,
      closing_cash_basis: closingCashBasis,
      digital_receipts_today: onlineReceiptsTotal,
      accounts_receivable: customerReceivablesTotal,
      inventory_at_cost: inventoryValue,
      total_assets: totalAssets
    },
    liabilities: {
      supplier_payables: supplierPayablesTotal,
      total_liabilities: totalLiabilities
    },
    equity: {
      net_business_position: totalAssets - totalLiabilities,
      daily_net_cash_movement: totalCashInflows - totalCashOutflows,
      gross_sales: salesTotal
    }
  };
}

export function reconcileBalanceSheet(balanceSheet, actualCashOnHand) {
  if (!balanceSheet) {
    return null;
  }

  const normalizedActualCash =
    actualCashOnHand === null || actualCashOnHand === undefined
      ? null
      : Number(actualCashOnHand);
  const expectedCashOnHand = Number(balanceSheet.assets?.expected_cash_on_hand || 0);
  const closingCashBasis = normalizedActualCash ?? expectedCashOnHand;
  const digitalReceiptsToday = Number(balanceSheet.assets?.digital_receipts_today || 0);
  const accountsReceivable = Number(balanceSheet.assets?.accounts_receivable || 0);
  const inventoryAtCost = Number(balanceSheet.assets?.inventory_at_cost || 0);
  const supplierPayables = Number(balanceSheet.liabilities?.supplier_payables || 0);
  const totalAssets =
    closingCashBasis + digitalReceiptsToday + accountsReceivable + inventoryAtCost;
  const totalLiabilities = supplierPayables;

  return {
    ...balanceSheet,
    assets: {
      ...balanceSheet.assets,
      actual_cash_on_hand: normalizedActualCash,
      closing_cash_basis: closingCashBasis,
      total_assets: totalAssets
    },
    liabilities: {
      ...balanceSheet.liabilities,
      total_liabilities: totalLiabilities
    },
    equity: {
      ...balanceSheet.equity,
      net_business_position: totalAssets - totalLiabilities
    }
  };
}

export async function assertBusinessDayOpen(tx, dateInput = new Date()) {
  const { businessDate } = getBusinessDayRange(dateInput);
  const day = await tx.business_days.findUnique({
    where: { business_date: businessDate }
  });

  if (day?.status === 'CLOSED') {
    throw new Error(`Business day ${businessDate} is already closed`);
  }

  return day;
}

export async function buildBusinessDaySnapshot(tx, dateInput = new Date(), options = {}) {
  const { businessDate, start, end } = getBusinessDayRange(dateInput);
  const openingCash = Number(options.openingCash ?? 0);

  const [
    sales,
    purchaseOrders,
    supplies,
    ledgerEntries,
    transactions,
    customerBalances,
    supplierBalances,
    inventoryBatches
  ] = await Promise.all([
    tx.sales.findMany({
      where: {
        sale_date: { gte: start, lte: end }
      },
      orderBy: [
        { created_at: 'asc' },
        { sale_id: 'asc' }
      ],
      include: {
        customers: {
          select: { customer_id: true, customer_name: true, customer_type: true }
        },
        employees: {
          select: { employee_id: true, employee_name: true }
        },
        sale_details: {
          include: {
            products: {
              select: {
                product_id: true,
                product_name: true,
                product_code: true,
                unit: true
              }
            }
          }
        },
        delivery: true
      }
    }),
    tx.purchase_orders.findMany({
      where: {
        order_date: { gte: start, lte: end }
      },
      orderBy: { order_date: 'asc' },
      include: {
        customers: {
          select: { customer_id: true, customer_name: true }
        },
        purchase_order_details: {
          include: {
            products: {
              select: {
                product_id: true,
                product_name: true,
                product_code: true,
                unit: true
              }
            }
          }
        }
      }
    }),
    tx.supply.findMany({
      where: {
        supply_date: { gte: start, lte: end }
      },
      orderBy: { supply_date: 'asc' },
      include: {
        suppliers: {
          select: { supplier_id: true, supplier_name: true }
        },
        employees: {
          select: { employee_id: true, employee_name: true }
        },
        supply_details: {
          include: {
            products: {
              select: {
                product_id: true,
                product_name: true,
                product_code: true,
                unit: true
              }
            }
          }
        }
      }
    }),
    tx.account_ledger.findMany({
      where: {
        created_at: { gte: start, lte: end }
      },
      orderBy: { created_at: 'asc' }
    }),
    tx.agrivet_transactions.findMany({
      where: {
        transaction_date: { gte: start, lte: end }
      },
      orderBy: { transaction_id: 'asc' }
    }),
    tx.customers.findMany({
      where: {
        is_active: { not: false }
      },
      select: {
        customer_id: true,
        customer_name: true,
        credit_balance: true
      }
    }),
    tx.suppliers.findMany({
      where: {
        is_active: { not: false }
      },
      select: {
        supplier_id: true,
        supplier_name: true,
        payable_balance: true
      }
    }),
    tx.inventory.findMany({
      where: {
        is_active: true,
        current_stock: { gt: 0 }
      },
      include: {
        products: {
          select: {
            product_id: true,
            product_name: true,
            product_code: true,
            unit_price: true,
            unit: true
          }
        }
      }
    })
  ]);

  const customerPaymentLedger = ledgerEntries.filter(
    (entry) => entry.account_type === 'customer' && entry.reference_type === 'PAYMENT'
  );
  const supplierPaymentLedger = ledgerEntries.filter(
    (entry) => entry.account_type === 'supplier' && entry.reference_type === 'PAYMENT'
  );

  const customerIds = [...new Set(customerPaymentLedger.map((entry) => entry.account_id).filter(Boolean))];
  const supplierIds = [...new Set(supplierPaymentLedger.map((entry) => entry.account_id).filter(Boolean))];

  const [customers, suppliers] = await Promise.all([
    customerIds.length > 0
      ? tx.customers.findMany({
          where: { customer_id: { in: customerIds } },
          select: { customer_id: true, customer_name: true }
        })
      : [],
    supplierIds.length > 0
      ? tx.suppliers.findMany({
          where: { supplier_id: { in: supplierIds } },
          select: { supplier_id: true, supplier_name: true }
        })
      : []
  ]);

  const customerNameMap = new Map(customers.map((customer) => [customer.customer_id, customer.customer_name]));
  const supplierNameMap = new Map(suppliers.map((supplier) => [supplier.supplier_id, supplier.supplier_name]));

  const formattedSales = sales.map((sale) => ({
    sale_id: sale.sale_id,
    created_at: sale.created_at,
    sale_date: sale.sale_date,
    sale_status: sale.sale_status,
    payment_method: sale.payment_method,
    customer: sale.customers?.customer_name || 'Walk-in',
    cashier: sale.employees?.employee_name || 'Unknown',
    total_amount: parseDecimal(sale.total_amount),
    amount_paid: parseDecimal(sale.amount_paid),
    cash_amount: parseDecimal(sale.cash_amount),
    online_amount: parseDecimal(sale.online_amount),
    is_active: sale.is_active,
    items: sale.sale_details.map((detail) => ({
      sale_detail_id: detail.sale_detail_id,
      product: detail.products?.product_name || 'Unknown Product',
      product_code: detail.products?.product_code || null,
      quantity: detail.quantity || 0,
      unit: detail.products?.unit || null,
      unit_price: parseDecimal(detail.unit_price),
      discount: parseDecimal(detail.discount),
      subtotal: (detail.quantity || 0) * parseDecimal(detail.unit_price) - parseDecimal(detail.discount)
    }))
  }));

  const formattedPurchaseOrders = purchaseOrders.map((order) => ({
    po_id: order.po_id,
    order_date: order.order_date,
    customer: order.customers?.customer_name || 'Unknown',
    po_status: order.po_status,
    priority: order.priority,
    outstanding_balance: parseDecimal(order.outstanding_balance),
    items: order.purchase_order_details.map((detail) => ({
      po_detail_id: detail.po_detail_id,
      product: detail.products?.product_name || 'Unknown Product',
      product_code: detail.products?.product_code || null,
      quantity: detail.quantity || 0,
      unit: detail.products?.unit || null
    }))
  }));

  const formattedSupplies = supplies.map((supply) => ({
    supply_id: supply.supply_id,
    supply_date: supply.supply_date,
    supplier: supply.suppliers?.supplier_name || 'Unknown',
    handled_by: supply.employees?.employee_name || null,
    total: parseDecimal(supply.total),
    items: supply.supply_details.map((detail) => ({
      supply_detail_id: detail.supply_detail_id,
      product: detail.products?.product_name || 'Unknown Product',
      product_code: detail.products?.product_code || null,
      quantity: detail.unit_quantity || 0,
      unit: detail.products?.unit || null,
      unit_cost: parseDecimal(detail.unit_cost)
    }))
  }));

  const formattedLedgerEntries = ledgerEntries.map((entry) => ({
    ledger_id: entry.ledger_id,
    created_at: entry.created_at,
    account_type: entry.account_type,
    account_id: entry.account_id,
    account_name:
      entry.account_type === 'customer'
        ? customerNameMap.get(entry.account_id) || `Customer #${entry.account_id}`
        : entry.account_type === 'supplier'
          ? supplierNameMap.get(entry.account_id) || `Supplier #${entry.account_id}`
          : `Employee #${entry.account_id}`,
    reference_type: entry.reference_type,
    reference_id: entry.reference_id,
    debit: parseDecimal(entry.debit),
    credit: parseDecimal(entry.credit)
  }));

  const formattedTransactions = transactions.map((transaction) => ({
    transaction_id: transaction.transaction_id,
    ref_id: transaction.ref_id,
    transaction_date: transaction.transaction_date,
    transaction_type: transaction.transaction_type,
    account_name: transaction.account_name || null,
    fund_source: transaction.fund_source || null,
    amount: parseDecimal(transaction.amount),
    remarks: transaction.remarks || null
  }));

  const receivables = customerBalances
    .map((customer) => ({
      customer_id: customer.customer_id,
      customer_name: customer.customer_name,
      balance: parseDecimal(customer.credit_balance)
    }))
    .filter((customer) => customer.balance > 0)
    .sort((left, right) => right.balance - left.balance);

  const payables = supplierBalances
    .map((supplier) => ({
      supplier_id: supplier.supplier_id,
      supplier_name: supplier.supplier_name,
      balance: parseDecimal(supplier.payable_balance)
    }))
    .filter((supplier) => supplier.balance > 0)
    .sort((left, right) => right.balance - left.balance);

  const inventoryAssets = inventoryBatches
    .map((inventory) => {
      const currentStock = inventory.current_stock || 0;
      const unitCost = parseDecimal(inventory.products?.unit_price);

      return {
        inventory_id: inventory.inventory_id,
        product_id: inventory.products?.product_id || null,
        product_name: inventory.products?.product_name || 'Unknown Product',
        product_code: inventory.products?.product_code || null,
        unit: inventory.products?.unit || null,
        current_stock: currentStock,
        unit_cost: unitCost,
        inventory_value: currentStock * unitCost
      };
    })
    .filter((inventory) => inventory.inventory_value > 0)
    .sort((left, right) => right.inventory_value - left.inventory_value);

  const activeSales = sales.filter((sale) => sale.is_active);
  const salesTotal = activeSales.reduce((sum, sale) => sum + parseDecimal(sale.total_amount), 0);
  const cashSalesTotal = activeSales.reduce((sum, sale) => sum + getSaleCashAmount(sale), 0);
  const onlineSalesTotal = activeSales.reduce((sum, sale) => sum + getSaleOnlineAmount(sale), 0);
  const creditSalesTotal = activeSales.reduce((sum, sale) => {
    const unpaidAmount = parseDecimal(sale.total_amount) - parseDecimal(sale.amount_paid);
    return sum + (unpaidAmount > 0 ? unpaidAmount : 0);
  }, 0);

  const customerPaymentsTotal = customerPaymentLedger.reduce(
    (sum, entry) => sum + parseDecimal(entry.credit),
    0
  );
  const supplierPaymentsTotal = supplierPaymentLedger.reduce(
    (sum, entry) => sum + parseDecimal(entry.credit),
    0
  );
  const purchaseOrdersTotal = purchaseOrders.reduce(
    (sum, order) => sum + parseDecimal(order.outstanding_balance),
    0
  );
  const suppliesTotal = supplies.reduce((sum, supply) => sum + parseDecimal(supply.total), 0);

  const customerPaymentTransactions = formattedTransactions.filter((transaction) =>
    CUSTOMER_PAYMENT_TYPES.has(transaction.transaction_type)
  );
  const supplierPaymentTransactions = formattedTransactions.filter((transaction) =>
    SUPPLIER_PAYMENT_TYPES.has(transaction.transaction_type)
  );

  const customerCashPaymentsTotal =
    customerPaymentTransactions.length > 0
      ? customerPaymentTransactions.reduce(
          (sum, transaction) =>
            sum + (isCashLikeFundSource(transaction.fund_source) ? transaction.amount : 0),
          0
        )
      : customerPaymentsTotal;

  const supplierCashPaymentsTotal =
    supplierPaymentTransactions.length > 0
      ? supplierPaymentTransactions.reduce(
          (sum, transaction) =>
            sum + (isCashLikeFundSource(transaction.fund_source) ? transaction.amount : 0),
          0
        )
      : supplierPaymentsTotal;

  const totalCashInflows = cashSalesTotal + customerCashPaymentsTotal;
  const totalCashOutflows = supplierCashPaymentsTotal;
  const expectedCashOnHand = openingCash + totalCashInflows - totalCashOutflows;
  const customerReceivablesTotal = receivables.reduce((sum, customer) => sum + customer.balance, 0);
  const supplierPayablesTotal = payables.reduce((sum, supplier) => sum + supplier.balance, 0);
  const inventoryValueTotal = inventoryAssets.reduce((sum, inventory) => sum + inventory.inventory_value, 0);
  const balanceSheet = buildBalanceSheet({
    businessDate,
    openingCash,
    expectedCashOnHand,
    onlineReceiptsTotal: onlineSalesTotal,
    customerReceivablesTotal,
    supplierPayablesTotal,
    inventoryValue: inventoryValueTotal,
    totalCashInflows,
    totalCashOutflows,
    salesTotal
  });

  return {
    businessDate,
    summary: {
      opening_cash: openingCash,
      sales_total: salesTotal,
      cash_sales_total: cashSalesTotal,
      online_sales_total: onlineSalesTotal,
      credit_sales_total: creditSalesTotal,
      customer_payments_total: customerPaymentsTotal,
      supplier_payments_total: supplierPaymentsTotal,
      purchase_orders_total: purchaseOrdersTotal,
      supplies_total: suppliesTotal,
      total_cash_inflows: totalCashInflows,
      total_cash_outflows: totalCashOutflows,
      expected_cash_on_hand: expectedCashOnHand,
      sales_count: formattedSales.length,
      customer_payment_count: customerPaymentTransactions.length,
      supplier_payment_count: supplierPaymentTransactions.length,
      purchase_order_count: formattedPurchaseOrders.length,
      supply_count: formattedSupplies.length,
      ledger_count: formattedLedgerEntries.length,
      total_transactions:
        formattedSales.length +
        customerPaymentTransactions.length +
        supplierPaymentTransactions.length +
        formattedPurchaseOrders.length +
        formattedSupplies.length
    },
    balanceSheet,
    sales: formattedSales,
    customerPayments: customerPaymentTransactions,
    supplierPayments: supplierPaymentTransactions,
    purchaseOrders: formattedPurchaseOrders,
    supplies: formattedSupplies,
    receivables,
    payables,
    inventoryAssets,
    ledgerEntries: formattedLedgerEntries,
    transactions: formattedTransactions
  };
}
