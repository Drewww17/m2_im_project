/**
 * Manager Dashboard Page
 * Financial reports and business overview
 */
import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell 
} from 'recharts';

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP'
  }).format(amount || 0);
}

export default function DashboardPage() {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    loadDashboard();
  }, [dateRange]);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams(dateRange);
      const res = await fetch(`/api/dashboard?${params}`);
      const data = await res.json();
      if (data.success) {
        setDashboardData(data.dashboard);
      }
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444'];

  if (loading) {
    return (
      <ProtectedRoute requiredRole="MANAGER">
        <Layout>
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
          </div>
        </Layout>
      </ProtectedRoute>
    );
  }

  const data = dashboardData;

  return (
    <ProtectedRoute requiredRole="MANAGER">
      <Layout>
        <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-black">Financial Dashboard</h1>
            <p className="text-black">Business overview and reports</p>
          </div>
          <div className="flex gap-2">
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
              className="px-3 py-2 border rounded-lg"
            />
            <span className="py-2">to</span>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
              className="px-3 py-2 border rounded-lg"
            />
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Revenue"
            value={formatCurrency(data?.sales?.total_revenue)}
            subtitle={`${data?.sales?.total_transactions || 0} transactions`}
            icon="currency"
            color="green"
          />
          <StatCard
            title="Cash Collected"
            value={formatCurrency(data?.sales?.total_collected)}
            subtitle="Total cash received"
            icon="cash"
            color="blue"
          />
          <StatCard
            title="Outstanding Credit"
            value={formatCurrency(data?.customer_credit?.total_outstanding)}
            subtitle={`${data?.customer_credit?.customer_count || 0} customers`}
            icon="credit"
            color="yellow"
          />
          <StatCard
            title="Supplier Payables"
            value={formatCurrency(data?.supplier_payables?.total_payable)}
            subtitle={`${data?.supplier_payables?.supplier_count || 0} suppliers`}
            icon="payable"
            color="red"
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Daily Sales Chart */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-black mb-4">Daily Sales</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data?.daily_sales || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" fontSize={12} />
                  <YAxis fontSize={12} tickFormatter={(v) => `₱${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Line type="monotone" dataKey="revenue" stroke="#10B981" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Payment Method Breakdown */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-black mb-4">Payment Methods</h3>
            <div className="h-64 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={Object.entries(data?.sales_by_payment || {}).map(([name, value]) => ({
                      name,
                      value: value.amount
                    }))}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${formatCurrency(value)}`}
                  >
                    {Object.keys(data?.sales_by_payment || {}).map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Detailed Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Debtors */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-black mb-4">Top Customer Debtors</h3>
            <div className="space-y-3">
              {data?.customer_credit?.top_debtors?.slice(0, 5).map((customer, idx) => (
                <div key={idx} className="flex justify-between items-center py-2 border-b">
                  <div>
                    <p className="font-medium text-black">{customer.customer_name}</p>
                    <p className="text-sm text-black">
                      Limit: {formatCurrency(customer.credit_limit)}
                    </p>
                  </div>
                  <span className="text-lg font-semibold text-red-600">
                    {formatCurrency(customer.credit_balance)}
                  </span>
                </div>
              )) || <p className="text-black">No outstanding debts</p>}
            </div>
          </div>

          {/* Top Supplier Payables */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-black mb-4">Supplier Payables</h3>
            <div className="space-y-3">
              {data?.supplier_payables?.top_payables?.slice(0, 5).map((supplier, idx) => (
                <div key={idx} className="flex justify-between items-center py-2 border-b">
                  <p className="font-medium text-black">{supplier.supplier_name}</p>
                  <span className="text-lg font-semibold text-orange-600">
                    {formatCurrency(supplier.balance_payable)}
                  </span>
                </div>
              )) || <p className="text-black">No supplier payables</p>}
            </div>
          </div>
        </div>

        {/* Inventory Valuation */}
        <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-black mb-4">Inventory Valuation</h3>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-black">Total Items</p>
              <p className="text-2xl font-bold">{data?.inventory?.total_items?.toLocaleString() || 0}</p>
            </div>
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-600">Cost Value</p>
              <p className="text-2xl font-bold text-blue-700">
                {formatCurrency(data?.inventory?.total_cost_value)}
              </p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-green-600">Retail Value</p>
              <p className="text-2xl font-bold text-green-700">
                {formatCurrency(data?.inventory?.total_retail_value)}
              </p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <p className="text-sm text-purple-600">Potential Profit</p>
              <p className="text-2xl font-bold text-purple-700">
                {formatCurrency(data?.inventory?.potential_profit)}
              </p>
            </div>
          </div>
        </div>

        {/* Expiration Alerts */}
        {(data?.expiration_alerts?.expired_count > 0 || data?.expiration_alerts?.expiring_count > 0) && (
          <div className="space-y-4">
            {/* Already Expired Products */}
            {data?.expiration_alerts?.expired_count > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl shadow-sm p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-red-800">Expired Products</h3>
                    <p className="text-sm text-red-600">{data.expiration_alerts.expired_count} product(s) have already expired</p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="text-left text-sm text-red-700 border-b border-red-200">
                        <th className="pb-2 font-medium">Product</th>
                        <th className="pb-2 font-medium">Code</th>
                        <th className="pb-2 font-medium">Stock</th>
                        <th className="pb-2 font-medium">Expired On</th>
                        <th className="pb-2 font-medium">Days Expired</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-red-100">
                      {data.expiration_alerts.already_expired.map((item, idx) => (
                        <tr key={idx} className="text-sm text-black">
                          <td className="py-2 font-medium">{item.product_name}</td>
                          <td className="py-2">{item.product_code}</td>
                          <td className="py-2">{item.current_stock} {item.unit}</td>
                          <td className="py-2">{new Date(item.expiration_date).toLocaleDateString()}</td>
                          <td className="py-2">
                            <span className="px-2 py-1 bg-red-200 text-red-800 rounded-full text-xs font-medium">
                              {item.days_expired} days ago
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Expiring Soon Products */}
            {data?.expiration_alerts?.expiring_count > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl shadow-sm p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-yellow-800">Expiring Soon</h3>
                    <p className="text-sm text-yellow-600">{data.expiration_alerts.expiring_count} product(s) will expire within 30 days</p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="text-left text-sm text-yellow-700 border-b border-yellow-200">
                        <th className="pb-2 font-medium">Product</th>
                        <th className="pb-2 font-medium">Code</th>
                        <th className="pb-2 font-medium">Stock</th>
                        <th className="pb-2 font-medium">Expires On</th>
                        <th className="pb-2 font-medium">Days Left</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-yellow-100">
                      {data.expiration_alerts.expiring_soon.map((item, idx) => (
                        <tr key={idx} className="text-sm text-black">
                          <td className="py-2 font-medium">{item.product_name}</td>
                          <td className="py-2">{item.product_code}</td>
                          <td className="py-2">{item.current_stock} {item.unit}</td>
                          <td className="py-2">{new Date(item.expiration_date).toLocaleDateString()}</td>
                          <td className="py-2">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              item.days_until_expiry <= 7 
                                ? 'bg-red-200 text-red-800' 
                                : item.days_until_expiry <= 14 
                                  ? 'bg-orange-200 text-orange-800'
                                  : 'bg-yellow-200 text-yellow-800'
                            }`}>
                              {item.days_until_expiry} days
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Low Stock Alerts */}
        {data?.low_stock_alerts?.total_count > 0 && (
          <div className="space-y-4">
            {/* Out of Stock Products */}
            {data?.low_stock_alerts?.out_of_stock_count > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl shadow-sm p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-red-800">Out of Stock</h3>
                    <p className="text-sm text-red-600">{data.low_stock_alerts.out_of_stock_count} product(s) have no stock</p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="text-left text-sm text-red-700 border-b border-red-200">
                        <th className="pb-2 font-medium">Product</th>
                        <th className="pb-2 font-medium">Code</th>
                        <th className="pb-2 font-medium">Stock</th>
                        <th className="pb-2 font-medium">Reorder Level</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-red-100">
                      {data.low_stock_alerts.items.filter(i => i.is_out_of_stock).map((item, idx) => (
                        <tr key={idx} className="text-sm text-black">
                          <td className="py-2 font-medium">{item.product_name}</td>
                          <td className="py-2">{item.product_code}</td>
                          <td className="py-2">
                            <span className="px-2 py-1 bg-red-200 text-red-800 rounded-full text-xs font-medium">
                              0 {item.unit}
                            </span>
                          </td>
                          <td className="py-2">{item.reorder_level} {item.unit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Low Stock Products */}
            {data?.low_stock_alerts?.low_stock_count > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl shadow-sm p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-orange-800">Low Stock</h3>
                    <p className="text-sm text-orange-600">{data.low_stock_alerts.low_stock_count} product(s) below reorder level</p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="text-left text-sm text-orange-700 border-b border-orange-200">
                        <th className="pb-2 font-medium">Product</th>
                        <th className="pb-2 font-medium">Code</th>
                        <th className="pb-2 font-medium">Current Stock</th>
                        <th className="pb-2 font-medium">Reorder Level</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-orange-100">
                      {data.low_stock_alerts.items.filter(i => !i.is_out_of_stock).map((item, idx) => (
                        <tr key={idx} className="text-sm text-black">
                          <td className="py-2 font-medium">{item.product_name}</td>
                          <td className="py-2">{item.product_code}</td>
                          <td className="py-2">
                            <span className="px-2 py-1 bg-orange-200 text-orange-800 rounded-full text-xs font-medium">
                              {item.current_stock} {item.unit}
                            </span>
                          </td>
                          <td className="py-2">{item.reorder_level} {item.unit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
        </div>
      </Layout>
    </ProtectedRoute>
  );
}

function StatCard({ title, value, subtitle, icon, color }) {
  const colors = {
    green: 'bg-green-50 text-green-600',
    blue: 'bg-blue-50 text-blue-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    red: 'bg-red-50 text-red-600'
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-black">{title}</p>
          <p className="text-2xl font-bold text-black mt-1">{value}</p>
          <p className="text-xs text-black mt-1">{subtitle}</p>
        </div>
        <div className={`w-12 h-12 rounded-lg ${colors[color]} flex items-center justify-center`}>
          <StatIcon name={icon} />
        </div>
      </div>
    </div>
  );
}

function StatIcon({ name }) {
  const icons = {
    currency: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    cash: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    credit: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
    payable: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    )
  };
  return icons[name] || null;
}
