import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import toast from 'react-hot-toast';
import { MagnifyingGlassIcon, XMarkIcon, EyeIcon, ReceiptRefundIcon } from '@heroicons/react/24/outline';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils';

export default function Sales() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSale, setSelectedSale] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    paymentMethod: '',
    search: ''
  });

  useEffect(() => {
    fetchSales();
  }, []);

  const fetchSales = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.paymentMethod) params.append('paymentMethod', filters.paymentMethod);
      if (filters.search) params.append('search', filters.search);
      
      const res = await fetch(`/api/sales?${params}`);
      const data = await res.json();
      if (res.ok) {
        setSales(data.sales || []);
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      toast.error('Failed to fetch sales');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchSales();
    }, 300);
    return () => clearTimeout(timer);
  }, [filters]);

  const handleVoid = async (saleId) => {
    if (!confirm('Are you sure you want to void this sale? This action cannot be undone.')) return;
    
    try {
      const res = await fetch(`/api/sales/${saleId}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        toast.success('Sale voided successfully!');
        fetchSales();
        if (selectedSale?.id === saleId) {
          setShowDetailModal(false);
          setSelectedSale(null);
        }
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      toast.error('Failed to void sale');
    }
  };

  const openDetailModal = async (saleId) => {
    try {
      const res = await fetch(`/api/sales/${saleId}`);
      const data = await res.json();
      if (res.ok) {
        setSelectedSale(data.sale);
        setShowDetailModal(true);
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      toast.error('Failed to fetch sale details');
    }
  };

  const getPaymentBadge = (method) => {
    const colors = {
      CASH: 'bg-green-100 text-green-800',
      CREDIT: 'bg-yellow-100 text-yellow-800',
      MIXED: 'bg-blue-100 text-blue-800'
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${colors[method] || 'bg-gray-100 text-gray-800'}`}>
        {method}
      </span>
    );
  };

  const totals = sales.reduce((acc, sale) => {
    if (!sale.is_void) {
      acc.total += parseFloat(sale.total_amount || 0);
      acc.cash += parseFloat(sale.cash_amount || 0);
      acc.credit += parseFloat(sale.credit_amount || 0);
    }
    return acc;
  }, { total: 0, cash: 0, credit: 0 });

  return (
    <ProtectedRoute requiredRole="CLERK">
      <Layout>
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Sales History</h1>
              <p className="text-sm text-gray-500">
                {sales.length} transactions | Total: {formatCurrency(totals.total)}
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white p-4 rounded-lg shadow space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search invoice/customer..."
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                  placeholder="Start Date"
                />
              </div>
              <div>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                  placeholder="End Date"
                />
              </div>
              <div>
                <select
                  value={filters.paymentMethod}
                  onChange={(e) => setFilters({ ...filters, paymentMethod: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                >
                  <option value="">All Payment Methods</option>
                  <option value="CASH">Cash</option>
                  <option value="CREDIT">Credit</option>
                  <option value="MIXED">Mixed</option>
                </select>
              </div>
            </div>
            {(filters.startDate || filters.endDate || filters.paymentMethod || filters.search) && (
              <button
                onClick={() => setFilters({ startDate: '', endDate: '', paymentMethod: '', search: '' })}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Clear filters
              </button>
            )}
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-lg shadow">
              <p className="text-sm text-gray-500">Total Sales</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(totals.total)}</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <p className="text-sm text-gray-500">Cash Received</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(totals.cash)}</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <p className="text-sm text-gray-500">Credit Extended</p>
              <p className="text-2xl font-bold text-yellow-600">{formatCurrency(totals.credit)}</p>
            </div>
          </div>

          {/* Sales Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cashier</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Payment</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-4 text-center text-gray-500">Loading...</td>
                  </tr>
                ) : sales.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-4 text-center text-gray-500">No sales found</td>
                  </tr>
                ) : (
                  sales.map(sale => (
                    <tr key={sale.id} className={`hover:bg-gray-50 ${sale.is_void ? 'bg-red-50' : ''}`}>
                      <td className="px-6 py-4">
                        <span className="font-mono text-sm">{sale.invoice_number}</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {formatDateTime(sale.created_at)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {sale.customer?.name || 'Walk-in'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {sale.user?.username || '-'}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {getPaymentBadge(sale.payment_method)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className={`font-medium ${sale.is_void ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                          {formatCurrency(sale.total_amount)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {sale.is_void ? (
                          <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">
                            VOID
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                            Complete
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => openDetailModal(sale.id)}
                            className="p-1 text-blue-600 hover:text-blue-800"
                            title="View Details"
                          >
                            <EyeIcon className="h-5 w-5" />
                          </button>
                          {!sale.is_void && (
                            <button
                              onClick={() => handleVoid(sale.id)}
                              className="p-1 text-red-600 hover:text-red-800"
                              title="Void Sale"
                            >
                              <ReceiptRefundIcon className="h-5 w-5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detail Modal */}
        {showDetailModal && selectedSale && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Sale Details</h2>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="p-1 text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              {selectedSale.is_void && (
                <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded-lg text-red-800 text-sm">
                  This sale has been voided
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-sm text-gray-500">Invoice Number</p>
                  <p className="font-mono font-medium">{selectedSale.invoice_number}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Date</p>
                  <p className="font-medium">{formatDateTime(selectedSale.created_at)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Customer</p>
                  <p className="font-medium">{selectedSale.customer?.name || 'Walk-in'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Cashier</p>
                  <p className="font-medium">{selectedSale.user?.username || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Payment Method</p>
                  <p className="font-medium">{selectedSale.payment_method}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Amount</p>
                  <p className="font-medium text-lg">{formatCurrency(selectedSale.total_amount)}</p>
                </div>
              </div>

              {selectedSale.payment_method !== 'CASH' && (
                <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm text-gray-500">Cash Paid</p>
                    <p className="font-medium text-green-600">{formatCurrency(selectedSale.cash_amount)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Credit Amount</p>
                    <p className="font-medium text-yellow-600">{formatCurrency(selectedSale.credit_amount)}</p>
                  </div>
                </div>
              )}

              <div>
                <h3 className="font-medium mb-3">Items</h3>
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Price</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {selectedSale.sale_details?.map((item, index) => (
                      <tr key={index}>
                        <td className="px-4 py-2 text-sm">{item.product?.name}</td>
                        <td className="px-4 py-2 text-sm text-right">{item.quantity}</td>
                        <td className="px-4 py-2 text-sm text-right">{formatCurrency(item.unit_price)}</td>
                        <td className="px-4 py-2 text-sm text-right font-medium">{formatCurrency(item.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td colSpan="3" className="px-4 py-2 text-right font-medium">Total:</td>
                      <td className="px-4 py-2 text-right font-bold">{formatCurrency(selectedSale.total_amount)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="flex justify-end gap-4 mt-6 pt-4 border-t">
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Close
                </button>
                {!selectedSale.is_void && (
                  <button
                    onClick={() => handleVoid(selectedSale.id)}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    Void Sale
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </Layout>
    </ProtectedRoute>
  );
}
