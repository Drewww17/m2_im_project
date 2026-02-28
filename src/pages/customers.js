import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import toast from 'react-hot-toast';
import { PlusIcon, PencilIcon, TrashIcon, MagnifyingGlassIcon, CurrencyDollarIcon } from '@heroicons/react/24/outline';
import { formatCurrency, formatDate } from '@/lib/utils';

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    contact: '',
    credit_limit: '',
    customer_type: 'WALK_IN'
  });

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      
      const res = await fetch(`/api/customers?${params}`);
      const data = await res.json();
      if (res.ok) {
        setCustomers(data.customers || []);
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      toast.error('Failed to fetch customers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCustomers();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const url = editingCustomer 
        ? `/api/customers/${editingCustomer.customer_id}` 
        : '/api/customers';
      const method = editingCustomer ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: formData.name,
          customerType: formData.customer_type,
          phone: formData.contact,
          creditLimit: parseFloat(formData.credit_limit) || 0
        })
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(editingCustomer ? 'Customer updated!' : 'Customer created!');
        setShowModal(false);
        resetForm();
        fetchCustomers();
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      toast.error('Operation failed');
    }
  };

  const handlePayment = async (e) => {
    e.preventDefault();
    if (!selectedCustomer || !paymentAmount) return;

    try {
      const res = await fetch(`/api/customers/${selectedCustomer.customer_id}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: parseFloat(paymentAmount) })
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(`Payment of ${formatCurrency(paymentAmount)} recorded!`);
        setShowPaymentModal(false);
        setSelectedCustomer(null);
        setPaymentAmount('');
        fetchCustomers();
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      toast.error('Payment failed');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this customer?')) return;
    
    try {
      const res = await fetch(`/api/customers/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        toast.success('Customer deleted!');
        fetchCustomers();
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      toast.error('Delete failed');
    }
  };

  const openEditModal = (customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.customer_name || '',
      contact: customer.contact_number || '',
      credit_limit: customer.credit_limit === null || customer.credit_limit === undefined ? '' : customer.credit_limit.toString(),
      customer_type: customer.customer_type || 'WALK_IN'
    });
    setShowModal(true);
  };

  const openPaymentModal = (customer) => {
    setSelectedCustomer(customer);
    setPaymentAmount('');
    setShowPaymentModal(true);
  };

  const resetForm = () => {
    setEditingCustomer(null);
    setFormData({
      name: '',
      contact: '',
      credit_limit: '',
      customer_type: 'WALK_IN'
    });
  };

  const totalReceivables = customers.reduce((sum, c) => sum + parseFloat(c.credit_balance || 0), 0);

  return (
    <ProtectedRoute requiredRole="CLERK">
      <Layout>
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-black">Customers</h1>
              <p className="text-sm text-black">
                Total Receivables: <span className="font-medium text-red-600">{formatCurrency(totalReceivables)}</span>
              </p>
            </div>
            <button
              onClick={() => { resetForm(); setShowModal(true); }}
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
            >
              <PlusIcon className="h-5 w-5" />
              Add Customer
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search customers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
            />
          </div>

          {/* Customers Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-black uppercase">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-black uppercase">Contact</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-black uppercase">Credit Limit</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-black uppercase">Balance</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-black uppercase">Status</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-black uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-4 text-center text-black">Loading...</td>
                  </tr>
                ) : customers.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-4 text-center text-black">No customers found</td>
                  </tr>
                ) : (
                  customers.map(customer => (
                    <tr key={customer.customer_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div>
                            <div className="font-medium text-black">{customer.customer_name}</div>
                            {customer.customer_type && (
                              <div className="text-sm text-black">{customer.customer_type}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-black">{customer.contact_number || '-'}</td>
                      <td className="px-6 py-4 text-right text-sm text-black">
                        {formatCurrency(customer.credit_limit)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className={`font-medium ${
                          parseFloat(customer.credit_balance) > 0 ? 'text-red-600' : 'text-green-600'
                        }`}>
                          {formatCurrency(customer.credit_balance)}
                        </span>
                        {parseFloat(customer.credit_balance) > parseFloat(customer.credit_limit) && (
                          <div className="text-xs text-red-500">Over limit!</div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                          Active
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-center gap-2">
                          {parseFloat(customer.credit_balance) > 0 && (
                            <button
                              onClick={() => openPaymentModal(customer)}
                              className="p-1 text-green-600 hover:text-green-800"
                              title="Record Payment"
                            >
                              <CurrencyDollarIcon className="h-5 w-5" />
                            </button>
                          )}
                          <button
                            onClick={() => openEditModal(customer)}
                            className="p-1 text-blue-600 hover:text-blue-800"
                          >
                            <PencilIcon className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleDelete(customer.customer_id)}
                            className="p-1 text-red-600 hover:text-red-800"
                          >
                            <TrashIcon className="h-5 w-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Customer Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h2 className="text-xl font-bold mb-4">
                {editingCustomer ? 'Edit Customer' : 'Add Customer'}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-black">Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="mt-1 w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-black">Contact</label>
                  <input
                    type="text"
                    value={formData.contact}
                    onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                    className="mt-1 w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-black">Customer Type</label>
                  <select
                    value={formData.customer_type}
                    onChange={(e) => setFormData({ ...formData, customer_type: e.target.value })}
                    className="mt-1 w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                  >
                    <option value="WALK_IN">Walk-in</option>
                    <option value="REGULAR">Regular</option>
                    <option value="VIP">VIP</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-black">Credit Limit</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.credit_limit}
                    onChange={(e) => setFormData({ ...formData, credit_limit: e.target.value })}
                    className="mt-1 w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    {editingCustomer ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Payment Modal */}
        {showPaymentModal && selectedCustomer && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h2 className="text-xl font-bold mb-4">Record Payment</h2>
              <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <p className="font-medium">{selectedCustomer.customer_name}</p>
                <p className="text-sm text-black">
                  Current Balance: <span className="text-red-600 font-medium">{formatCurrency(selectedCustomer.credit_balance)}</span>
                </p>
              </div>
              <form onSubmit={handlePayment} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-black">Payment Amount *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    min="0.01"
                    max={selectedCustomer.credit_balance}
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="mt-1 w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                  <p className="mt-1 text-sm text-black">
                    Max: {formatCurrency(selectedCustomer.credit_balance)}
                  </p>
                </div>
                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowPaymentModal(false)}
                    className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Record Payment
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </Layout>
    </ProtectedRoute>
  );
}
