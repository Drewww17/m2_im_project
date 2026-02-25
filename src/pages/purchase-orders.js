import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import toast from 'react-hot-toast';
import { 
  PlusIcon, 
  MagnifyingGlassIcon, 
  EyeIcon, 
  TruckIcon,
  TrashIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { formatCurrency, formatDate } from '@/lib/utils';

export default function PurchaseOrders() {
  const [orders, setOrders] = useState([]);
  const [restockAlerts, setRestockAlerts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [filters, setFilters] = useState({
    status: '',
    supplier_id: ''
  });

  const [createForm, setCreateForm] = useState({
    supplier_id: '',
    notes: '',
    items: [{ product_id: '', quantity: '', unit_cost: '' }]
  });

  const [receiveForm, setReceiveForm] = useState({
    items: []
  });

  useEffect(() => {
    fetchOrders();
    fetchRestockAlerts();
    fetchSuppliers();
    fetchProducts();
  }, []);

  const fetchOrders = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.supplier_id) params.append('supplier_id', filters.supplier_id);
      
      const res = await fetch(`/api/purchase-orders?${params}`);
      const data = await res.json();
      if (res.ok) {
        setOrders(data.purchaseOrders || []);
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
      if (res.ok) {
        setRestockAlerts(data.alerts || []);
      }
    } catch (error) {
      console.error('Failed to fetch restock alerts');
    }
  };

  const fetchSuppliers = async () => {
    try {
      const res = await fetch('/api/suppliers');
      const data = await res.json();
      if (res.ok) {
        setSuppliers(data.suppliers || []);
      }
    } catch (error) {
      console.error('Failed to fetch suppliers');
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products?limit=100');
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
      const items = createForm.items.filter(item => item.product_id && item.quantity);
      if (items.length === 0) {
        toast.error('Please add at least one item');
        return;
      }

      const res = await fetch('/api/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier_id: parseInt(createForm.supplier_id),
          notes: createForm.notes,
          items: items.map(item => ({
            product_id: parseInt(item.product_id),
            quantity: parseInt(item.quantity),
            unit_cost: parseFloat(item.unit_cost) || undefined
          }))
        })
      });

      const data = await res.json();
      if (res.ok) {
        toast.success('Purchase order created!');
        setShowCreateModal(false);
        setCreateForm({
          supplier_id: '',
          notes: '',
          items: [{ product_id: '', quantity: '', unit_cost: '' }]
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
      const items = receiveForm.items.filter(item => item.quantity_received > 0);
      
      const res = await fetch(`/api/purchase-orders/${selectedOrder.id}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items })
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

  const openDetailModal = async (orderId) => {
    try {
      const res = await fetch(`/api/purchase-orders/${orderId}`);
      const data = await res.json();
      if (res.ok) {
        setSelectedOrder(data.purchaseOrder);
        setShowDetailModal(true);
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      toast.error('Failed to fetch order details');
    }
  };

  const openReceiveModal = async (orderId) => {
    try {
      const res = await fetch(`/api/purchase-orders/${orderId}`);
      const data = await res.json();
      if (res.ok) {
        setSelectedOrder(data.purchaseOrder);
        setReceiveForm({
          items: data.purchaseOrder.details.map(item => ({
            product_id: item.product_id,
            product_name: item.product?.name,
            quantity_ordered: item.quantity,
            quantity_received: item.quantity - (item.quantity_received || 0),
            batch_number: '',
            expiration_date: ''
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
      items: [...createForm.items, { product_id: '', quantity: '', unit_cost: '' }]
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
      PARTIAL: 'bg-blue-100 text-blue-800',
      COMPLETE: 'bg-green-100 text-green-800',
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
                  <div key={product.id} className="text-sm text-orange-600">
                    {product.name}: {product.current_stock}/{product.reorder_level}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="flex gap-4">
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
            >
              <option value="">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="PARTIAL">Partial</option>
              <option value="COMPLETE">Complete</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
            <select
              value={filters.supplier_id}
              onChange={(e) => setFilters({ ...filters, supplier_id: e.target.value })}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
            >
              <option value="">All Suppliers</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Orders Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">PO Number</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Supplier</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
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
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <span className="font-mono text-sm">{order.po_number}</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {formatDate(order.created_at)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {order.supplier?.name}
                      </td>
                      <td className="px-6 py-4 text-right font-medium">
                        {formatCurrency(order.total_amount)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {getStatusBadge(order.status)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => openDetailModal(order.id)}
                            className="p-1 text-blue-600 hover:text-blue-800"
                            title="View Details"
                          >
                            <EyeIcon className="h-5 w-5" />
                          </button>
                          {(order.status === 'PENDING' || order.status === 'PARTIAL') && (
                            <button
                              onClick={() => openReceiveModal(order.id)}
                              className="p-1 text-green-600 hover:text-green-800"
                              title="Receive Delivery"
                            >
                              <TruckIcon className="h-5 w-5" />
                            </button>
                          )}
                          {order.status === 'PENDING' && (
                            <button
                              onClick={() => handleDeleteOrder(order.id)}
                              className="p-1 text-red-600 hover:text-red-800"
                              title="Cancel Order"
                            >
                              <TrashIcon className="h-5 w-5" />
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

        {/* Create Order Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-bold mb-4">Create Purchase Order</h2>
              <form onSubmit={handleCreateOrder} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Supplier *</label>
                  <select
                    required
                    value={createForm.supplier_id}
                    onChange={(e) => setCreateForm({ ...createForm, supplier_id: e.target.value })}
                    className="mt-1 w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">Select supplier</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Items</label>
                  {createForm.items.map((item, index) => (
                    <div key={index} className="flex gap-2 mb-2">
                      <select
                        value={item.product_id}
                        onChange={(e) => updateItem(index, 'product_id', e.target.value)}
                        className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                      >
                        <option value="">Select product</option>
                        {products.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                        className="w-20 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                      />
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Cost"
                        value={item.unit_cost}
                        onChange={(e) => updateItem(index, 'unit_cost', e.target.value)}
                        className="w-24 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
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
                  <label className="block text-sm font-medium text-gray-700">Notes</label>
                  <textarea
                    value={createForm.notes}
                    onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
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
                  <p className="font-mono font-medium">{selectedOrder.po_number}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Date</p>
                  <p className="font-medium">{formatDate(selectedOrder.created_at)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Supplier</p>
                  <p className="font-medium">{selectedOrder.supplier?.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  {getStatusBadge(selectedOrder.status)}
                </div>
              </div>

              <table className="min-w-full divide-y divide-gray-200 mb-4">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Ordered</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Received</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Unit Cost</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {selectedOrder.details?.map((item, index) => (
                    <tr key={index}>
                      <td className="px-4 py-2 text-sm">{item.product?.name}</td>
                      <td className="px-4 py-2 text-sm text-right">{item.quantity}</td>
                      <td className="px-4 py-2 text-sm text-right">{item.quantity_received || 0}</td>
                      <td className="px-4 py-2 text-sm text-right">{formatCurrency(item.unit_cost)}</td>
                      <td className="px-4 py-2 text-sm text-right font-medium">{formatCurrency(item.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan="4" className="px-4 py-2 text-right font-medium">Total:</td>
                    <td className="px-4 py-2 text-right font-bold">{formatCurrency(selectedOrder.total_amount)}</td>
                  </tr>
                </tfoot>
              </table>

              {selectedOrder.notes && (
                <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500">Notes</p>
                  <p className="text-sm">{selectedOrder.notes}</p>
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
              <h2 className="text-xl font-bold mb-4">Receive Delivery</h2>
              <p className="text-sm text-gray-500 mb-4">
                PO: {selectedOrder.po_number} | Supplier: {selectedOrder.supplier?.name}
              </p>
              
              <form onSubmit={handleReceiveOrder} className="space-y-4">
                {receiveForm.items.map((item, index) => (
                  <div key={index} className="p-4 border rounded-lg">
                    <p className="font-medium mb-2">{item.product_name}</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <div>
                        <label className="block text-xs text-gray-500">Ordered</label>
                        <p className="font-medium">{item.quantity_ordered}</p>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500">Receiving</label>
                        <input
                          type="number"
                          min="0"
                          max={item.quantity_ordered}
                          value={item.quantity_received}
                          onChange={(e) => {
                            const newItems = [...receiveForm.items];
                            newItems[index].quantity_received = parseInt(e.target.value) || 0;
                            setReceiveForm({ ...receiveForm, items: newItems });
                          }}
                          className="w-full px-2 py-1 border rounded focus:ring-2 focus:ring-green-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500">Batch #</label>
                        <input
                          type="text"
                          value={item.batch_number}
                          onChange={(e) => {
                            const newItems = [...receiveForm.items];
                            newItems[index].batch_number = e.target.value;
                            setReceiveForm({ ...receiveForm, items: newItems });
                          }}
                          className="w-full px-2 py-1 border rounded focus:ring-2 focus:ring-green-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500">Expiry</label>
                        <input
                          type="date"
                          value={item.expiration_date}
                          onChange={(e) => {
                            const newItems = [...receiveForm.items];
                            newItems[index].expiration_date = e.target.value;
                            setReceiveForm({ ...receiveForm, items: newItems });
                          }}
                          className="w-full px-2 py-1 border rounded focus:ring-2 focus:ring-green-500"
                        />
                      </div>
                    </div>
                  </div>
                ))}

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
