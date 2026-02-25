import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import toast from 'react-hot-toast';
import { DocumentArrowDownIcon, CalendarIcon } from '@heroicons/react/24/outline';
import { formatCurrency, formatDate } from '@/lib/utils';

export default function Reports() {
  const [dailySales, setDailySales] = useState(null);
  const [ledger, setLedger] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeReport, setActiveReport] = useState('daily-sales');
  const [filters, setFilters] = useState({
    date: new Date().toISOString().split('T')[0],
    startDate: '',
    endDate: '',
    type: ''
  });

  useEffect(() => {
    if (activeReport === 'daily-sales') {
      fetchDailySales();
    } else {
      fetchLedger();
    }
  }, [activeReport, filters]);

  const fetchDailySales = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.date) params.append('date', filters.date);
      
      const res = await fetch(`/api/reports/daily-sales?${params}`);
      const data = await res.json();
      if (res.ok) {
        setDailySales(data);
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      toast.error('Failed to fetch daily sales report');
    } finally {
      setLoading(false);
    }
  };

  const fetchLedger = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.type) params.append('type', filters.type);
      
      const res = await fetch(`/api/reports/ledger?${params}`);
      const data = await res.json();
      if (res.ok) {
        setLedger(data);
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      toast.error('Failed to fetch ledger report');
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    let csvContent = '';
    let filename = '';

    if (activeReport === 'daily-sales' && dailySales) {
      filename = `daily-sales-${filters.date}.csv`;
      csvContent = 'Invoice,Date,Customer,Cashier,Payment Method,Total,Cash,Credit,Status\n';
      dailySales.sales?.forEach(sale => {
        csvContent += [
          sale.invoice_number,
          formatDate(sale.created_at),
          sale.customer?.name || 'Walk-in',
          sale.user?.username || '',
          sale.payment_method,
          sale.total_amount,
          sale.cash_amount || 0,
          sale.credit_amount || 0,
          sale.is_void ? 'VOID' : 'COMPLETE'
        ].join(',') + '\n';
      });
    } else if (activeReport === 'ledger' && ledger) {
      filename = `ledger-${filters.startDate || 'all'}-to-${filters.endDate || 'all'}.csv`;
      csvContent = 'Date,Type,Reference,Description,Debit,Credit,Balance\n';
      ledger.entries?.forEach(entry => {
        csvContent += [
          formatDate(entry.created_at),
          entry.type,
          entry.reference || '',
          entry.description || '',
          entry.debit || 0,
          entry.credit || 0,
          entry.running_balance || 0
        ].join(',') + '\n';
      });
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Report exported successfully!');
  };

  return (
    <ProtectedRoute requiredRole="MANAGER">
      <Layout>
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
            >
              <DocumentArrowDownIcon className="h-5 w-5" />
              Export CSV
            </button>
          </div>

          {/* Report Type Tabs */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex gap-2">
              <button
                onClick={() => setActiveReport('daily-sales')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeReport === 'daily-sales'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Daily Sales Report
              </button>
              <button
                onClick={() => setActiveReport('ledger')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeReport === 'ledger'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Ledger Report
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-lg shadow p-4">
            {activeReport === 'daily-sales' ? (
              <div className="flex items-end gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={filters.date}
                    onChange={(e) => setFilters({ ...filters, date: e.target.value })}
                    className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select
                    value={filters.type}
                    onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">All Types</option>
                    <option value="SALE">Sales</option>
                    <option value="PURCHASE">Purchases</option>
                    <option value="EXPENSE">Expenses</option>
                    <option value="PAYMENT_RECEIVED">Payments Received</option>
                    <option value="PAYMENT_MADE">Payments Made</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    onClick={() => setFilters({
                      ...filters,
                      startDate: '',
                      endDate: '',
                      type: ''
                    })}
                    className="w-full px-4 py-2 border rounded-lg hover:bg-gray-50"
                  >
                    Clear Filters
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Report Content */}
          {loading ? (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
              Loading report...
            </div>
          ) : activeReport === 'daily-sales' ? (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg shadow p-4">
                  <p className="text-sm text-gray-500">Total Sales</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(dailySales?.summary?.totalSales || 0)}
                  </p>
                </div>
                <div className="bg-white rounded-lg shadow p-4">
                  <p className="text-sm text-gray-500">Transactions</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {dailySales?.summary?.transactionCount || 0}
                  </p>
                </div>
                <div className="bg-white rounded-lg shadow p-4">
                  <p className="text-sm text-gray-500">Cash Sales</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(dailySales?.summary?.cashSales || 0)}
                  </p>
                </div>
                <div className="bg-white rounded-lg shadow p-4">
                  <p className="text-sm text-gray-500">Credit Sales</p>
                  <p className="text-2xl font-bold text-yellow-600">
                    {formatCurrency(dailySales?.summary?.creditSales || 0)}
                  </p>
                </div>
              </div>

              {/* Sales Table */}
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cashier</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Payment</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {dailySales?.sales?.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="px-6 py-4 text-center text-gray-500">
                          No sales for selected date
                        </td>
                      </tr>
                    ) : (
                      dailySales?.sales?.map(sale => (
                        <tr key={sale.id} className={sale.is_void ? 'bg-red-50' : ''}>
                          <td className="px-6 py-4 text-sm font-mono">{sale.invoice_number}</td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {new Date(sale.created_at).toLocaleTimeString()}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {sale.customer?.name || 'Walk-in'}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">{sale.user?.username}</td>
                          <td className="px-6 py-4 text-center">
                            <span className="px-2 py-1 text-xs font-medium bg-gray-100 rounded-full">
                              {sale.payment_method}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right font-medium">
                            {formatCurrency(sale.total_amount)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <>
              {/* Ledger Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-lg shadow p-4">
                  <p className="text-sm text-gray-500">Total Debit</p>
                  <p className="text-2xl font-bold text-red-600">
                    {formatCurrency(ledger?.summary?.totalDebit || 0)}
                  </p>
                </div>
                <div className="bg-white rounded-lg shadow p-4">
                  <p className="text-sm text-gray-500">Total Credit</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(ledger?.summary?.totalCredit || 0)}
                  </p>
                </div>
                <div className="bg-white rounded-lg shadow p-4">
                  <p className="text-sm text-gray-500">Net Balance</p>
                  <p className={`text-2xl font-bold ${
                    (ledger?.summary?.netBalance || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {formatCurrency(ledger?.summary?.netBalance || 0)}
                  </p>
                </div>
              </div>

              {/* Ledger Table */}
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reference</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Debit</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Credit</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {ledger?.entries?.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="px-6 py-4 text-center text-gray-500">
                          No ledger entries found
                        </td>
                      </tr>
                    ) : (
                      ledger?.entries?.map(entry => (
                        <tr key={entry.id}>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {formatDate(entry.created_at)}
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-2 py-1 text-xs font-medium bg-gray-100 rounded-full">
                              {entry.type}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm font-mono">{entry.reference || '-'}</td>
                          <td className="px-6 py-4 text-sm text-gray-900">{entry.description || '-'}</td>
                          <td className="px-6 py-4 text-right text-sm text-red-600">
                            {entry.debit ? formatCurrency(entry.debit) : '-'}
                          </td>
                          <td className="px-6 py-4 text-right text-sm text-green-600">
                            {entry.credit ? formatCurrency(entry.credit) : '-'}
                          </td>
                          <td className="px-6 py-4 text-right font-medium">
                            {formatCurrency(entry.running_balance || 0)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
