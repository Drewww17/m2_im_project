import { useState, useEffect, useCallback } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import useDebouncedValue from '@/hooks/useDebouncedValue';
import toast from 'react-hot-toast';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  FunnelIcon
} from '@heroicons/react/24/outline';
import { formatCurrency, formatDate } from '@/lib/utils';

const defaultSupplierForm = {
  name: '',
  phone: ''
};

const defaultPaymentForm = {
  amount: '',
  paymentMethod: 'CASH',
  description: ''
};

const defaultPayableForm = {
  amount: '',
  description: ''
};

const ledgerLabels = {
  PAYMENT: 'Payment',
  PAYABLE: 'Manual Due',
  SUPPLY: 'Supply',
  VOID_SUPPLY: 'Supply Reversal'
};

function formatLedgerLabel(referenceType) {
  if (!referenceType) return 'Entry';
  return ledgerLabels[referenceType] || referenceType.replace(/_/g, ' ');
}

export default function Suppliers() {
  const { hasRole } = useAuth();
  const canDeleteSuppliers = hasRole('MANAGER');

  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [hasPayableOnly, setHasPayableOnly] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showPayableModal, setShowPayableModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [supplierDetails, setSupplierDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [formData, setFormData] = useState(defaultSupplierForm);
  const [paymentForm, setPaymentForm] = useState(defaultPaymentForm);
  const [payableForm, setPayableForm] = useState(defaultPayableForm);

  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const activeSearch = search.trim() ? debouncedSearch : '';

  const fetchSuppliers = useCallback(async () => {
    setLoading(true);

    try {
      const params = new URLSearchParams();
      if (activeSearch) params.append('search', activeSearch);
      if (hasPayableOnly) params.append('hasPayable', 'true');

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
  }, [activeSearch, hasPayableOnly]);

  const fetchSupplierDetails = useCallback(async (supplierId) => {
    setLoadingDetails(true);

    try {
      const res = await fetch(`/api/suppliers/${supplierId}`);
      const data = await res.json();

      if (res.ok) {
        setSupplierDetails(data.supplier || null);
      } else {
        setSupplierDetails(null);
        toast.error(data.error);
      }
    } catch (error) {
      setSupplierDetails(null);
      toast.error('Failed to fetch supplier details');
    } finally {
      setLoadingDetails(false);
    }
  }, []);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  const resetSupplierForm = () => {
    setEditingSupplier(null);
    setFormData({ ...defaultSupplierForm });
  };

  const closeSupplierModal = () => {
    setShowModal(false);
    resetSupplierForm();
  };

  const closePaymentModal = () => {
    setShowPaymentModal(false);
    setSelectedSupplier(null);
    setPaymentForm({ ...defaultPaymentForm });
  };

  const closePayableModal = () => {
    setShowPayableModal(false);
    setSelectedSupplier(null);
    setPayableForm({ ...defaultPayableForm });
  };

  const closeDetailsModal = () => {
    setShowDetailsModal(false);
    setSelectedSupplier(null);
    setSupplierDetails(null);
  };

  const refreshSupplierData = useCallback(async (supplierId) => {
    await fetchSuppliers();

    if (showDetailsModal && supplierId) {
      await fetchSupplierDetails(supplierId);
    }
  }, [fetchSuppliers, fetchSupplierDetails, showDetailsModal]);

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
        closeSupplierModal();
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
    if (!selectedSupplier || !paymentForm.amount) return;

    try {
      const res = await fetch(`/api/suppliers/${selectedSupplier.supplier_id}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(paymentForm.amount),
          paymentMethod: paymentForm.paymentMethod,
          description: paymentForm.description
        })
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(`Payment of ${formatCurrency(data.paymentAmount)} recorded!`);
        const supplierId = selectedSupplier.supplier_id;
        closePaymentModal();
        await refreshSupplierData(supplierId);
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      toast.error('Payment failed');
    }
  };

  const handleAddPayable = async (e) => {
    e.preventDefault();
    if (!selectedSupplier || !payableForm.amount) return;

    try {
      const res = await fetch(`/api/suppliers/${selectedSupplier.supplier_id}/payable`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(payableForm.amount),
          description: payableForm.description
        })
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(`Added ${formatCurrency(data.addedAmount)} to supplier balance`);
        const supplierId = selectedSupplier.supplier_id;
        closePayableModal();
        await refreshSupplierData(supplierId);
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      toast.error('Failed to add supplier payable');
    }
  };

  const handleDelete = async (id) => {
    if (!canDeleteSuppliers) {
      toast.error('Only managers can delete suppliers');
      return;
    }

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
    setPaymentForm({ ...defaultPaymentForm });
    setShowPaymentModal(true);
  };

  const openPayableModal = (supplier) => {
    setSelectedSupplier(supplier);
    setPayableForm({ ...defaultPayableForm });
    setShowPayableModal(true);
  };

  const openDetailsModal = async (supplier) => {
    setSelectedSupplier(supplier);
    setShowDetailsModal(true);
    setSupplierDetails(null);
    await fetchSupplierDetails(supplier.supplier_id);
  };

  const totalPayables = suppliers.reduce((sum, supplier) => sum + Number(supplier.payable_balance || 0), 0);
  const suppliersWithPayable = suppliers.filter((supplier) => Number(supplier.payable_balance || 0) > 0).length;
  const settledSuppliers = suppliers.length - suppliersWithPayable;

  return (
    <ProtectedRoute requiredRole="CLERK">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-black">Suppliers</h1>
            <p className="mt-1 text-sm text-black">
              Manage supplier balances, manual dues, and payment posting in one place.
            </p>
          </div>
          <button
            onClick={() => {
              resetSupplierForm();
              setShowModal(true);
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700"
          >
            <PlusIcon className="h-5 w-5" />
            Add Supplier
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-red-100 bg-red-50 p-4">
            <p className="text-sm font-medium text-red-700">Total Payables</p>
            <p className="mt-2 text-2xl font-bold text-red-700">{formatCurrency(totalPayables)}</p>
            <p className="mt-1 text-sm text-red-600">{suppliersWithPayable} supplier(s) with balance</p>
          </div>
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
            <p className="text-sm font-medium text-blue-700">Suppliers Listed</p>
            <p className="mt-2 text-2xl font-bold text-blue-700">{suppliers.length}</p>
            <p className="mt-1 text-sm text-blue-600">Filtered result count</p>
          </div>
          <div className="rounded-xl border border-green-100 bg-green-50 p-4">
            <p className="text-sm font-medium text-green-700">Settled Accounts</p>
            <p className="mt-2 text-2xl font-bold text-green-700">{Math.max(settledSuppliers, 0)}</p>
            <p className="mt-1 text-sm text-green-600">Suppliers with zero balance</p>
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search suppliers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border py-2 pl-10 pr-4 text-black placeholder:text-gray-400 focus:ring-2 focus:ring-green-500"
            />
          </div>
          <button
            type="button"
            onClick={() => setHasPayableOnly((current) => !current)}
            className={`inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2 ${
              hasPayableOnly
                ? 'border-red-200 bg-red-50 text-red-700'
                : 'border-gray-200 bg-white text-black'
            }`}
          >
            <FunnelIcon className="h-5 w-5" />
            {hasPayableOnly ? 'Showing Only With Balance' : 'Show Only With Balance'}
          </button>
        </div>

        <div className="overflow-hidden rounded-lg bg-white shadow">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-black">Supplier</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-black">Phone</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase text-black">Products</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase text-black">Balance</th>
                <th className="px-6 py-3 text-center text-xs font-medium uppercase text-black">Status</th>
                <th className="px-6 py-3 text-center text-xs font-medium uppercase text-black">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-4 text-center text-black">Loading...</td>
                </tr>
              ) : suppliers.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-4 text-center text-black">No suppliers found</td>
                </tr>
              ) : (
                suppliers.map((supplier) => {
                  const hasBalance = Number(supplier.payable_balance || 0) > 0;

                  return (
                    <tr key={supplier.supplier_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <button
                          type="button"
                          onClick={() => openDetailsModal(supplier)}
                          className="text-left"
                        >
                          <div className="font-medium text-black hover:text-green-700">
                            {supplier.supplier_name}
                          </div>
                        </button>
                      </td>
                      <td className="px-6 py-4 text-sm text-black">
                        {supplier.contact_number || '-'}
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-black">
                        {supplier.product_count || 0}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className={`font-medium ${hasBalance ? 'text-red-600' : 'text-green-600'}`}>
                          {formatCurrency(supplier.payable_balance)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${
                            hasBalance
                              ? 'bg-red-100 text-red-700'
                              : 'bg-green-100 text-green-700'
                          }`}
                        >
                          {hasBalance ? 'With Payable' : 'Settled'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => openDetailsModal(supplier)}
                            className="rounded-md border border-gray-200 px-3 py-1 text-sm text-black hover:bg-gray-50"
                          >
                            View
                          </button>
                          <button
                            type="button"
                            onClick={() => openPayableModal(supplier)}
                            className="rounded-md border border-amber-200 bg-amber-50 px-3 py-1 text-sm text-amber-700 hover:bg-amber-100"
                          >
                            Add Due
                          </button>
                          {hasBalance && (
                            <button
                              type="button"
                              onClick={() => openPaymentModal(supplier)}
                              className="rounded-md border border-green-200 bg-green-50 px-3 py-1 text-sm text-green-700 hover:bg-green-100"
                            >
                              Pay
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openEditModal(supplier)}
                            className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-3 py-1 text-sm text-blue-700 hover:bg-blue-100"
                          >
                            <PencilIcon className="h-4 w-4" />
                            Edit
                          </button>
                          {canDeleteSuppliers && (
                            <button
                              type="button"
                              onClick={() => handleDelete(supplier.supplier_id)}
                              className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-3 py-1 text-sm text-red-700 hover:bg-red-100"
                            >
                              <TrashIcon className="h-4 w-4" />
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6">
            <h2 className="mb-4 text-xl font-bold text-black">
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
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-black focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-black">Phone</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-black focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={closeSupplierModal}
                  className="flex-1 rounded-lg border px-4 py-2 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700"
                >
                  {editingSupplier ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPaymentModal && selectedSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6">
            <h2 className="mb-4 text-xl font-bold text-black">Record Supplier Payment</h2>
            <div className="mb-4 rounded-lg bg-gray-50 p-4">
              <p className="font-medium text-black">{selectedSupplier.supplier_name}</p>
              <p className="text-sm text-black">
                Outstanding Balance:{' '}
                <span className="font-medium text-red-600">
                  {formatCurrency(selectedSupplier.payable_balance)}
                </span>
              </p>
            </div>
            <form onSubmit={handlePayment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-black">Payment Amount *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={selectedSupplier.payable_balance}
                  required
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-black focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-black">Payment Method</label>
                <select
                  value={paymentForm.paymentMethod}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-black focus:ring-2 focus:ring-green-500"
                >
                  <option value="CASH">Cash</option>
                  <option value="BANK">Bank</option>
                  <option value="GCASH">GCash</option>
                  <option value="CHECK">Check</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-black">Notes</label>
                <textarea
                  rows={3}
                  value={paymentForm.description}
                  onChange={(e) => setPaymentForm({ ...paymentForm, description: e.target.value })}
                  placeholder="Invoice number, payment note, or reference"
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-black placeholder:text-gray-400 focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={closePaymentModal}
                  className="flex-1 rounded-lg border px-4 py-2 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700"
                >
                  Record Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPayableModal && selectedSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6">
            <h2 className="mb-4 text-xl font-bold text-black">Add Supplier Due</h2>
            <div className="mb-4 rounded-lg bg-gray-50 p-4">
              <p className="font-medium text-black">{selectedSupplier.supplier_name}</p>
              <p className="text-sm text-black">
                Current Balance:{' '}
                <span className="font-medium text-red-600">
                  {formatCurrency(selectedSupplier.payable_balance)}
                </span>
              </p>
            </div>
            <form onSubmit={handleAddPayable} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-black">Amount *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={payableForm.amount}
                  onChange={(e) => setPayableForm({ ...payableForm, amount: e.target.value })}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-black focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-black">Reason / Notes</label>
                <textarea
                  rows={3}
                  value={payableForm.description}
                  onChange={(e) => setPayableForm({ ...payableForm, description: e.target.value })}
                  placeholder="Delivery charge, invoice, correction, or note"
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-black placeholder:text-gray-400 focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={closePayableModal}
                  className="flex-1 rounded-lg border px-4 py-2 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-amber-500 px-4 py-2 text-white hover:bg-amber-600"
                >
                  Add Due
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDetailsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-xl bg-white p-6">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-black">
                  {supplierDetails?.supplier_name || selectedSupplier?.supplier_name || 'Supplier Account'}
                </h2>
                <p className="mt-1 text-sm text-black">
                  Review recent supplies, account movements, and linked products.
                </p>
              </div>
              <button
                type="button"
                onClick={closeDetailsModal}
                className="rounded-lg border px-4 py-2 text-black hover:bg-gray-50"
              >
                Close
              </button>
            </div>

            {loadingDetails ? (
              <div className="py-16 text-center text-black">Loading supplier account...</div>
            ) : !supplierDetails ? (
              <div className="rounded-lg border border-red-100 bg-red-50 p-4 text-red-700">
                Unable to load supplier details.
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid gap-4 lg:grid-cols-4">
                  <div className="rounded-xl border border-red-100 bg-red-50 p-4">
                    <p className="text-sm font-medium text-red-700">Outstanding Balance</p>
                    <p className="mt-2 text-2xl font-bold text-red-700">
                      {formatCurrency(supplierDetails.payable_balance)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                    <p className="text-sm font-medium text-blue-700">Products</p>
                    <p className="mt-2 text-2xl font-bold text-blue-700">
                      {supplierDetails.summary?.product_count || 0}
                    </p>
                  </div>
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
                    <p className="text-sm font-medium text-emerald-700">Supply Records</p>
                    <p className="mt-2 text-2xl font-bold text-emerald-700">
                      {supplierDetails.summary?.supply_count || 0}
                    </p>
                  </div>
                  <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
                    <p className="text-sm font-medium text-amber-700">Total Supplied</p>
                    <p className="mt-2 text-2xl font-bold text-amber-700">
                      {formatCurrency(supplierDetails.summary?.supplied_total || 0)}
                    </p>
                  </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="rounded-xl border p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-black">Recent Supplies</h3>
                      <button
                        type="button"
                        onClick={() => openPayableModal(supplierDetails)}
                        className="rounded-md border border-amber-200 bg-amber-50 px-3 py-1 text-sm text-amber-700 hover:bg-amber-100"
                      >
                        Add Due
                      </button>
                    </div>
                    {supplierDetails.recent_supplies?.length ? (
                      <div className="space-y-3">
                        {supplierDetails.recent_supplies.map((entry) => (
                          <div key={entry.supply_id} className="rounded-lg border border-gray-100 p-3">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <p className="font-medium text-black">Supply #{entry.supply_id}</p>
                                <p className="text-sm text-gray-600">
                                  {entry.supply_date ? formatDate(entry.supply_date) : 'No date'}
                                </p>
                                <p className="text-sm text-gray-600">
                                  {entry.item_count || 0} item line(s)
                                </p>
                              </div>
                              <p className="font-semibold text-red-600">
                                {formatCurrency(entry.total)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No recent supply records for this supplier.</p>
                    )}
                  </div>

                  <div className="rounded-xl border p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-black">Account Activity</h3>
                      {Number(supplierDetails.payable_balance || 0) > 0 && (
                        <button
                          type="button"
                          onClick={() => openPaymentModal(supplierDetails)}
                          className="rounded-md border border-green-200 bg-green-50 px-3 py-1 text-sm text-green-700 hover:bg-green-100"
                        >
                          Record Payment
                        </button>
                      )}
                    </div>
                    {supplierDetails.recent_ledger?.length ? (
                      <div className="space-y-3">
                        {supplierDetails.recent_ledger.map((entry) => {
                          const amount = Number(entry.debit || 0) > 0 ? entry.debit : entry.credit;
                          const isCharge = Number(entry.debit || 0) > 0;

                          return (
                            <div key={entry.ledger_id} className="rounded-lg border border-gray-100 p-3">
                              <div className="flex items-start justify-between gap-4">
                                <div>
                                  <p className="font-medium text-black">
                                    {formatLedgerLabel(entry.reference_type)}
                                  </p>
                                  <p className="text-sm text-gray-600">
                                    {entry.created_at ? formatDate(entry.created_at) : 'No date'}
                                  </p>
                                </div>
                                <p className={`font-semibold ${isCharge ? 'text-red-600' : 'text-green-600'}`}>
                                  {isCharge ? '+' : '-'}{formatCurrency(amount)}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No supplier account activity recorded yet.</p>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border p-4">
                  <h3 className="mb-4 text-lg font-semibold text-black">Linked Products</h3>
                  {supplierDetails.products?.length ? (
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {supplierDetails.products.map((product) => (
                        <div key={product.product_id} className="rounded-lg border border-gray-100 p-3">
                          <p className="font-medium text-black">{product.product_name}</p>
                          <p className="text-sm text-gray-600">
                            Code: {product.product_code || '-'}
                          </p>
                          <p className="text-sm text-gray-600">
                            Unit: {product.unit || '-'}
                          </p>
                          <p className="mt-2 text-sm font-medium text-black">
                            Cost: {formatCurrency(product.unit_price)}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No products are currently linked to this supplier.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </ProtectedRoute>
  );
}
