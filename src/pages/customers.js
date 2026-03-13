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

const defaultCustomerForm = {
  name: '',
  contact: '',
  credit_limit: '',
  customer_type: 'WALK_IN'
};

const defaultPaymentForm = {
  amount: '',
  paymentMethod: 'CASH',
  description: ''
};

const defaultReceivableForm = {
  amount: '',
  description: ''
};

const ledgerLabels = {
  PAYMENT: 'Payment',
  RECEIVABLE: 'Manual Balance',
  PURCHASE_ORDER: 'Purchase Order',
  SALE: 'Sale Charge',
  VOID_SALE: 'Sale Reversal',
  CANCELLED_PO: 'Order Reversal'
};

function formatLedgerLabel(referenceType) {
  if (!referenceType) return 'Entry';
  return ledgerLabels[referenceType] || referenceType.replace(/_/g, ' ');
}

function getAccountBadge(customer) {
  const hasBalance = Number(customer.credit_balance || 0) > 0;

  if (customer.customer_type === 'VIP') {
    return {
      label: 'VIP Account',
      className: 'bg-amber-100 text-amber-700'
    };
  }

  if (hasBalance) {
    return {
      label: 'Legacy Balance',
      className: 'bg-red-100 text-red-700'
    };
  }

  return {
    label: 'Cash Only',
    className: 'bg-gray-100 text-gray-700'
  };
}

export default function Customers() {
  const { hasRole } = useAuth();
  const canDeleteCustomers = hasRole('MANAGER');

  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [vipOnly, setVipOnly] = useState(false);
  const [withBalanceOnly, setWithBalanceOnly] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showReceivableModal, setShowReceivableModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerDetails, setCustomerDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [formData, setFormData] = useState({ ...defaultCustomerForm });
  const [paymentForm, setPaymentForm] = useState({ ...defaultPaymentForm });
  const [receivableForm, setReceivableForm] = useState({ ...defaultReceivableForm });

  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const activeSearch = search.trim() ? debouncedSearch : '';

  const fetchCustomers = useCallback(async () => {
    setLoading(true);

    try {
      const params = new URLSearchParams();
      if (activeSearch) params.append('search', activeSearch);
      if (vipOnly) params.append('type', 'VIP');
      if (withBalanceOnly) params.append('hasCredit', 'true');

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
  }, [activeSearch, vipOnly, withBalanceOnly]);

  const fetchCustomerDetails = useCallback(async (customerId) => {
    setLoadingDetails(true);

    try {
      const res = await fetch(`/api/customers/${customerId}`);
      const data = await res.json();

      if (res.ok) {
        setCustomerDetails(data.customer || null);
      } else {
        setCustomerDetails(null);
        toast.error(data.error);
      }
    } catch (error) {
      setCustomerDetails(null);
      toast.error('Failed to fetch customer details');
    } finally {
      setLoadingDetails(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const resetCustomerForm = () => {
    setEditingCustomer(null);
    setFormData({ ...defaultCustomerForm });
  };

  const closeCustomerModal = () => {
    setShowModal(false);
    resetCustomerForm();
  };

  const closePaymentModal = () => {
    setShowPaymentModal(false);
    setSelectedCustomer(null);
    setPaymentForm({ ...defaultPaymentForm });
  };

  const closeReceivableModal = () => {
    setShowReceivableModal(false);
    setSelectedCustomer(null);
    setReceivableForm({ ...defaultReceivableForm });
  };

  const closeDetailsModal = () => {
    setShowDetailsModal(false);
    setSelectedCustomer(null);
    setCustomerDetails(null);
  };

  const refreshCustomerData = useCallback(async (customerId) => {
    await fetchCustomers();

    if (showDetailsModal && customerId) {
      await fetchCustomerDetails(customerId);
    }
  }, [fetchCustomerDetails, fetchCustomers, showDetailsModal]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const url = editingCustomer
        ? `/api/customers/${editingCustomer.customer_id}`
        : '/api/customers';
      const method = editingCustomer ? 'PUT' : 'POST';
      const isVip = formData.customer_type === 'VIP';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: formData.name,
          customerType: formData.customer_type,
          phone: formData.contact,
          creditLimit: isVip ? parseFloat(formData.credit_limit) || 0 : 0
        })
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(editingCustomer ? 'Customer updated!' : 'Customer created!');
        closeCustomerModal();
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
    if (!selectedCustomer || !paymentForm.amount) return;

    try {
      const res = await fetch(`/api/customers/${selectedCustomer.customer_id}/payment`, {
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
        const customerId = selectedCustomer.customer_id;
        closePaymentModal();
        await refreshCustomerData(customerId);
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      toast.error('Payment failed');
    }
  };

  const handleAddReceivable = async (e) => {
    e.preventDefault();
    if (!selectedCustomer || !receivableForm.amount) return;

    try {
      const res = await fetch(`/api/customers/${selectedCustomer.customer_id}/receivable`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(receivableForm.amount),
          description: receivableForm.description
        })
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(`Added ${formatCurrency(data.addedAmount)} to customer balance`);
        const customerId = selectedCustomer.customer_id;
        closeReceivableModal();
        await refreshCustomerData(customerId);
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      toast.error('Failed to add customer balance');
    }
  };

  const handleDelete = async (id) => {
    if (!canDeleteCustomers) {
      toast.error('Only managers can delete customers');
      return;
    }

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
      credit_limit:
        customer.credit_limit === null || customer.credit_limit === undefined
          ? ''
          : customer.credit_limit.toString(),
      customer_type: customer.customer_type || 'WALK_IN'
    });
    setShowModal(true);
  };

  const openPaymentModal = (customer) => {
    setSelectedCustomer(customer);
    setPaymentForm({ ...defaultPaymentForm });
    setShowPaymentModal(true);
  };

  const openReceivableModal = (customer) => {
    if (customer.customer_type !== 'VIP') {
      toast.error('Only VIP customers can have a balance with the business');
      return;
    }

    setSelectedCustomer(customer);
    setReceivableForm({ ...defaultReceivableForm });
    setShowReceivableModal(true);
  };

  const openDetailsModal = async (customer) => {
    setSelectedCustomer(customer);
    setShowDetailsModal(true);
    setCustomerDetails(null);
    await fetchCustomerDetails(customer.customer_id);
  };

  const totalReceivables = customers.reduce((sum, customer) => sum + Number(customer.credit_balance || 0), 0);
  const vipCustomers = customers.filter((customer) => customer.customer_type === 'VIP').length;
  const customersWithBalance = customers.filter((customer) => Number(customer.credit_balance || 0) > 0).length;

  return (
    <ProtectedRoute requiredRole="CLERK">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-black">Customers</h1>
            <p className="mt-1 text-sm text-black">
              VIP customers can carry balances. Walk-in and regular customers stay cash-only.
            </p>
          </div>
          <button
            onClick={() => {
              resetCustomerForm();
              setShowModal(true);
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700"
          >
            <PlusIcon className="h-5 w-5" />
            Add Customer
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-red-100 bg-red-50 p-4">
            <p className="text-sm font-medium text-red-700">Total Receivables</p>
            <p className="mt-2 text-2xl font-bold text-red-700">{formatCurrency(totalReceivables)}</p>
            <p className="mt-1 text-sm text-red-600">{customersWithBalance} customer(s) with balance</p>
          </div>
          <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
            <p className="text-sm font-medium text-amber-700">VIP Accounts</p>
            <p className="mt-2 text-2xl font-bold text-amber-700">{vipCustomers}</p>
            <p className="mt-1 text-sm text-amber-600">Customers allowed to carry balance</p>
          </div>
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
            <p className="text-sm font-medium text-blue-700">Customers Listed</p>
            <p className="mt-2 text-2xl font-bold text-blue-700">{customers.length}</p>
            <p className="mt-1 text-sm text-blue-600">Filtered result count</p>
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search customers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border py-2 pl-10 pr-4 text-black placeholder:text-gray-400 focus:ring-2 focus:ring-green-500"
            />
          </div>
          <button
            type="button"
            onClick={() => setVipOnly((current) => !current)}
            className={`inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2 ${
              vipOnly ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-gray-200 bg-white text-black'
            }`}
          >
            <FunnelIcon className="h-5 w-5" />
            {vipOnly ? 'Showing VIP Only' : 'Show VIP Only'}
          </button>
          <button
            type="button"
            onClick={() => setWithBalanceOnly((current) => !current)}
            className={`inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2 ${
              withBalanceOnly ? 'border-red-200 bg-red-50 text-red-700' : 'border-gray-200 bg-white text-black'
            }`}
          >
            <FunnelIcon className="h-5 w-5" />
            {withBalanceOnly ? 'Showing With Balance' : 'Show With Balance'}
          </button>
        </div>

        <div className="overflow-hidden rounded-lg bg-white shadow">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-black">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-black">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-black">Contact</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase text-black">Credit Limit</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase text-black">Balance</th>
                <th className="px-6 py-3 text-center text-xs font-medium uppercase text-black">Account</th>
                <th className="px-6 py-3 text-center text-xs font-medium uppercase text-black">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-6 py-4 text-center text-black">Loading...</td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-4 text-center text-black">No customers found</td>
                </tr>
              ) : (
                customers.map((customer) => {
                  const badge = getAccountBadge(customer);
                  const hasBalance = Number(customer.credit_balance || 0) > 0;

                  return (
                    <tr key={customer.customer_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <button
                          type="button"
                          onClick={() => openDetailsModal(customer)}
                          className="text-left"
                        >
                          <div className="font-medium text-black hover:text-green-700">
                            {customer.customer_name}
                          </div>
                        </button>
                      </td>
                      <td className="px-6 py-4 text-sm text-black">{customer.customer_type || 'WALK_IN'}</td>
                      <td className="px-6 py-4 text-sm text-black">{customer.contact_number || '-'}</td>
                      <td className="px-6 py-4 text-right text-sm text-black">
                        {formatCurrency(customer.credit_limit)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className={`font-medium ${hasBalance ? 'text-red-600' : 'text-green-600'}`}>
                          {formatCurrency(customer.credit_balance)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`rounded-full px-3 py-1 text-xs font-medium ${badge.className}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => openDetailsModal(customer)}
                            className="rounded-md border border-gray-200 px-3 py-1 text-sm text-black hover:bg-gray-50"
                          >
                            View
                          </button>
                          {customer.customer_type === 'VIP' && (
                            <button
                              type="button"
                              onClick={() => openReceivableModal(customer)}
                              className="rounded-md border border-amber-200 bg-amber-50 px-3 py-1 text-sm text-amber-700 hover:bg-amber-100"
                            >
                              Add Balance
                            </button>
                          )}
                          {hasBalance && (
                            <button
                              type="button"
                              onClick={() => openPaymentModal(customer)}
                              className="rounded-md border border-green-200 bg-green-50 px-3 py-1 text-sm text-green-700 hover:bg-green-100"
                            >
                              Receive Payment
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openEditModal(customer)}
                            className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-3 py-1 text-sm text-blue-700 hover:bg-blue-100"
                          >
                            <PencilIcon className="h-4 w-4" />
                            Edit
                          </button>
                          {canDeleteCustomers && (
                            <button
                              type="button"
                              onClick={() => handleDelete(customer.customer_id)}
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
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-black focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-black">Contact</label>
                <input
                  type="text"
                  value={formData.contact}
                  onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-black focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-black">Customer Type</label>
                <select
                  value={formData.customer_type}
                  onChange={(e) => {
                    const nextType = e.target.value;
                    setFormData({
                      ...formData,
                      customer_type: nextType,
                      credit_limit: nextType === 'VIP' ? formData.credit_limit : ''
                    });
                  }}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-black focus:ring-2 focus:ring-green-500"
                >
                  <option value="WALK_IN">Walk-in</option>
                  <option value="REGULAR">Regular</option>
                  <option value="VIP">VIP</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Only VIP customers can carry balances or use a credit limit.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-black">Credit Limit</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  disabled={formData.customer_type !== 'VIP'}
                  value={formData.credit_limit}
                  onChange={(e) => setFormData({ ...formData, credit_limit: e.target.value })}
                  placeholder={formData.customer_type === 'VIP' ? '0.00' : 'VIP only'}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-black placeholder:text-gray-400 disabled:bg-gray-100 disabled:text-gray-500 focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={closeCustomerModal}
                  className="flex-1 rounded-lg border px-4 py-2 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700"
                >
                  {editingCustomer ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPaymentModal && selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6">
            <h2 className="mb-4 text-xl font-bold text-black">Record Customer Payment</h2>
            <div className="mb-4 rounded-lg bg-gray-50 p-4">
              <p className="font-medium text-black">{selectedCustomer.customer_name}</p>
              <p className="text-sm text-black">
                Current Balance:{' '}
                <span className="font-medium text-red-600">
                  {formatCurrency(selectedCustomer.credit_balance)}
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
                  max={selectedCustomer.credit_balance}
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
                  placeholder="Reference number or payment note"
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

      {showReceivableModal && selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6">
            <h2 className="mb-4 text-xl font-bold text-black">Add Customer Balance</h2>
            <div className="mb-4 rounded-lg bg-gray-50 p-4">
              <p className="font-medium text-black">{selectedCustomer.customer_name}</p>
              <p className="text-sm text-black">
                Current Balance:{' '}
                <span className="font-medium text-red-600">
                  {formatCurrency(selectedCustomer.credit_balance)}
                </span>
              </p>
              <p className="mt-1 text-xs text-amber-700">Only VIP customers can carry balances.</p>
            </div>
            <form onSubmit={handleAddReceivable} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-black">Amount *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={receivableForm.amount}
                  onChange={(e) => setReceivableForm({ ...receivableForm, amount: e.target.value })}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-black focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-black">Reason / Notes</label>
                <textarea
                  rows={3}
                  value={receivableForm.description}
                  onChange={(e) => setReceivableForm({ ...receivableForm, description: e.target.value })}
                  placeholder="Installment charge, adjustment, or note"
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-black placeholder:text-gray-400 focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={closeReceivableModal}
                  className="flex-1 rounded-lg border px-4 py-2 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-amber-500 px-4 py-2 text-white hover:bg-amber-600"
                >
                  Add Balance
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
                  {customerDetails?.customer_name || selectedCustomer?.customer_name || 'Customer Account'}
                </h2>
                <p className="mt-1 text-sm text-black">
                  Review customer balances, recent sales, and account activity.
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
              <div className="py-16 text-center text-black">Loading customer account...</div>
            ) : !customerDetails ? (
              <div className="rounded-lg border border-red-100 bg-red-50 p-4 text-red-700">
                Unable to load customer details.
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid gap-4 lg:grid-cols-4">
                  <div className="rounded-xl border border-red-100 bg-red-50 p-4">
                    <p className="text-sm font-medium text-red-700">Current Balance</p>
                    <p className="mt-2 text-2xl font-bold text-red-700">
                      {formatCurrency(customerDetails.credit_balance)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
                    <p className="text-sm font-medium text-amber-700">Credit Limit</p>
                    <p className="mt-2 text-2xl font-bold text-amber-700">
                      {formatCurrency(customerDetails.credit_limit)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                    <p className="text-sm font-medium text-blue-700">Open Order Balance</p>
                    <p className="mt-2 text-2xl font-bold text-blue-700">
                      {formatCurrency(customerDetails.summary?.open_po_balance || 0)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-green-100 bg-green-50 p-4">
                    <p className="text-sm font-medium text-green-700">Available Credit</p>
                    <p className="mt-2 text-2xl font-bold text-green-700">
                      {formatCurrency(customerDetails.summary?.available_credit || 0)}
                    </p>
                  </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="rounded-xl border p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-black">Recent Sales</h3>
                      {customerDetails.summary?.account_enabled && (
                        <button
                          type="button"
                          onClick={() => openReceivableModal(customerDetails)}
                          className="rounded-md border border-amber-200 bg-amber-50 px-3 py-1 text-sm text-amber-700 hover:bg-amber-100"
                        >
                          Add Balance
                        </button>
                      )}
                    </div>
                    {customerDetails.sales?.length ? (
                      <div className="space-y-3">
                        {customerDetails.sales.map((sale) => (
                          <div key={sale.sale_id} className="rounded-lg border border-gray-100 p-3">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <p className="font-medium text-black">Sale #{sale.sale_id}</p>
                                <p className="text-sm text-gray-600">
                                  {sale.sale_date ? formatDate(sale.sale_date) : 'No date'}
                                </p>
                                <p className="text-sm text-gray-600">
                                  {sale.payment_method || '-'} / {sale.sale_status || '-'}
                                </p>
                              </div>
                              <p className="font-semibold text-black">
                                {formatCurrency(sale.total_amount)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No recent sales for this customer.</p>
                    )}
                  </div>

                  <div className="rounded-xl border p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-black">Account Activity</h3>
                      {Number(customerDetails.credit_balance || 0) > 0 && (
                        <button
                          type="button"
                          onClick={() => openPaymentModal(customerDetails)}
                          className="rounded-md border border-green-200 bg-green-50 px-3 py-1 text-sm text-green-700 hover:bg-green-100"
                        >
                          Receive Payment
                        </button>
                      )}
                    </div>
                    {customerDetails.recent_ledger?.length ? (
                      <div className="space-y-3">
                        {customerDetails.recent_ledger.map((entry) => {
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
                      <p className="text-sm text-gray-500">No customer account activity recorded yet.</p>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border p-4">
                  <h3 className="mb-4 text-lg font-semibold text-black">Recent Purchase Orders</h3>
                  {customerDetails.recent_orders?.length ? (
                    <div className="space-y-3">
                      {customerDetails.recent_orders.map((order) => (
                        <div key={order.po_id} className="rounded-lg border border-gray-100 p-3">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="font-medium text-black">PO #{order.po_id}</p>
                              <p className="text-sm text-gray-600">
                                {order.order_date ? formatDate(order.order_date) : 'No date'}
                              </p>
                              <p className="text-sm text-gray-600">
                                {order.priority || 'NORMAL'} / {order.po_status || '-'}
                              </p>
                            </div>
                            <p className="font-semibold text-black">
                              {formatCurrency(order.outstanding_balance)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No recent purchase orders for this customer.</p>
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
