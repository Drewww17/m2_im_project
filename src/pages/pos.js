/**
 * POS (Point of Sale) Page
 * Fast cashier interface for sales transactions
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import toast, { Toaster } from 'react-hot-toast';

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP'
  }).format(amount);
}

export default function POSPage() {
  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [cart, setCart] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [amountTendered, setAmountTendered] = useState('');
  const [discount, setDiscount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastSale, setLastSale] = useState(null);
  const [todaySummary, setTodaySummary] = useState(null);
  
  const searchInputRef = useRef(null);

  // Calculate totals
  const subtotal = cart.reduce((sum, item) => sum + (item.quantity * item.selling_price), 0);
  const total = subtotal - discount;
  const change = parseFloat(amountTendered || 0) - total;

  // Load customers and today's summary on mount
  useEffect(() => {
    loadCustomers();
    loadTodaySummary();
    searchInputRef.current?.focus();
  }, []);

  const loadCustomers = async () => {
    try {
      const res = await fetch('/api/customers?type=VIP&pageSize=100');
      const data = await res.json();
      if (data.success) {
        setCustomers(data.customers);
      }
    } catch (error) {
      console.error('Failed to load customers:', error);
    }
  };

  const loadTodaySummary = async () => {
    try {
      const res = await fetch('/api/sales/today');
      const data = await res.json();
      if (data.success) {
        setTodaySummary(data.summary);
      }
    } catch (error) {
      console.error('Failed to load today summary:', error);
    }
  };

  // Debounced product search
  const searchProducts = useCallback(async (query) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      const res = await fetch(`/api/products/search?q=${encodeURIComponent(query)}&limit=10`);
      const data = await res.json();
      if (data.success) {
        setSearchResults(data.products);
      }
    } catch (error) {
      console.error('Search error:', error);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      searchProducts(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, searchProducts]);

  // Handle barcode scan (Enter key in search)
  const handleSearchKeyDown = async (e) => {
    if (e.key === 'Enter' && searchQuery) {
      // Try exact barcode match first
      try {
        const res = await fetch(`/api/products/search?barcode=${encodeURIComponent(searchQuery)}`);
        const data = await res.json();
        if (data.success && data.products.length === 1) {
          addToCart(data.products[0]);
          setSearchQuery('');
          setSearchResults([]);
          return;
        }
      } catch (error) {
        console.error('Barcode search error:', error);
      }

      // If no exact match and we have search results, add the first one
      if (searchResults.length > 0) {
        addToCart(searchResults[0]);
        setSearchQuery('');
        setSearchResults([]);
      }
    }
  };

  // Add product to cart
  const addToCart = (product) => {
    if (!product.in_stock) {
      toast.error(`${product.product_name} is out of stock`);
      return;
    }

    setCart(prevCart => {
      const existingIndex = prevCart.findIndex(item => item.product_id === product.product_id);
      
      if (existingIndex >= 0) {
        const newCart = [...prevCart];
        const newQty = newCart[existingIndex].quantity + 1;
        
        if (newQty > product.total_stock) {
          toast.error(`Only ${product.total_stock} ${product.unit}(s) available`);
          return prevCart;
        }
        
        newCart[existingIndex] = { ...newCart[existingIndex], quantity: newQty };
        return newCart;
      }
      
      return [...prevCart, { ...product, quantity: 1 }];
    });

    setSearchQuery('');
    setSearchResults([]);
    searchInputRef.current?.focus();
  };

  // Update cart item quantity
  const updateQuantity = (productId, newQty) => {
    if (newQty < 1) {
      removeFromCart(productId);
      return;
    }

    setCart(prevCart => {
      const item = prevCart.find(i => i.product_id === productId);
      if (newQty > item.total_stock) {
        toast.error(`Only ${item.total_stock} ${item.unit}(s) available`);
        return prevCart;
      }
      
      return prevCart.map(i => 
        i.product_id === productId ? { ...i, quantity: newQty } : i
      );
    });
  };

  // Remove item from cart
  const removeFromCart = (productId) => {
    setCart(prevCart => prevCart.filter(item => item.product_id !== productId));
  };

  // Clear cart
  const clearCart = () => {
    setCart([]);
    setSelectedCustomer(null);
    setPaymentMethod('CASH');
    setAmountTendered('');
    setDiscount(0);
    searchInputRef.current?.focus();
  };

  // Process sale
  const processSale = async () => {
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }

    if (paymentMethod === 'CASH' && parseFloat(amountTendered || 0) < total) {
      toast.error('Insufficient payment amount');
      return;
    }

    setIsProcessing(true);

    try {
      const saleData = {
        customerId: selectedCustomer?.customer_id || null,
        items: cart.map(item => ({
          productId: item.product_id,
          quantity: item.quantity,
          unitPrice: item.selling_price
        })),
        discount,
        amountPaid: paymentMethod === 'CREDIT' ? 0 : parseFloat(amountTendered || total),
        paymentMethod
      };

      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(saleData)
      });

      const data = await res.json();

      if (data.success) {
        toast.success('Sale completed!');
        setLastSale(data.sale);
        setShowReceipt(true);
        clearCart();
        loadTodaySummary();
      } else {
        toast.error(data.error || 'Failed to process sale');
      }
    } catch (error) {
      console.error('Sale error:', error);
      toast.error('Failed to process sale');
    } finally {
      setIsProcessing(false);
    }
  };

  // Quick amount buttons
  const quickAmounts = [100, 200, 500, 1000, 2000, 5000];

  return (
    <ProtectedRoute requiredRole="CASHIER">
      <Toaster position="top-right" />
      
      <div className="h-[calc(100vh-8rem)] flex gap-4">
        {/* Left Panel - Product Search & Cart */}
        <div className="flex-1 flex flex-col bg-white rounded-xl shadow-sm overflow-hidden">
          {/* Search Bar */}
          <div className="p-4 border-b">
            <div className="relative">
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Scan barcode or search product..."
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <svg className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {/* Search Results Dropdown */}
            {searchResults.length > 0 && (
              <div className="absolute z-10 mt-1 w-full max-w-lg bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                {searchResults.map(product => (
                  <button
                    key={product.product_id}
                    onClick={() => addToCart(product)}
                    className="w-full px-4 py-3 text-left hover:bg-gray-50 flex justify-between items-center border-b last:border-b-0"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{product.product_name}</p>
                      <p className="text-sm text-gray-500">{product.product_code} • {product.barcode || 'No barcode'}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-green-600">{formatCurrency(product.selling_price)}</p>
                      <p className={`text-sm ${product.in_stock ? 'text-gray-500' : 'text-red-500'}`}>
                        {product.total_stock} {product.unit}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto p-4">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400">
                <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <p className="text-lg">Cart is empty</p>
                <p className="text-sm">Scan a barcode or search for a product</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="text-left text-sm text-gray-500 border-b">
                  <tr>
                    <th className="pb-2">Product</th>
                    <th className="pb-2 text-center w-32">Qty</th>
                    <th className="pb-2 text-right w-24">Price</th>
                    <th className="pb-2 text-right w-28">Subtotal</th>
                    <th className="pb-2 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map(item => (
                    <tr key={item.product_id} className="border-b">
                      <td className="py-3">
                        <p className="font-medium">{item.product_name}</p>
                        <p className="text-sm text-gray-500">{item.product_code}</p>
                      </td>
                      <td className="py-3">
                        <div className="flex items-center justify-center">
                          <button
                            onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                            className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateQuantity(item.product_id, parseInt(e.target.value) || 0)}
                            className="w-12 mx-2 text-center border rounded"
                          />
                          <button
                            onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                            className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td className="py-3 text-right">{formatCurrency(item.selling_price)}</td>
                      <td className="py-3 text-right font-medium">
                        {formatCurrency(item.quantity * item.selling_price)}
                      </td>
                      <td className="py-3">
                        <button
                          onClick={() => removeFromCart(item.product_id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right Panel - Payment */}
        <div className="w-96 flex flex-col bg-white rounded-xl shadow-sm overflow-hidden">
          {/* Today's Summary */}
          {todaySummary && (
            <div className="p-4 bg-green-50 border-b">
              <p className="text-sm text-green-700 font-medium">Today&apos;s Sales</p>
              <p className="text-2xl font-bold text-green-800">{formatCurrency(todaySummary.totalRevenue)}</p>
              <p className="text-xs text-green-600">{todaySummary.totalSales} transactions</p>
            </div>
          )}

          {/* Customer Selection */}
          <div className="p-4 border-b">
            <label className="block text-sm font-medium text-gray-700 mb-2">Customer</label>
            <select
              value={selectedCustomer?.customer_id || ''}
              onChange={(e) => {
                const customer = customers.find(c => c.customer_id === parseInt(e.target.value));
                setSelectedCustomer(customer || null);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            >
              <option value="">Walk-in Customer</option>
              {customers.map(customer => (
                <option key={customer.customer_id} value={customer.customer_id}>
                  {customer.customer_name} ({customer.customer_type})
                </option>
              ))}
            </select>
          </div>

          {/* Totals */}
          <div className="p-4 border-b space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Discount</span>
              <input
                type="number"
                value={discount}
                onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                className="w-24 px-2 py-1 text-right border rounded"
              />
            </div>
            <div className="flex justify-between text-xl font-bold pt-2 border-t">
              <span>Total</span>
              <span className="text-green-600">{formatCurrency(total)}</span>
            </div>
          </div>

          {/* Payment Method */}
          <div className="p-4 border-b">
            <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
            <div className="flex gap-2">
              {['CASH', 'CREDIT', 'MIXED'].map(method => (
                <button
                  key={method}
                  onClick={() => setPaymentMethod(method)}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    paymentMethod === method
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {method}
                </button>
              ))}
            </div>
          </div>

          {/* Amount Tendered */}
          {paymentMethod !== 'CREDIT' && (
            <div className="p-4 border-b">
              <label className="block text-sm font-medium text-gray-700 mb-2">Amount Tendered</label>
              <input
                type="number"
                value={amountTendered}
                onChange={(e) => setAmountTendered(e.target.value)}
                placeholder="0.00"
                className="w-full px-4 py-3 text-xl text-right border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              />
              
              {/* Quick Amount Buttons */}
              <div className="grid grid-cols-3 gap-2 mt-2">
                {quickAmounts.map(amount => (
                  <button
                    key={amount}
                    onClick={() => setAmountTendered(amount.toString())}
                    className="py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm font-medium"
                  >
                    {formatCurrency(amount)}
                  </button>
                ))}
              </div>

              {parseFloat(amountTendered || 0) >= total && (
                <div className="mt-3 p-3 bg-green-50 rounded-lg">
                  <p className="text-sm text-gray-500">Change</p>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(change)}</p>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-auto p-4 space-y-2">
            <button
              onClick={processSale}
              disabled={cart.length === 0 || isProcessing}
              className="w-full py-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Complete Sale
                </>
              )}
            </button>
            <button
              onClick={clearCart}
              className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
            >
              Clear Cart
            </button>
          </div>
        </div>
      </div>

      {/* Receipt Modal */}
      {showReceipt && lastSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              {/* Receipt Header */}
              <div className="text-center border-b pb-4 mb-4">
                <h2 className="text-xl font-bold">AgriVet Store</h2>
                <p className="text-sm text-gray-500">Official Receipt</p>
                <p className="text-sm text-gray-500 mt-2">
                  {new Date(lastSale.sale_date).toLocaleString('en-PH')}
                </p>
                <p className="font-mono text-sm mt-1">{lastSale.invoice_number}</p>
              </div>

              {/* Items */}
              <div className="space-y-2 border-b pb-4 mb-4">
                {lastSale.sale_details.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <div>
                      <p>{item.product.product_name}</p>
                      <p className="text-gray-500">{item.quantity} x {formatCurrency(item.unit_price)}</p>
                    </div>
                    <p className="font-medium">{formatCurrency(item.subtotal)}</p>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{formatCurrency(lastSale.subtotal)}</span>
                </div>
                {lastSale.discount > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>Discount</span>
                    <span>-{formatCurrency(lastSale.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg pt-2 border-t">
                  <span>Total</span>
                  <span>{formatCurrency(lastSale.total_amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Amount Paid</span>
                  <span>{formatCurrency(lastSale.amount_paid)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Change</span>
                  <span>{formatCurrency(lastSale.change_amount)}</span>
                </div>
              </div>

              {/* Footer */}
              <div className="mt-6 pt-4 border-t text-center text-sm text-gray-500">
                <p>Thank you for your purchase!</p>
                <p>Please come again</p>
              </div>

              {/* Close Button */}
              <button
                onClick={() => setShowReceipt(false)}
                className="mt-4 w-full py-3 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </ProtectedRoute>
  );
}
