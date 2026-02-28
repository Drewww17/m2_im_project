import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import toast from 'react-hot-toast';
import { PlusIcon, PencilIcon, TrashIcon, MagnifyingGlassIcon, CurrencyDollarIcon } from '@heroicons/react/24/outline';
import { formatCurrency, formatDate } from '@/lib/utils';

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    phone: ''
  });

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      
      const res = await fetch(`/api/suppliers?${params}`);
      const data = await res.json();
      if (res.ok) {
        setSuppliers(data.suppliers || []);
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      toast.error('Failed to fetch suppliers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchSuppliers();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const url = editingSupplier 
        ? `/api/suppliers/${editingSupplier.supplier_id}` 
        : '/api/suppliers';
      const method = editingSupplier ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierName: formData.name,
          phone: formData.phone
        })
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(editingSupplier ? 'Supplier updated!' : 'Supplier created!');
        setShowModal(false);
        resetForm();
        fetchSuppliers();
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      toast.error('Operation failed');
    }
  };

  const handlePayment = async (e) => {
    e.preventDefault();
    if (!selectedSupplier || !paymentAmount) return;

    try {
      const res = await fetch(`/api/suppliers/${selectedSupplier.supplier_id}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: parseFloat(paymentAmount) })
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(`Payment of ${formatCurrency(paymentAmount)} recorded!`);
        setShowPaymentModal(false);
        setSelectedSupplier(null);
        setPaymentAmount('');
        fetchSuppliers();
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      toast.error('Payment failed');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this supplier?')) return;
    
    try {
      const res = await fetch(`/api/suppliers/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        toast.success('Supplier deleted!');
        fetchSuppliers();
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      toast.error('Delete failed');
    }
  };

  const openEditModal = (supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.supplier_name || '',
      phone: supplier.contact_number || ''
    });
    setShowModal(true);
  };

  const openPaymentModal = (supplier) => {
    setSelectedSupplier(supplier);
    setPaymentAmount('');
    setShowPaymentModal(true);
  };

  const resetForm = () => {
    setEditingSupplier(null);
    setFormData({
      name: '',
      phone: ''
    });
  };

  const totalPayables = suppliers.reduce((sum, s) => sum + parseFloat(s.payable_balance || 0), 0);

  return (
    <ProtectedRoute requiredRole="CLERK">
      <Layout>
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-black">Suppliers</h1>
              <p className="text-sm text-black">
                Total Payables: <span className="font-medium text-red-600">{formatCurrency(totalPayables)}</span>
              </p>
            </div>
            <button
              onClick={() => { resetForm(); setShowModal(true); }}
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
            >
              <PlusIcon className="h-5 w-5" />
              Add Supplier
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search suppliers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
            />
          </div>

          {/* Suppliers Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-black uppercase">Supplier</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-black uppercase">Phone</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-black uppercase">Products</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-black uppercase">Balance</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-4 text-center text-black">Loading...</td>
                  </tr>
                ) : suppliers.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-4 text-center text-black">No suppliers found</td>
                  </tr>
                ) : (
                  suppliers.map(supplier => (
                    <tr key={supplier.supplier_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="font-medium text-black">{supplier.supplier_name}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-black">
                        {supplier.contact_number || '-'}
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-black">
                        {supplier.product_count || 0}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className={`font-medium ${
                          parseFloat(supplier.payable_balance) > 0 ? 'text-red-600' : 'text-green-600'
                        }`}>
                          {formatCurrency(supplier.payable_balance)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-center gap-2">
                          {parseFloat(supplier.payable_balance) > 0 && (
                            <button
                              onClick={() => openPaymentModal(supplier)}
                              className="p-1 text-green-600 hover:text-green-800"
                              title="Record Payment"
                            >
                              <CurrencyDollarIcon className="h-5 w-5" />
                            </button>
                          )}
                          <button
                            onClick={() => openEditModal(supplier)}
                            className="p-1 text-blue-600 hover:text-blue-800"
                          >
                            <PencilIcon className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleDelete(supplier.supplier_id)}
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

        {/* Supplier Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h2 className="text-xl font-bold mb-4">
                {editingSupplier ? 'Edit Supplier' : 'Add Supplier'}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-black">Company Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="mt-1 w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-black">Phone</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
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
                    {editingSupplier ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Payment Modal */}
        {showPaymentModal && selectedSupplier && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h2 className="text-xl font-bold mb-4">Record Payment to Supplier</h2>
              <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <p className="font-medium">{selectedSupplier.supplier_name}</p>
                <p className="text-sm text-black">
                  Outstanding Balance: <span className="text-red-600 font-medium">{formatCurrency(selectedSupplier.payable_balance)}</span>
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
                    max={selectedSupplier.payable_balance}
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="mt-1 w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                  <p className="mt-1 text-sm text-black">
                    Max: {formatCurrency(selectedSupplier.payable_balance)}
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
