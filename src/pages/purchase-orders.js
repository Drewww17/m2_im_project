import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import toast from 'react-hot-toast';
import { 
  PlusIcon, 
  EyeIcon, 
  TruckIcon,
  TrashIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { formatCurrency, formatDate } from '@/lib/utils';

export default function PurchaseOrders() {
  const [orders, setOrders] = useState([]);
  const [restockAlerts, setRestockAlerts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [filters, setFilters] = useState({
    poStatus: '',
    customerId: ''
  });

  const [createForm, setCreateForm] = useState({
    customerId: '',
    remarks: '',
    outstandingBalance: '',
    items: [{ productId: '', quantity: '' }]
  });

  const [receiveForm, setReceiveForm] = useState({
    items: [],
    remarks: ''
  });

  useEffect(() => {
    fetchOrders();
    fetchRestockAlerts();
    fetchCustomers();
    fetchProducts();
  }, []);

  const fetchOrders = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.poStatus) params.append('poStatus', filters.poStatus);
      if (filters.customerId) params.append('customerId', filters.customerId);
      
      const res = await fetch(`/api/purchase-orders?${params}`);
      const data = await res.json();
      if (res.ok) {
        setOrders(data.orders || []);
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      toast.error('Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  };

  const fetchRestockAlerts = async () => {
    try {
      const res = await fetch('/api/purchase-orders/restock-alerts');
      const data = await res.json();
      if (res.ok && data.alerts) {
        setRestockAlerts(data.alerts.products || []);
      }
    } catch (error) {
      console.error('Failed to fetch restock alerts');
    }
  };

  const fetchCustomers = async () => {
    try {
      const res = await fetch('/api/customers');
      const data = await res.json();
      if (res.ok) {
        setCustomers(data.customers || []);
      }
    } catch (error) {
      console.error('Failed to fetch customers');
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products?pageSize=100');
      const data = await res.json();
      if (res.ok) {
        setProducts(data.products || []);
      }
    } catch (error) {
      console.error('Failed to fetch products');
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchOrders();
    }, 300);
    return () => clearTimeout(timer);
  }, [filters]);

  const handleCreateOrder = async (e) => {
    e.preventDefault();
    try {
      const items = createForm.items.filter(item => item.productId && item.quantity);
      if (items.length === 0) {
        toast.error('Please add at least one item');
        return;
      }

      const res = await fetch('/api/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: parseInt(createForm.customerId),
          outstandingBalance: parseFloat(createForm.outstandingBalance) || 0,
          remarks: createForm.remarks,
          items: items.map(item => ({
            productId: parseInt(item.productId),
            quantity: parseInt(item.quantity)
          }))
        })
      });

      const data = await res.json();
      if (res.ok) {
        toast.success('Purchase order created!');
        setShowCreateModal(false);
        setCreateForm({
          customerId: '',
          remarks: '',
          outstandingBalance: '',
          items: [{ productId: '', quantity: '' }]
        });
        fetchOrders();
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      toast.error('Failed to create order');
    }
  };

  const handleReceiveOrder = async (e) => {
    e.preventDefault();
    if (!selectedOrder) return;

    try {
      const items = receiveForm.items
        .filter(item => item.quantity > 0)
        .map(item => ({
          poDetailId: item.poDetailId,
          quantity: item.quantity
        }));

      if (items.length === 0) {
        toast.error('Please specify quantities to receive');
        return;
      }
      
      const res = await fetch(`/api/purchase-orders/${selectedOrder.po_id}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          items,
          remarks: receiveForm.remarks 
        })
      });

      const data = await res.json();
      if (res.ok) {
        toast.success('Delivery received!');
        setShowReceiveModal(false);
        setSelectedOrder(null);
        fetchOrders();
        fetchRestockAlerts();
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      toast.error('Failed to receive delivery');
    }
  };

  const handleDeleteOrder = async (id) => {
    if (!confirm('Are you sure you want to cancel this purchase order?')) return;
    
    try {
      const res = await fetch(`/api/purchase-orders/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        toast.success('Order cancelled!');
        fetchOrders();
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      toast.error('Failed to cancel order');
    }
  };

  const openDetailModal = async (poId) => {
    try {
      const res = await fetch(`/api/purchase-orders/${poId}`);
      const data = await res.json();
      if (res.ok) {
        setSelectedOrder(data.order);
        setShowDetailModal(true);
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      toast.error('Failed to fetch order details');
    }
  };

  const openReceiveModal = async (poId) => {
    try {
      const res = await fetch(`/api/purchase-orders/${poId}`);
      const data = await res.json();
      if (res.ok) {
        setSelectedOrder(data.order);
        setReceiveForm({
          remarks: '',
          items: (data.order.purchase_order_details || []).map(item => ({
            poDetailId: item.po_detail_id,
            productName: item.products?.product_name || 'Unknown Product',
            quantityOrdered: item.quantity || 0,
            quantity: item.quantity || 0
          }))
        });
        setShowReceiveModal(true);
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      toast.error('Failed to fetch order details');
    }
  };

  const addItem = () => {
    setCreateForm({
      ...createForm,
      items: [...createForm.items, { productId: '', quantity: '' }]
    });
  };

  const removeItem = (index) => {
    setCreateForm({
      ...createForm,
      items: createForm.items.filter((_, i) => i !== index)
    });
  };

  const updateItem = (index, field, value) => {
    const newItems = [...createForm.items];
    newItems[index][field] = value;
    setCreateForm({ ...createForm, items: newItems });
  };

  const getStatusBadge = (status) => {
    const colors = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      RECEIVED: 'bg-green-100 text-green-800',
      CANCELLED: 'bg-red-100 text-red-800'
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
        {status}
      </span>
    );
  };

  return (
    <ProtectedRoute requiredRole="CLERK">
      <Layout>
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Purchase Orders</h1>
              {restockAlerts.length > 0 && (
                <p className="text-sm text-orange-600">
                  <ExclamationTriangleIcon className="h-4 w-4 inline mr-1" />
                  {restockAlerts.length} products need restocking
                </p>
              )}
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
            >
              <PlusIcon className="h-5 w-5" />
              New Order
            </button>
          </div>

          {/* Restock Alerts */}
          {restockAlerts.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <h3 className="font-medium text-orange-800 mb-2">Restock Required</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {restockAlerts.slice(0, 8).map(product => (
                  <div key={product.product_id} className="text-sm text-orange-600">
                    {product.product_name}: {product.current_stock}/{product.reorder_level}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="flex gap-4">
            <select
              value={filters.poStatus}
              onChange={(e) => setFilters({ ...filters, poStatus: e.target.value })}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
            >
              <option value="">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="RECEIVED">Received</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
            <select
              value={filters.customerId}
              onChange={(e) => setFilters({ ...filters, customerId: e.target.value })}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
            >
              <option value="">All Customers</option>
              {customers.map(c => (
                <option key={c.customer_id} value={c.customer_id}>{c.customer_name}</option>
              ))}
            </select>
          </div>

          {/* Orders Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">PO #</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Balance</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-4 text-center text-gray-500">Loading...</td>
                  </tr>
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-4 text-center text-gray-500">No purchase orders found</td>
                  </tr>
                ) : (
                  orders.map(order => (
                    <tr key={order.po_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <span className="font-mono text-sm">PO-{order.po_id}</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {formatDate(order.order_date)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {order.customers?.customer_name || 'Unknown'}
                      </td>
                      <td className="px-6 py-4 text-right font-medium">
                        {formatCurrency(order.outstanding_balance)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {getStatusBadge(order.po_status)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => openDetailModal(order.po_id)}
                            className="p-1 text-blue-600 hover:text-blue-800"
                            title="View Details"
                          >
                            <EyeIcon className="h-5 w-5" />
                          </button>
                          {order.po_status === 'PENDING' && (
                            <>
                              <button
                                onClick={() => openReceiveModal(order.po_id)}
                                className="p-1 text-green-600 hover:text-green-800"
                                title="Receive / Fulfill"
                              >
                                <TruckIcon className="h-5 w-5" />
                              </button>
                              <button
                                onClick={() => handleDeleteOrder(order.po_id)}
                                className="p-1 text-red-600 hover:text-red-800"
                                title="Cancel Order"
                              >
                                <TrashIcon className="h-5 w-5" />
                              </button>
                            </>
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

        {/* Create Order Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-bold mb-4">Create Purchase Order</h2>
              <form onSubmit={handleCreateOrder} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Customer *</label>
                  <select
                    required
                    value={createForm.customerId}
                    onChange={(e) => setCreateForm({ ...createForm, customerId: e.target.value })}
                    className="mt-1 w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">Select customer</option>
                    {customers.map(c => (
                      <option key={c.customer_id} value={c.customer_id}>{c.customer_name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Outstanding Balance</label>
                  <input
                    type="number"
                    step="0.01"
                    value={createForm.outstandingBalance}
                    onChange={(e) => setCreateForm({ ...createForm, outstandingBalance: e.target.value })}
                    placeholder="0.00"
                    className="mt-1 w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Items</label>
                  {createForm.items.map((item, index) => (
                    <div key={index} className="flex gap-2 mb-2">
                      <select
                        value={item.productId}
                        onChange={(e) => updateItem(index, 'productId', e.target.value)}
                        className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                      >
                        <option value="">Select product</option>
                        {products.map(p => (
                          <option key={p.product_id} value={p.product_id}>{p.product_name}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                        className="w-20 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                      />
                      {createForm.items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addItem}
                    className="text-sm text-green-600 hover:text-green-800"
                  >
                    + Add Item
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Remarks</label>
                  <textarea
                    value={createForm.remarks}
                    onChange={(e) => setCreateForm({ ...createForm, remarks: e.target.value })}
                    rows={2}
                    className="mt-1 w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Create Order
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Detail Modal */}
        {showDetailModal && selectedOrder && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-bold mb-4">Purchase Order Details</h2>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-sm text-gray-500">PO Number</p>
                  <p className="font-mono font-medium">PO-{selectedOrder.po_id}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Date</p>
                  <p className="font-medium">{formatDate(selectedOrder.order_date)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Customer</p>
                  <p className="font-medium">{selectedOrder.customers?.customer_name || 'Unknown'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  {getStatusBadge(selectedOrder.po_status)}
                </div>
                <div>
                  <p className="text-sm text-gray-500">Outstanding Balance</p>
                  <p className="font-medium">{formatCurrency(selectedOrder.outstanding_balance)}</p>
                </div>
              </div>

              <table className="min-w-full divide-y divide-gray-200 mb-4">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Quantity</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Unit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {(selectedOrder.purchase_order_details || []).map((item, index) => (
                    <tr key={index}>
                      <td className="px-4 py-2 text-sm">{item.products?.product_name || 'Unknown'}</td>
                      <td className="px-4 py-2 text-sm text-gray-500">{item.products?.product_code || '-'}</td>
                      <td className="px-4 py-2 text-sm text-right">{item.quantity}</td>
                      <td className="px-4 py-2 text-sm text-right">{item.products?.unit || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {selectedOrder.remarks && (
                <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500">Remarks</p>
                  <p className="text-sm">{selectedOrder.remarks}</p>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Receive Modal */}
        {showReceiveModal && selectedOrder && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-bold mb-4">Receive / Fulfill Order</h2>
              <p className="text-sm text-gray-500 mb-4">
                PO-{selectedOrder.po_id} | Customer: {selectedOrder.customers?.customer_name || 'Unknown'}
              </p>
              
              <form onSubmit={handleReceiveOrder} className="space-y-4">
                {receiveForm.items.map((item, index) => (
                  <div key={index} className="p-4 border rounded-lg">
                    <p className="font-medium mb-2">{item.productName}</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-gray-500">Ordered</label>
                        <p className="font-medium">{item.quantityOrdered}</p>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500">Receiving</label>
                        <input
                          type="number"
                          min="0"
                          max={item.quantityOrdered}
                          value={item.quantity}
                          onChange={(e) => {
                            const newItems = [...receiveForm.items];
                            newItems[index].quantity = parseInt(e.target.value) || 0;
                            setReceiveForm({ ...receiveForm, items: newItems });
                          }}
                          className="w-full px-2 py-1 border rounded focus:ring-2 focus:ring-green-500"
                        />
                      </div>
                    </div>
                  </div>
                ))}

                <div>
                  <label className="block text-sm font-medium text-gray-700">Remarks (optional)</label>
                  <textarea
                    value={receiveForm.remarks}
                    onChange={(e) => setReceiveForm({ ...receiveForm, remarks: e.target.value })}
                    rows={2}
                    className="mt-1 w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowReceiveModal(false)}
                    className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Receive Delivery
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
