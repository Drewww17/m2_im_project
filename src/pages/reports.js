import { useState, useEffect, useCallback } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import {
  DocumentArrowDownIcon,
  LockClosedIcon,
  PlayIcon,
  PrinterIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { formatCurrency, formatDate } from '@/lib/utils';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDateTimeValue(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('en-PH');
}

function getBusinessDayBalanceSheet(snapshot, businessDay) {
  const balanceSheet = snapshot?.balanceSheet;
  const summary = snapshot?.summary || {};
  const expectedCashOnHand = Number(summary.expected_cash_on_hand || 0);
  const actualCashOnHand =
    businessDay?.actual_cash_on_hand === null || businessDay?.actual_cash_on_hand === undefined
      ? balanceSheet?.assets?.actual_cash_on_hand ?? null
      : Number(businessDay.actual_cash_on_hand);
  const closingCashBasis = actualCashOnHand ?? Number(balanceSheet?.assets?.closing_cash_basis ?? expectedCashOnHand);
  const digitalReceiptsToday = Number(balanceSheet?.assets?.digital_receipts_today ?? summary.online_sales_total ?? 0);
  const accountsReceivable = Number(balanceSheet?.assets?.accounts_receivable ?? 0);
  const inventoryAtCost = Number(balanceSheet?.assets?.inventory_at_cost ?? 0);
  const supplierPayables = Number(balanceSheet?.liabilities?.supplier_payables ?? 0);
  const totalAssets =
    closingCashBasis + digitalReceiptsToday + accountsReceivable + inventoryAtCost;
  const totalLiabilities = supplierPayables;

  return {
    as_of: snapshot?.businessDate || businessDay?.business_date || null,
    assets: {
      opening_cash: Number(balanceSheet?.assets?.opening_cash ?? summary.opening_cash ?? 0),
      expected_cash_on_hand: expectedCashOnHand,
      actual_cash_on_hand: actualCashOnHand,
      closing_cash_basis: closingCashBasis,
      digital_receipts_today: digitalReceiptsToday,
      accounts_receivable: accountsReceivable,
      inventory_at_cost: inventoryAtCost,
      total_assets: totalAssets
    },
    liabilities: {
      supplier_payables: supplierPayables,
      total_liabilities: totalLiabilities
    },
    equity: {
      net_business_position: totalAssets - totalLiabilities,
      daily_net_cash_movement: Number(
        balanceSheet?.equity?.daily_net_cash_movement ??
        (Number(summary.total_cash_inflows || 0) - Number(summary.total_cash_outflows || 0))
      ),
      gross_sales: Number(balanceSheet?.equity?.gross_sales ?? summary.sales_total ?? 0)
    }
  };
}

function renderPrintTable(title, columns, rows) {
  if (!rows || rows.length === 0) {
    return '';
  }

  const head = columns
    .map(
      (column) =>
        `<th style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:${column.align || 'left'};font-size:12px;color:#6b7280;">${escapeHtml(column.label)}</th>`
    )
    .join('');
  const body = rows
    .map((row) => {
      const cells = columns
        .map((column) => {
          const rawValue =
            typeof column.value === 'function' ? column.value(row) : row?.[column.value];
          return `<td style="padding:10px 12px;border-bottom:1px solid #f3f4f6;text-align:${column.align || 'left'};font-size:12px;color:#111827;">${escapeHtml(rawValue)}</td>`;
        })
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');

  return `
    <section style="margin-top:24px;">
      <h2 style="margin:0 0 10px 0;font-size:16px;">${escapeHtml(title)}</h2>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
        <thead style="background:#f9fafb;"><tr>${head}</tr></thead>
        <tbody>${body}</tbody>
      </table>
    </section>
  `;
}

function printBusinessDaySummary(snapshot, businessDay) {
  if (typeof window === 'undefined' || !snapshot) return false;

  const summary = snapshot.summary || {};
  const balanceSheet = getBusinessDayBalanceSheet(snapshot, businessDay);
  const printWindow = window.open('', '_blank');
  if (!printWindow) return false;

  const receivables = renderPrintTable(
    'Accounts Receivable',
    [
      { label: 'Customer', value: 'customer_name' },
      { label: 'Balance', value: (row) => formatCurrency(row.balance || 0), align: 'right' }
    ],
    snapshot.receivables || []
  );
  const payables = renderPrintTable(
    'Supplier Payables',
    [
      { label: 'Supplier', value: 'supplier_name' },
      { label: 'Balance', value: (row) => formatCurrency(row.balance || 0), align: 'right' }
    ],
    snapshot.payables || []
  );
  const customerPayments = renderPrintTable(
    'Customer Payments',
    [
      { label: 'Time', value: (row) => formatDateTimeValue(row.transaction_date) },
      { label: 'Customer', value: 'account_name' },
      { label: 'Source', value: 'fund_source' },
      { label: 'Amount', value: (row) => formatCurrency(row.amount || 0), align: 'right' }
    ],
    snapshot.customerPayments || []
  );
  const supplierPayments = renderPrintTable(
    'Supplier Payments',
    [
      { label: 'Time', value: (row) => formatDateTimeValue(row.transaction_date) },
      { label: 'Supplier', value: 'account_name' },
      { label: 'Source', value: 'fund_source' },
      { label: 'Amount', value: (row) => formatCurrency(row.amount || 0), align: 'right' }
    ],
    snapshot.supplierPayments || []
  );
  const supplies = renderPrintTable(
    'Supply Records',
    [
      { label: 'Date', value: (row) => formatDateTimeValue(row.supply_date) },
      { label: 'Supplier', value: 'supplier' },
      { label: 'Handled By', value: 'handled_by' },
      { label: 'Total', value: (row) => formatCurrency(row.total || 0), align: 'right' }
    ],
    snapshot.supplies || []
  );
  const purchaseOrders = renderPrintTable(
    'Purchase Orders',
    [
      { label: 'Date', value: (row) => formatDateTimeValue(row.order_date) },
      { label: 'Customer', value: 'customer' },
      { label: 'Status', value: 'po_status' },
      { label: 'Outstanding', value: (row) => formatCurrency(row.outstanding_balance || 0), align: 'right' }
    ],
    snapshot.purchaseOrders || []
  );
  const salesTable = renderPrintTable(
    'Sales Transactions',
    [
      { label: 'Invoice', value: (row) => `SALE-${row.sale_id}` },
      { label: 'Time', value: (row) => formatDateTimeValue(row.created_at || row.sale_date) },
      { label: 'Customer', value: 'customer' },
      { label: 'Payment', value: 'payment_method' },
      { label: 'Cash', value: (row) => formatCurrency(row.cash_amount || 0), align: 'right' },
      { label: 'Online', value: (row) => formatCurrency(row.online_amount || 0), align: 'right' },
      { label: 'Total', value: (row) => formatCurrency(row.total_amount || 0), align: 'right' }
    ],
    snapshot.sales || []
  );

  const html = `
    <!doctype html>
    <html>
      <head><meta charset="utf-8" /><title>Business Day ${escapeHtml(snapshot.businessDate)}</title></head>
      <body style="font-family:Arial,Helvetica,sans-serif;padding:24px;max-width:860px;margin:auto;color:#111827;">
        <h1 style="margin:0 0 6px 0;">Business Day Balance Sheet</h1>
        <div style="font-size:14px;color:#4b5563;margin-bottom:18px;">Date: ${escapeHtml(snapshot.businessDate)}</div>
        <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:18px;">
          <div style="padding:12px;border:1px solid #e5e7eb;border-radius:12px;"><div style="font-size:12px;color:#6b7280;">Opening Cash</div><div style="font-size:22px;font-weight:700;">${formatCurrency(summary.opening_cash || 0)}</div></div>
          <div style="padding:12px;border:1px solid #bbf7d0;background:#f0fdf4;border-radius:12px;"><div style="font-size:12px;color:#166534;">Cash Inflows</div><div style="font-size:22px;font-weight:700;color:#166534;">${formatCurrency(summary.total_cash_inflows || 0)}</div></div>
          <div style="padding:12px;border:1px solid #fecaca;background:#fef2f2;border-radius:12px;"><div style="font-size:12px;color:#991b1b;">Cash Outflows</div><div style="font-size:22px;font-weight:700;color:#991b1b;">${formatCurrency(summary.total_cash_outflows || 0)}</div></div>
          <div style="padding:12px;border:1px solid #bfdbfe;background:#eff6ff;border-radius:12px;"><div style="font-size:12px;color:#1d4ed8;">Expected Cash</div><div style="font-size:22px;font-weight:700;color:#1d4ed8;">${formatCurrency(summary.expected_cash_on_hand || 0)}</div></div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-bottom:18px;">
          <div style="padding:14px;border:1px solid #dbeafe;background:#eff6ff;border-radius:12px;">
            <div style="font-size:13px;font-weight:700;color:#1d4ed8;margin-bottom:8px;">Assets</div>
            <div style="font-size:12px;color:#374151;line-height:1.8;">
              <div>Closing Cash Basis: <strong>${formatCurrency(balanceSheet.assets.closing_cash_basis || 0)}</strong></div>
              <div>Digital Receipts: <strong>${formatCurrency(balanceSheet.assets.digital_receipts_today || 0)}</strong></div>
              <div>Accounts Receivable: <strong>${formatCurrency(balanceSheet.assets.accounts_receivable || 0)}</strong></div>
              <div>Inventory at Cost: <strong>${formatCurrency(balanceSheet.assets.inventory_at_cost || 0)}</strong></div>
              <div style="margin-top:8px;font-size:14px;">Total Assets: <strong>${formatCurrency(balanceSheet.assets.total_assets || 0)}</strong></div>
            </div>
          </div>
          <div style="padding:14px;border:1px solid #fee2e2;background:#fff1f2;border-radius:12px;">
            <div style="font-size:13px;font-weight:700;color:#be123c;margin-bottom:8px;">Liabilities</div>
            <div style="font-size:12px;color:#374151;line-height:1.8;">
              <div>Supplier Payables: <strong>${formatCurrency(balanceSheet.liabilities.supplier_payables || 0)}</strong></div>
              <div style="margin-top:8px;font-size:14px;">Total Liabilities: <strong>${formatCurrency(balanceSheet.liabilities.total_liabilities || 0)}</strong></div>
            </div>
          </div>
          <div style="padding:14px;border:1px solid #dcfce7;background:#f0fdf4;border-radius:12px;">
            <div style="font-size:13px;font-weight:700;color:#15803d;margin-bottom:8px;">Equity / Net Position</div>
            <div style="font-size:12px;color:#374151;line-height:1.8;">
              <div>Net Business Position: <strong>${formatCurrency(balanceSheet.equity.net_business_position || 0)}</strong></div>
              <div>Gross Sales: <strong>${formatCurrency(balanceSheet.equity.gross_sales || 0)}</strong></div>
              <div>Daily Net Cash Movement: <strong>${formatCurrency(balanceSheet.equity.daily_net_cash_movement || 0)}</strong></div>
            </div>
          </div>
        </div>
        <div style="padding:12px;border:1px solid #e5e7eb;border-radius:12px;background:#f9fafb;font-size:13px;line-height:1.7;">
          <div><strong>Status:</strong> ${escapeHtml(businessDay?.status || 'OPEN')}</div>
          <div><strong>Closed At:</strong> ${formatDateTimeValue(businessDay?.closed_at)}</div>
          <div><strong>Closed By:</strong> ${escapeHtml(businessDay?.closed_by_name || businessDay?.closed_by_username || '-')}</div>
          <div><strong>Actual Cash On Hand:</strong> ${businessDay?.actual_cash_on_hand === null || businessDay?.actual_cash_on_hand === undefined ? '-' : formatCurrency(businessDay.actual_cash_on_hand)}</div>
          <div><strong>Variance:</strong> ${businessDay?.cash_variance === null || businessDay?.cash_variance === undefined ? '-' : formatCurrency(businessDay.cash_variance)}</div>
          <div><strong>Total Recorded Transactions:</strong> ${summary.total_transactions || 0}</div>
        </div>
        ${salesTable}
        ${customerPayments}
        ${supplierPayments}
        ${purchaseOrders}
        ${supplies}
        ${receivables}
        ${payables}
      </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => printWindow.print(), 200);
  return true;
}

function AccountingTable({ title, description, emptyText, columns, rows }) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-5 py-4">
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`px-4 py-3 text-xs font-medium uppercase text-gray-500 ${
                    column.align === 'right' ? 'text-right' : 'text-left'
                  }`}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-5 text-center text-sm text-gray-500">
                  {emptyText}
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={row.id || row.transaction_id || row.sale_id || row.po_id || row.supply_id || row.customer_id || row.supplier_id || index}>
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={`px-4 py-3 text-sm text-gray-700 ${
                        column.align === 'right' ? 'text-right' : 'text-left'
                      }`}
                    >
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Reports() {
  const { user } = useAuth();
  const [dailySales, setDailySales] = useState(null);
  const [ledger, setLedger] = useState(null);
  const [businessDay, setBusinessDay] = useState(null);
  const [businessDaySnapshot, setBusinessDaySnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [businessDayLoading, setBusinessDayLoading] = useState(true);
  const [savingBusinessDay, setSavingBusinessDay] = useState(false);
  const [activeReport, setActiveReport] = useState('daily-sales');
  const [showOpenDayModal, setShowOpenDayModal] = useState(false);
  const [showCloseShiftModal, setShowCloseShiftModal] = useState(false);
  const [openingCash, setOpeningCash] = useState('0');
  const [openingNote, setOpeningNote] = useState('');
  const [closingNote, setClosingNote] = useState('');
  const [actualCashOnHand, setActualCashOnHand] = useState('');
  const [filters, setFilters] = useState({
    date: new Date().toISOString().split('T')[0],
    startDate: '',
    endDate: '',
    type: ''
  });

  const fetchDailySales = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.date) params.append('date', filters.date);
      const res = await fetch(`/api/reports/daily-sales?${params}`);
      const data = await res.json();
      if (res.ok) setDailySales(data.report || null);
      else toast.error(data.error);
    } catch {
      toast.error('Failed to fetch daily sales report');
    } finally {
      setLoading(false);
    }
  }, [filters.date]);

  const fetchLedger = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.type) params.append('accountType', filters.type);
      const res = await fetch(`/api/reports/ledger?${params}`);
      const data = await res.json();
      if (res.ok) {
        const entries = data.ledger || [];
        const totalDebit = entries.reduce((sum, entry) => sum + (entry.debit || 0), 0);
        const totalCredit = entries.reduce((sum, entry) => sum + (entry.credit || 0), 0);
        setLedger({ entries, summary: { totalDebit, totalCredit, netBalance: totalCredit - totalDebit } });
      } else {
        toast.error(data.error);
      }
    } catch {
      toast.error('Failed to fetch ledger report');
    } finally {
      setLoading(false);
    }
  }, [filters.endDate, filters.startDate, filters.type]);

  const fetchBusinessDay = useCallback(async () => {
    setBusinessDayLoading(true);
    try {
      const params = new URLSearchParams({ date: filters.date });
      const res = await fetch(`/api/reports/business-day?${params}`);
      const data = await res.json();
      if (res.ok) {
        setBusinessDay(data.businessDay || null);
        setBusinessDaySnapshot(data.snapshot || data.liveSnapshot || null);
      } else {
        toast.error(data.error);
      }
    } catch {
      toast.error('Failed to fetch business day');
    } finally {
      setBusinessDayLoading(false);
    }
  }, [filters.date]);

  useEffect(() => {
    if (activeReport === 'daily-sales') {
      fetchDailySales();
      fetchBusinessDay();
    } else {
      fetchLedger();
    }
  }, [activeReport, fetchBusinessDay, fetchDailySales, fetchLedger]);

  const exportToCSV = () => {
    let csvContent = '';
    let filename = '';
    if (activeReport === 'daily-sales' && dailySales) {
      filename = `daily-sales-${filters.date}.csv`;
      csvContent = 'Sale ID,Date,Customer,Cashier,Payment Method,Cash Amount,Online Amount,Total,Amount Paid,Status\n';
      dailySales.sales?.forEach((sale) => {
        csvContent += [
          sale.sale_id,
          formatDate(sale.created_at || sale.sale_date),
          sale.customer || 'Walk-in',
          sale.cashier || '',
          sale.payment_method || '',
          sale.cash_amount || 0,
          sale.online_amount || 0,
          sale.total_amount || 0,
          sale.amount_paid || 0,
          sale.sale_status || 'COMPLETE'
        ].join(',') + '\n';
      });
    } else if (activeReport === 'ledger' && ledger) {
      filename = `ledger-${filters.startDate || 'all'}-to-${filters.endDate || 'all'}.csv`;
      csvContent = 'Date,Account Type,Reference Type,Reference ID,Debit,Credit,Net\n';
      ledger.entries?.forEach((entry) => {
        csvContent += [
          formatDate(entry.created_at),
          entry.account_type,
          entry.reference_type || '',
          entry.reference_id || '',
          entry.debit || 0,
          entry.credit || 0,
          (entry.credit || 0) - (entry.debit || 0)
        ].join(',') + '\n';
      });
    }
    if (!csvContent || !filename) return toast.error('No report data to export');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Report exported successfully!');
  };

  const daySummary = businessDaySnapshot?.summary || {};
  const balanceSheet = getBusinessDayBalanceSheet(businessDaySnapshot, businessDay);
  const customerPayments = businessDaySnapshot?.customerPayments || [];
  const supplierPayments = businessDaySnapshot?.supplierPayments || [];
  const purchaseOrders = businessDaySnapshot?.purchaseOrders || [];
  const supplies = businessDaySnapshot?.supplies || [];
  const receivables = businessDaySnapshot?.receivables || [];
  const payables = businessDaySnapshot?.payables || [];
  const isBusinessDayOpen = businessDay?.status === 'OPEN';
  const isBusinessDayClosed = businessDay?.status === 'CLOSED';

  const openBusinessDayModal = () => {
    setOpeningCash(String(businessDay?.opening_cash ?? 0));
    setOpeningNote(businessDay?.opening_note || '');
    setShowOpenDayModal(true);
  };

  const saveOpeningCash = async () => {
    const parsedOpeningCash = Number(openingCash);
    if (!Number.isFinite(parsedOpeningCash) || parsedOpeningCash < 0) {
      return toast.error('Opening cash must be a valid non-negative amount');
    }
    setSavingBusinessDay(true);
    try {
      const res = await fetch('/api/reports/business-day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: filters.date, openingCash: parsedOpeningCash, openingNote })
      });
      const data = await res.json();
      if (!res.ok) return toast.error(data.error || 'Failed to save opening cash');
      setBusinessDay(data.businessDay || null);
      setShowOpenDayModal(false);
      await fetchBusinessDay();
      toast.success('Opening cash saved');
    } catch {
      toast.error('Failed to save opening cash');
    } finally {
      setSavingBusinessDay(false);
    }
  };

  const closeBusinessDay = async () => {
    const parsedActualCash = actualCashOnHand.trim() === '' ? null : Number(actualCashOnHand);
    if (parsedActualCash !== null && (!Number.isFinite(parsedActualCash) || parsedActualCash < 0)) {
      return toast.error('Actual cash on hand must be a valid non-negative amount');
    }
    setSavingBusinessDay(true);
    try {
      const res = await fetch('/api/reports/business-day', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: filters.date, closingNote, actualCashOnHand: parsedActualCash })
      });
      const data = await res.json();
      if (!res.ok) return toast.error(data.error || 'Failed to close business day');
      setBusinessDay(data.businessDay || null);
      setBusinessDaySnapshot(data.snapshot || null);
      setShowCloseShiftModal(false);
      await fetchBusinessDay();
      printBusinessDaySummary(data.snapshot, data.businessDay);
      toast.success('Business day closed');
    } catch {
      toast.error('Failed to close business day');
    } finally {
      setSavingBusinessDay(false);
    }
  };

  const printCurrentBusinessDay = () => {
    if (!businessDaySnapshot) return toast.error('No business day summary available');
    if (!printBusinessDaySummary(businessDaySnapshot, businessDay)) {
      toast.error('Unable to open print dialog');
    }
  };

  return (
    <ProtectedRoute requiredRole="MANAGER">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
            {activeReport === 'daily-sales' && (
              <p className="mt-1 text-sm text-gray-500">
                {businessDay ? `Business day ${filters.date} is ${businessDay.status.toLowerCase()}` : `No business day record yet for ${filters.date}`}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {activeReport === 'daily-sales' && (
              <>
                <button
                  onClick={openBusinessDayModal}
                  disabled={businessDayLoading || isBusinessDayClosed}
                  className="flex items-center gap-2 rounded-lg border border-blue-300 bg-blue-50 px-4 py-2 text-blue-800 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <PlayIcon className="h-5 w-5" />
                  {isBusinessDayOpen ? 'Update Opening Cash' : 'Start Day'}
                </button>
                <button
                  onClick={() => {
                    if (!isBusinessDayOpen) return toast.error('Set opening cash first before closing the day');
                    setClosingNote(businessDay?.closing_note || '');
                    setActualCashOnHand(
                      businessDay?.actual_cash_on_hand === null || businessDay?.actual_cash_on_hand === undefined
                        ? ''
                        : String(businessDay.actual_cash_on_hand)
                    );
                    setShowCloseShiftModal(true);
                  }}
                  disabled={loading || businessDayLoading || !isBusinessDayOpen}
                  className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <LockClosedIcon className="h-5 w-5" />
                  Close Day
                </button>
                <button
                  onClick={printCurrentBusinessDay}
                  disabled={!businessDaySnapshot}
                  className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <PrinterIcon className="h-5 w-5" />
                  Print Balance Sheet
                </button>
              </>
            )}
            <button
              onClick={exportToCSV}
              disabled={loading}
              className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <DocumentArrowDownIcon className="h-5 w-5" />
              Export CSV
            </button>
          </div>
        </div>

        <div className="rounded-lg bg-white p-4 shadow">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveReport('daily-sales')}
              className={`rounded-lg px-4 py-2 font-medium transition-colors ${
                activeReport === 'daily-sales' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Daily Sales Report
            </button>
            <button
              onClick={() => setActiveReport('ledger')}
              className={`rounded-lg px-4 py-2 font-medium transition-colors ${
                activeReport === 'ledger' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Ledger Report
            </button>
          </div>
        </div>

        <div className="rounded-lg bg-white p-4 shadow">
          {activeReport === 'daily-sales' ? (
            <div className="flex items-end gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Date</label>
                <input
                  type="date"
                  value={filters.date}
                  onChange={(e) => setFilters({ ...filters, date: e.target.value })}
                  className="rounded-lg border px-4 py-2 focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Start Date</label>
                <input type="date" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} className="w-full rounded-lg border px-4 py-2 focus:ring-2 focus:ring-green-500" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">End Date</label>
                <input type="date" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} className="w-full rounded-lg border px-4 py-2 focus:ring-2 focus:ring-green-500" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Type</label>
                <select value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })} className="w-full rounded-lg border px-4 py-2 focus:ring-2 focus:ring-green-500">
                  <option value="">All Types</option>
                  <option value="SALE">Sales</option>
                  <option value="PURCHASE">Purchases</option>
                  <option value="EXPENSE">Expenses</option>
                  <option value="PAYMENT_RECEIVED">Payments Received</option>
                  <option value="PAYMENT_MADE">Payments Made</option>
                </select>
              </div>
              <div className="flex items-end">
                <button onClick={() => setFilters({ ...filters, startDate: '', endDate: '', type: '' })} className="w-full rounded-lg border px-4 py-2 hover:bg-gray-50">
                  Clear Filters
                </button>
              </div>
            </div>
          )}
        </div>

        {activeReport === 'daily-sales' && (
          <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Business Day Control</h2>
                <p className="text-sm text-gray-500">Opening petty cash, daily transactions, and the close-day accounting snapshot are stored in the database.</p>
              </div>
              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                isBusinessDayClosed ? 'bg-red-100 text-red-700' : isBusinessDayOpen ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
              }`}>
                {businessDay?.status || 'NOT STARTED'}
              </span>
            </div>

            {businessDayLoading ? (
              <div className="rounded-lg bg-gray-50 p-4 text-sm text-gray-500">Loading business day summary...</div>
            ) : (
              <>
                {!businessDay && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
                    Start the business day to save the opening cash. Once closed, new sales and related transactions for that day are blocked server-side.
                  </div>
                )}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                  <div className="rounded-lg bg-slate-50 p-4"><p className="text-sm text-slate-500">Opening Cash</p><p className="text-2xl font-bold text-slate-900">{formatCurrency(daySummary.opening_cash || 0)}</p></div>
                  <div className="rounded-lg bg-green-50 p-4"><p className="text-sm text-green-700">Cash Inflows</p><p className="text-2xl font-bold text-green-700">{formatCurrency(daySummary.total_cash_inflows || 0)}</p></div>
                  <div className="rounded-lg bg-red-50 p-4"><p className="text-sm text-red-700">Cash Outflows</p><p className="text-2xl font-bold text-red-700">{formatCurrency(daySummary.total_cash_outflows || 0)}</p></div>
                  <div className="rounded-lg bg-blue-50 p-4"><p className="text-sm text-blue-700">Expected Cash</p><p className="text-2xl font-bold text-blue-700">{formatCurrency(daySummary.expected_cash_on_hand || 0)}</p></div>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
                  <div className="rounded-lg border p-4"><p className="text-sm text-gray-500">Sales</p><p className="text-xl font-bold text-gray-900">{formatCurrency(daySummary.sales_total || 0)}</p><p className="text-xs text-gray-500">{daySummary.sales_count || 0} transaction(s)</p></div>
                  <div className="rounded-lg border p-4"><p className="text-sm text-gray-500">Customer Payments</p><p className="text-xl font-bold text-gray-900">{formatCurrency(daySummary.customer_payments_total || 0)}</p><p className="text-xs text-gray-500">{daySummary.customer_payment_count || 0} payment(s)</p></div>
                  <div className="rounded-lg border p-4"><p className="text-sm text-gray-500">Supplier Payments</p><p className="text-xl font-bold text-gray-900">{formatCurrency(daySummary.supplier_payments_total || 0)}</p><p className="text-xs text-gray-500">{daySummary.supplier_payment_count || 0} payment(s)</p></div>
                  <div className="rounded-lg border p-4"><p className="text-sm text-gray-500">Purchase Orders</p><p className="text-xl font-bold text-gray-900">{formatCurrency(daySummary.purchase_orders_total || 0)}</p><p className="text-xs text-gray-500">{daySummary.purchase_order_count || 0} PO(s)</p></div>
                  <div className="rounded-lg border p-4"><p className="text-sm text-gray-500">Supplies</p><p className="text-xl font-bold text-gray-900">{formatCurrency(daySummary.supplies_total || 0)}</p><p className="text-xs text-gray-500">{daySummary.supply_count || 0} supply record(s)</p></div>
                </div>
                {isBusinessDayClosed && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
                    Closed at {businessDay?.closed_at ? new Date(businessDay.closed_at).toLocaleString('en-PH') : '-'} by {businessDay?.closed_by_name || businessDay?.closed_by_username || user?.fullName || user?.username}. Actual cash: {businessDay?.actual_cash_on_hand === null || businessDay?.actual_cash_on_hand === undefined ? '-' : formatCurrency(businessDay.actual_cash_on_hand)}. Variance: {businessDay?.cash_variance === null || businessDay?.cash_variance === undefined ? '-' : formatCurrency(businessDay.cash_variance)}.
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeReport === 'daily-sales' && !loading && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
              <p className="text-sm font-medium text-blue-700">Assets</p>
              <div className="mt-3 space-y-2 text-sm text-blue-950">
                <div className="flex items-center justify-between"><span>Closing Cash Basis</span><span className="font-semibold">{formatCurrency(balanceSheet.assets.closing_cash_basis || 0)}</span></div>
                <div className="flex items-center justify-between"><span>Digital Receipts</span><span className="font-semibold">{formatCurrency(balanceSheet.assets.digital_receipts_today || 0)}</span></div>
                <div className="flex items-center justify-between"><span>Accounts Receivable</span><span className="font-semibold">{formatCurrency(balanceSheet.assets.accounts_receivable || 0)}</span></div>
                <div className="flex items-center justify-between"><span>Inventory at Cost</span><span className="font-semibold">{formatCurrency(balanceSheet.assets.inventory_at_cost || 0)}</span></div>
              </div>
              <div className="mt-4 border-t border-blue-200 pt-3 text-lg font-bold text-blue-900">
                Total Assets {formatCurrency(balanceSheet.assets.total_assets || 0)}
              </div>
            </div>
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 shadow-sm">
              <p className="text-sm font-medium text-rose-700">Liabilities</p>
              <div className="mt-3 space-y-2 text-sm text-rose-950">
                <div className="flex items-center justify-between"><span>Supplier Payables</span><span className="font-semibold">{formatCurrency(balanceSheet.liabilities.supplier_payables || 0)}</span></div>
              </div>
              <div className="mt-4 border-t border-rose-200 pt-3 text-lg font-bold text-rose-900">
                Total Liabilities {formatCurrency(balanceSheet.liabilities.total_liabilities || 0)}
              </div>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
              <p className="text-sm font-medium text-emerald-700">Equity / Net Position</p>
              <div className="mt-3 space-y-2 text-sm text-emerald-950">
                <div className="flex items-center justify-between"><span>Net Business Position</span><span className="font-semibold">{formatCurrency(balanceSheet.equity.net_business_position || 0)}</span></div>
                <div className="flex items-center justify-between"><span>Gross Sales</span><span className="font-semibold">{formatCurrency(balanceSheet.equity.gross_sales || 0)}</span></div>
                <div className="flex items-center justify-between"><span>Daily Net Cash Movement</span><span className="font-semibold">{formatCurrency(balanceSheet.equity.daily_net_cash_movement || 0)}</span></div>
              </div>
              <div className="mt-4 border-t border-emerald-200 pt-3 text-sm text-emerald-800">
                {balanceSheet.assets.actual_cash_on_hand === null || balanceSheet.assets.actual_cash_on_hand === undefined
                  ? 'Using expected cash on hand as the close-day cash basis.'
                  : `Actual cash basis recorded: ${formatCurrency(balanceSheet.assets.actual_cash_on_hand)}`}
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="rounded-lg bg-white p-8 text-center text-gray-500 shadow">Loading report...</div>
        ) : activeReport === 'daily-sales' ? (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
              <div className="rounded-lg bg-white p-4 shadow"><p className="text-sm text-gray-500">Total Sales</p><p className="text-2xl font-bold text-gray-900">{formatCurrency(dailySales?.summary?.total_sales || 0)}</p></div>
              <div className="rounded-lg bg-white p-4 shadow"><p className="text-sm text-gray-500">Transactions</p><p className="text-2xl font-bold text-blue-600">{dailySales?.summary?.total_transactions || 0}</p></div>
              <div className="rounded-lg bg-white p-4 shadow"><p className="text-sm text-gray-500">Cash Received</p><p className="text-2xl font-bold text-green-600">{formatCurrency(dailySales?.summary?.cash_received || 0)}</p></div>
              <div className="rounded-lg bg-white p-4 shadow"><p className="text-sm text-gray-500">Online Received</p><p className="text-2xl font-bold text-sky-600">{formatCurrency(dailySales?.summary?.online_received || 0)}</p></div>
              <div className="rounded-lg bg-white p-4 shadow"><p className="text-sm text-gray-500">Credit Sales</p><p className="text-2xl font-bold text-yellow-600">{formatCurrency(dailySales?.summary?.credit_sales || 0)}</p></div>
            </div>
            <div className="overflow-hidden rounded-lg bg-white shadow">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Invoice</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Time</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Customer</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Cashier</th>
                    <th className="px-6 py-3 text-center text-xs font-medium uppercase text-gray-500">Payment</th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">Cash</th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">Online</th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {dailySales?.sales?.length === 0 ? (
                    <tr><td colSpan="8" className="px-6 py-4 text-center text-gray-500">No sales for selected date</td></tr>
                  ) : (
                    dailySales?.sales?.map((sale) => (
                      <tr key={sale.sale_id}>
                        <td className="px-6 py-4 text-sm font-mono">SALE-{sale.sale_id}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{formatDate(sale.created_at || sale.sale_date)}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">{sale.customer || 'Walk-in'}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{sale.cashier}</td>
                        <td className="px-6 py-4 text-center"><span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium">{sale.payment_method}</span></td>
                        <td className="px-6 py-4 text-right text-sm text-green-700">{formatCurrency(sale.cash_amount || 0)}</td>
                        <td className="px-6 py-4 text-right text-sm text-sky-700">{formatCurrency(sale.online_amount || 0)}</td>
                        <td className="px-6 py-4 text-right font-medium">{formatCurrency(sale.total_amount)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <AccountingTable
                title="Customer Payments"
                description="Credit collections recorded during the selected business day."
                emptyText="No customer payments recorded for this date."
                columns={[
                  { key: 'time', label: 'Time', render: (row) => formatDate(row.transaction_date) },
                  { key: 'customer', label: 'Customer', render: (row) => row.account_name || '-' },
                  { key: 'source', label: 'Source', render: (row) => row.fund_source || '-' },
                  { key: 'amount', label: 'Amount', align: 'right', render: (row) => formatCurrency(row.amount || 0) }
                ]}
                rows={customerPayments}
              />
              <AccountingTable
                title="Supplier Payments"
                description="Cash disbursements made to suppliers during the day."
                emptyText="No supplier payments recorded for this date."
                columns={[
                  { key: 'time', label: 'Time', render: (row) => formatDate(row.transaction_date) },
                  { key: 'supplier', label: 'Supplier', render: (row) => row.account_name || '-' },
                  { key: 'source', label: 'Source', render: (row) => row.fund_source || '-' },
                  { key: 'amount', label: 'Amount', align: 'right', render: (row) => formatCurrency(row.amount || 0) }
                ]}
                rows={supplierPayments}
              />
              <AccountingTable
                title="Purchase Orders"
                description="Outstanding purchase order obligations captured for the selected day."
                emptyText="No purchase orders recorded for this date."
                columns={[
                  { key: 'date', label: 'Date', render: (row) => formatDate(row.order_date) },
                  { key: 'customer', label: 'Customer', render: (row) => row.customer || '-' },
                  { key: 'status', label: 'Status', render: (row) => row.po_status || '-' },
                  { key: 'outstanding', label: 'Outstanding', align: 'right', render: (row) => formatCurrency(row.outstanding_balance || 0) }
                ]}
                rows={purchaseOrders}
              />
              <AccountingTable
                title="Supplies"
                description="Supply receipts and their cost totals for the day."
                emptyText="No supplies recorded for this date."
                columns={[
                  { key: 'date', label: 'Date', render: (row) => formatDate(row.supply_date) },
                  { key: 'supplier', label: 'Supplier', render: (row) => row.supplier || '-' },
                  { key: 'handledBy', label: 'Handled By', render: (row) => row.handled_by || '-' },
                  { key: 'total', label: 'Total', align: 'right', render: (row) => formatCurrency(row.total || 0) }
                ]}
                rows={supplies}
              />
              <AccountingTable
                title="Accounts Receivable"
                description="Open customer balances at close of day."
                emptyText="No open receivables."
                columns={[
                  { key: 'customer', label: 'Customer', render: (row) => row.customer_name || '-' },
                  { key: 'balance', label: 'Balance', align: 'right', render: (row) => formatCurrency(row.balance || 0) }
                ]}
                rows={receivables}
              />
              <AccountingTable
                title="Supplier Payables"
                description="Outstanding supplier obligations at close of day."
                emptyText="No supplier payables."
                columns={[
                  { key: 'supplier', label: 'Supplier', render: (row) => row.supplier_name || '-' },
                  { key: 'balance', label: 'Balance', align: 'right', render: (row) => formatCurrency(row.balance || 0) }
                ]}
                rows={payables}
              />
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-lg bg-white p-4 shadow"><p className="text-sm text-gray-500">Total Debit</p><p className="text-2xl font-bold text-red-600">{formatCurrency(ledger?.summary?.totalDebit || 0)}</p></div>
              <div className="rounded-lg bg-white p-4 shadow"><p className="text-sm text-gray-500">Total Credit</p><p className="text-2xl font-bold text-green-600">{formatCurrency(ledger?.summary?.totalCredit || 0)}</p></div>
              <div className="rounded-lg bg-white p-4 shadow"><p className="text-sm text-gray-500">Net Balance</p><p className={`text-2xl font-bold ${(ledger?.summary?.netBalance || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(ledger?.summary?.netBalance || 0)}</p></div>
            </div>
            <div className="overflow-hidden rounded-lg bg-white shadow">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Account Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Reference Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Reference ID</th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">Debit</th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">Credit</th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">Net</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {ledger?.entries?.length === 0 ? (
                    <tr><td colSpan="7" className="px-6 py-4 text-center text-gray-500">No ledger entries found</td></tr>
                  ) : (
                    ledger?.entries?.map((entry) => (
                      <tr key={entry.ledger_id}>
                        <td className="px-6 py-4 text-sm text-gray-500">{formatDate(entry.created_at)}</td>
                        <td className="px-6 py-4"><span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium">{entry.account_type}</span></td>
                        <td className="px-6 py-4 text-sm font-mono">{entry.reference_type || '-'}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">{entry.reference_id ? `#${entry.reference_id}` : '-'}</td>
                        <td className="px-6 py-4 text-right text-sm text-red-600">{entry.debit ? formatCurrency(entry.debit) : '-'}</td>
                        <td className="px-6 py-4 text-right text-sm text-green-600">{entry.credit ? formatCurrency(entry.credit) : '-'}</td>
                        <td className="px-6 py-4 text-right font-medium">{formatCurrency((entry.credit || 0) - (entry.debit || 0))}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {showOpenDayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-xl rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{isBusinessDayOpen ? 'Update Opening Cash' : 'Start Business Day'}</h2>
                <p className="text-sm text-gray-500">Set the petty cash or opening register amount for {filters.date}.</p>
              </div>
              <button onClick={() => setShowOpenDayModal(false)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            <div className="space-y-5 px-6 py-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Opening Cash</label>
                <input type="number" min="0" step="0.01" value={openingCash} onChange={(e) => setOpeningCash(e.target.value)} className="w-full rounded-lg border px-4 py-3 focus:ring-2 focus:ring-green-500" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Opening Note (optional)</label>
                <textarea value={openingNote} onChange={(e) => setOpeningNote(e.target.value)} rows={3} maxLength={255} placeholder="Add petty cash notes or opening shift remarks..." className="w-full rounded-lg border px-4 py-3 focus:ring-2 focus:ring-green-500" />
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t px-6 py-4">
              <button onClick={() => setShowOpenDayModal(false)} className="rounded-lg border px-4 py-2 hover:bg-gray-50">Cancel</button>
              <button onClick={saveOpeningCash} disabled={savingBusinessDay} className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">Save Opening Cash</button>
            </div>
          </div>
        </div>
      )}

      {showCloseShiftModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Close Day</h2>
                <p className="text-sm text-gray-500">This stores the day summary, balance sheet snapshot, and transaction listings in the database, then blocks new transactions for that business day.</p>
              </div>
              <button onClick={() => setShowCloseShiftModal(false)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            <div className="space-y-6 px-6 py-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <div className="rounded-lg bg-gray-50 p-4"><p className="text-sm text-gray-500">Opening Cash</p><p className="text-2xl font-bold text-gray-900">{formatCurrency(daySummary.opening_cash || 0)}</p></div>
                <div className="rounded-lg bg-green-50 p-4"><p className="text-sm text-green-700">Cash Inflows</p><p className="text-2xl font-bold text-green-700">{formatCurrency(daySummary.total_cash_inflows || 0)}</p></div>
                <div className="rounded-lg bg-red-50 p-4"><p className="text-sm text-red-700">Cash Outflows</p><p className="text-2xl font-bold text-red-700">{formatCurrency(daySummary.total_cash_outflows || 0)}</p></div>
                <div className="rounded-lg bg-blue-50 p-4"><p className="text-sm text-blue-700">Expected Cash</p><p className="text-2xl font-bold text-blue-700">{formatCurrency(daySummary.expected_cash_on_hand || 0)}</p></div>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                  <p className="text-sm font-medium text-blue-700">Total Assets</p>
                  <p className="text-2xl font-bold text-blue-900">{formatCurrency(balanceSheet.assets.total_assets || 0)}</p>
                </div>
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-4">
                  <p className="text-sm font-medium text-rose-700">Total Liabilities</p>
                  <p className="text-2xl font-bold text-rose-900">{formatCurrency(balanceSheet.liabilities.total_liabilities || 0)}</p>
                </div>
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-sm font-medium text-emerald-700">Net Business Position</p>
                  <p className="text-2xl font-bold text-emerald-900">{formatCurrency(balanceSheet.equity.net_business_position || 0)}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Actual Cash On Hand (optional)</label>
                  <input type="number" min="0" step="0.01" value={actualCashOnHand} onChange={(e) => setActualCashOnHand(e.target.value)} className="w-full rounded-lg border px-4 py-3 focus:ring-2 focus:ring-green-500" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Closed By</label>
                  <div className="rounded-lg border bg-gray-50 px-4 py-3 text-sm text-gray-700">{user?.fullName || user?.username || 'Unknown User'}</div>
                </div>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Closing Note (optional)</label>
                <textarea value={closingNote} onChange={(e) => setClosingNote(e.target.value)} rows={4} maxLength={255} placeholder="Add end-of-day remarks or reconciliations..." className="w-full rounded-lg border px-4 py-3 focus:ring-2 focus:ring-green-500" />
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t px-6 py-4">
              <button onClick={() => setShowCloseShiftModal(false)} className="rounded-lg border px-4 py-2 hover:bg-gray-50">Cancel</button>
              <button onClick={closeBusinessDay} disabled={savingBusinessDay} className="rounded-lg bg-amber-600 px-4 py-2 font-medium text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60">Confirm Close Day</button>
            </div>
          </div>
        </div>
      )}
    </ProtectedRoute>
  );
}
