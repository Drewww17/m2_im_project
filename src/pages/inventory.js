/**
 * Inventory Management Page
 */
import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import toast from 'react-hot-toast';

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount || 0);
}

export default function InventoryPage() {
  const [inventory, setInventory] = useState([]);
  const [alerts, setAlerts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, lowStock, expiringSoon, expired
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);

  useEffect(() => {
    loadInventory();
    loadAlerts();
  }, [filter]);

  const loadInventory = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter === 'lowStock') params.set('lowStock', 'true');
      if (filter === 'expiringSoon') params.set('expiringSoon', 'true');
      if (filter === 'expired') params.set('expired', 'true');
      
      const res = await fetch(`/api/inventory?${params}&pageSize=100`);
      const data = await res.json();
      if (data.success) {
        setInventory(data.inventory);
      }
    } catch (error) {
      console.error('Failed to load inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAlerts = async () => {
    try {
      const res = await fetch('/api/inventory/alerts');
      const data = await res.json();
      if (data.success) {
        setAlerts(data.alerts);
      }
    } catch (error) {
      console.error('Failed to load alerts:', error);
    }
  };

  const getStatusBadge = (item) => {
    if (item.is_expired) {
      return <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">Expired</span>;
    }
    if (item.is_expiring_soon) {
      return <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">Expiring</span>;
    }
    if (item.is_low_stock) {
      return <span className="px-2 py-1 text-xs font-medium bg-orange-100 text-orange-800 rounded-full">Low Stock</span>;
    }
    return <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">OK</span>;
  };

  return (
    <ProtectedRoute requiredRole="CLERK">
      <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Inventory Management</h1>
            <p className="text-gray-500">Monitor stock levels and alerts</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowConvertModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Bulk Convert
            </button>
            <button
              onClick={() => setShowAdjustModal(true)}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              Stock Adjust
            </button>
          </div>
        </div>

        {/* Alert Summary Cards */}
        {alerts && (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <AlertCard
              title="Low Stock"
              count={alerts.low_stock.count}
              color="orange"
              onClick={() => setFilter('lowStock')}
              active={filter === 'lowStock'}
            />
            <AlertCard
              title="Expiring Soon"
              count={alerts.expiring_soon.count}
              color="yellow"
              onClick={() => setFilter('expiringSoon')}
              active={filter === 'expiringSoon'}
            />
            <AlertCard
              title="Expired"
              count={alerts.expired.count}
              color="red"
              onClick={() => setFilter('expired')}
              active={filter === 'expired'}
            />
            <AlertCard
              title="Out of Stock"
              count={alerts.out_of_stock.count}
              color="gray"
              onClick={() => setFilter('all')}
              active={filter === 'all'}
            />
          </div>
        )}

        {/* Filter Tabs */}
        <div className="flex gap-2 border-b">
          {[
            { key: 'all', label: 'All Items' },
            { key: 'lowStock', label: 'Low Stock' },
            { key: 'expiringSoon', label: 'Expiring Soon' },
            { key: 'expired', label: 'Expired' }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                filter === tab.key
                  ? 'border-green-600 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Inventory Table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Batch</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expiration</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Value</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {inventory.map((item) => (
                  <tr key={item.inventory_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{item.product.product_name}</div>
                      <div className="text-sm text-gray-500">{item.product.product_code}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {item.batch_number || '-'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`font-medium ${item.is_low_stock ? 'text-orange-600' : 'text-gray-900'}`}>
                        {item.quantity} {item.product.unit}
                      </span>
                      {item.is_low_stock && (
                        <div className="text-xs text-orange-500">
                          Below reorder level ({item.product.reorder_level})
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {item.expiration_date ? (
                        <div>
                          <div className={item.is_expired ? 'text-red-600 font-medium' : ''}>
                            {new Date(item.expiration_date).toLocaleDateString()}
                          </div>
                          {item.days_to_expiration !== null && (
                            <div className={`text-xs ${
                              item.is_expired ? 'text-red-500' : 
                              item.is_expiring_soon ? 'text-yellow-600' : 'text-gray-400'
                            }`}>
                              {item.is_expired 
                                ? `${Math.abs(item.days_to_expiration)} days ago`
                                : `${item.days_to_expiration} days left`}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">N/A</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {formatCurrency(item.value)}
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(item)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Bulk Conversion Modal */}
        {showConvertModal && (
          <BulkConvertModal 
            onClose={() => setShowConvertModal(false)} 
            onSuccess={() => {
              setShowConvertModal(false);
              loadInventory();
              toast.success('Bulk conversion completed');
            }}
          />
        )}

        {/* Stock Adjustment Modal */}
        {showAdjustModal && (
          <StockAdjustModal 
            onClose={() => setShowAdjustModal(false)} 
            onSuccess={() => {
              setShowAdjustModal(false);
              loadInventory();
              toast.success('Stock adjusted successfully');
            }}
          />
        )}
      </div>
      </Layout>
    </ProtectedRoute>
  );
}

function AlertCard({ title, count, color, onClick, active }) {
  const colors = {
    orange: 'border-orange-500 bg-orange-50',
    yellow: 'border-yellow-500 bg-yellow-50',
    red: 'border-red-500 bg-red-50',
    gray: 'border-gray-500 bg-gray-50'
  };

  return (
    <button
      onClick={onClick}
      className={`p-4 rounded-xl border-2 text-left transition-all ${
        active ? colors[color] : 'border-transparent bg-white hover:bg-gray-50'
      }`}
    >
      <p className="text-3xl font-bold">{count}</p>
      <p className="text-sm text-gray-600">{title}</p>
    </button>
  );
}

function BulkConvertModal({ onClose, onSuccess }) {
  const [sourceProductId, setSourceProductId] = useState('');
  const [targetProductId, setTargetProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    const res = await fetch('/api/products?pageSize=100');
    const data = await res.json();
    if (data.success) {
      setProducts(data.products);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/inventory/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceProductId: parseInt(sourceProductId),
          targetProductId: parseInt(targetProductId),
          sourceQuantity: quantity
        })
      });
      const data = await res.json();
      if (data.success) {
        onSuccess();
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      toast.error('Conversion failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
        <h2 className="text-xl font-bold mb-4">Bulk Conversion</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Source Product (Bulk)</label>
            <select
              value={sourceProductId}
              onChange={(e) => setSourceProductId(e.target.value)}
              required
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="">Select product...</option>
              {products.filter(p => p.is_bulk).map(p => (
                <option key={p.product_id} value={p.product_id}>
                  {p.product_name} ({p.total_stock} {p.unit})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Target Product (Retail)</label>
            <select
              value={targetProductId}
              onChange={(e) => setTargetProductId(e.target.value)}
              required
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="">Select product...</option>
              {products.filter(p => !p.is_bulk).map(p => (
                <option key={p.product_id} value={p.product_id}>
                  {p.product_name} (Ratio: {p.conversion_ratio || 1})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Quantity to Convert</label>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value))}
              required
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          <div className="flex gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Converting...' : 'Convert'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function StockAdjustModal({ onClose, onSuccess }) {
  const [productId, setProductId] = useState('');
  const [adjustmentType, setAdjustmentType] = useState('INCREASE');
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState('');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    const res = await fetch('/api/products?pageSize=100');
    const data = await res.json();
    if (data.success) {
      setProducts(data.products);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/inventory/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: parseInt(productId),
          adjustmentType,
          quantity,
          reason
        })
      });
      const data = await res.json();
      if (data.success) {
        onSuccess();
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      toast.error('Adjustment failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
        <h2 className="text-xl font-bold mb-4">Stock Adjustment</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Product</label>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              required
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="">Select product...</option>
              {products.map(p => (
                <option key={p.product_id} value={p.product_id}>
                  {p.product_name} ({p.total_stock} {p.unit})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Adjustment Type</label>
            <select
              value={adjustmentType}
              onChange={(e) => setAdjustmentType(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="INCREASE">Increase Stock</option>
              <option value="DECREASE">Decrease Stock</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Quantity</label>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value))}
              required
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Reason</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              rows={3}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="Explain the reason for this adjustment..."
            />
          </div>
          <div className="flex gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
            >
              {loading ? 'Adjusting...' : 'Adjust Stock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
