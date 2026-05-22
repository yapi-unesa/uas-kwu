import { useState, useEffect, useCallback } from 'react';
import './admin.css';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function Admin() {
  const [token, setToken] = useState(() => sessionStorage.getItem('admin_token') || '');
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!sessionStorage.getItem('admin_token'));
  const [password, setPassword] = useState('');
  
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: '', desc: '', image: '', variantName: '', price: '', stock: '' });

  const handleLogout = useCallback(() => {
    sessionStorage.removeItem('admin_token');
    setToken('');
    setIsAuthenticated(false);
  }, []);

  const fetchData = useCallback(() => {
    if (!token) return;
    setLoading(true);

    const headers = { 'Authorization': `Bearer ${token}` };

    Promise.all([
      fetch(`${API_URL}/api/orders/all`, { headers }).then(res => {
        if (res.status === 401) {
          handleLogout();
          throw new Error("Sesi login kedaluwarsa!");
        }
        return res.json();
      }),
      fetch(`${API_URL}/api/products`).then(res => res.json())
    ]).then(([ordersData, productsData]) => {
      setOrders(ordersData);
      setProducts(productsData);
      setLoading(false);
    }).catch(err => {
      console.error("Gagal mengambil data:", err);
      setLoading(false);
    });
  }, [token, handleLogout]);

  useEffect(() => {
    if (isAuthenticated && token) {
      const timer = setTimeout(() => {
        fetchData();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, token, fetchData]);

  const handleLogin = (e) => {
    e.preventDefault();
    fetch(`${API_URL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    })
    .then(res => {
      if (!res.ok) throw new Error("Password salah!");
      return res.json();
    })
    .then(data => {
      if (data.token) {
        sessionStorage.setItem('admin_token', data.token);
        setToken(data.token);
        setIsAuthenticated(true);
      }
    })
    .catch(err => {
      alert(err.message);
      setPassword('');
    });
  };

  const updateStock = (variantId, currentStock, delta) => {
    const newStock = currentStock + delta;
    if (newStock < 0) return;

    fetch(`${API_URL}/api/variants/${variantId}/stock`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ stock: newStock })
    })
    .then(res => {
      if (res.status === 401) {
        handleLogout();
        throw new Error("Sesi login kedaluwarsa!");
      }
      return res.json();
    })
    .then(() => {
      fetchData(); // Refresh data setelah update
    })
    .catch(err => console.error("Gagal update stok:", err));
  };

  const handleAddProduct = (e) => {
    e.preventDefault();
    fetch(`${API_URL}/api/products`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(newProduct)
    })
    .then(res => {
      if (res.status === 401) {
        handleLogout();
        throw new Error("Sesi login kedaluwarsa!");
      }
      if (!res.ok) throw new Error("Gagal menambah produk");
      return res.json();
    })
    .then(() => {
      alert("Produk berhasil ditambahkan!");
      setNewProduct({ name: '', desc: '', image: '', variantName: '', price: '', stock: '' });
      fetchData();
    })
    .catch(err => alert(err.message));
  };

  const handleDeleteProduct = (productId) => {
    if (window.confirm("Apakah Anda yakin ingin menghapus menu ini secara permanen?")) {
      fetch(`${API_URL}/api/products/${productId}`, {
        method: 'DELETE',
        headers: { 
          'Authorization': `Bearer ${token}`
        }
      })
      .then(res => {
        if (res.status === 401) {
          handleLogout();
          throw new Error("Sesi login kedaluwarsa!");
        }
        if (!res.ok) throw new Error("Gagal menghapus produk");
        return res.json();
      })
      .then(() => {
        alert("Produk berhasil dihapus!");
        fetchData();
      })
      .catch(err => alert(err.message));
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="admin-login-container">
        <div className="admin-login-box">
          <h2>Admin Login</h2>
          <p>Masukkan password untuk mengakses Dashboard Owner.</p>
          <form onSubmit={handleLogin}>
            <input 
              type="password" 
              placeholder="Password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="admin-input"
            />
            <button type="submit" className="admin-btn">Login</button>
          </form>
        </div>
      </div>
    );
  }

  // Hitung statistik pesanan
  const successfulOrders = orders.filter(o => o.status === 'success');
  const totalRevenue = successfulOrders.reduce((sum, order) => sum + order.total_amount, 0);

  // Proses data untuk Grafik Produk Terlaris (Bar Chart)
  const productSalesMap = {};
  successfulOrders.forEach(order => {
    order.items.forEach(item => {
      const name = item.product_name;
      if (!productSalesMap[name]) productSalesMap[name] = 0;
      productSalesMap[name] += item.quantity;
    });
  });
  
  const barChartData = Object.keys(productSalesMap).map(key => ({
    name: key,
    Terjual: productSalesMap[key]
  }));

  // Proses data untuk Tren Pendapatan (Line Chart)
  const revenueTrendMap = {};
  successfulOrders.forEach(order => {
    const date = new Date(order.created_at).toLocaleDateString('id-ID'); // Format: DD/MM/YYYY
    if (!revenueTrendMap[date]) revenueTrendMap[date] = 0;
    revenueTrendMap[date] += order.total_amount;
  });

  const lineChartData = Object.keys(revenueTrendMap)
    .sort((a, b) => new Date(a.split('/').reverse().join('-')) - new Date(b.split('/').reverse().join('-')))
    .map(date => ({
      Tanggal: date,
      Pendapatan: revenueTrendMap[date]
    }));

  return (
    <div className="admin-dashboard">
      <header className="admin-header">
        <div className="admin-logo">KTG Owner Panel</div>
        <button className="admin-logout" onClick={handleLogout}>Logout</button>
      </header>

      <main className="admin-main">
        <div className="admin-header-title">
          <h1>Dashboard Pesanan & Stok</h1>
          <button onClick={fetchData} className="admin-btn-refresh">Refresh Data</button>
        </div>

        {/* Stats Row */}
        <div className="admin-stats">
          <div className="stat-card">
            <div className="stat-value">{orders.length}</div>
            <div className="stat-label">Total Pesanan (Semua)</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{successfulOrders.length}</div>
            <div className="stat-label">Pesanan Lunas</div>
          </div>
          <div className="stat-card stat-highlight">
            <div className="stat-value">Rp {totalRevenue.toLocaleString('id-ID')}</div>
            <div className="stat-label">Total Pendapatan Bersih</div>
          </div>
        </div>

        {/* Charts Row */}
        <div className="admin-charts-row">
          <div className="admin-chart-card">
            <h3>Tren Pendapatan Harian</h3>
            {lineChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={lineChartData} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="Tanggal" />
                  <YAxis />
                  <Tooltip formatter={(value) => `Rp ${value.toLocaleString('id-ID')}`} />
                  <Legend />
                  <Line type="monotone" dataKey="Pendapatan" stroke="#0b1c3d" activeDot={{ r: 8 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center" style={{marginTop: '50px', color: '#888'}}>Belum ada data pendapatan (kosong)</p>
            )}
          </div>
          <div className="admin-chart-card">
            <h3>Produk Terlaris (Porsi)</h3>
            {barChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={barChartData} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Terjual" fill="#fca311" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
               <p className="text-center" style={{marginTop: '50px', color: '#888'}}>Belum ada produk terjual</p>
            )}
          </div>
        </div>

        {/* Add Product Form */}
        <div className="admin-section-title">
          <h2>Tambah Menu Baru</h2>
        </div>
        <div className="admin-add-product-card">
          <form onSubmit={handleAddProduct} className="add-product-form">
            <div className="form-group">
              <label>Nama Menu</label>
              <input type="text" required value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} placeholder="Contoh: Sosis Bakar" />
            </div>
            <div className="form-group">
              <label>Deskripsi Singkat</label>
              <input type="text" value={newProduct.desc} onChange={e => setNewProduct({...newProduct, desc: e.target.value})} placeholder="Sosis sapi asli dibakar lezat..." />
            </div>
            <div className="form-group">
              <label>URL Gambar (Opsional)</label>
              <input type="text" value={newProduct.image} onChange={e => setNewProduct({...newProduct, image: e.target.value})} placeholder="https://..." />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Nama Varian (Opsional)</label>
                <input type="text" value={newProduct.variantName} onChange={e => setNewProduct({...newProduct, variantName: e.target.value})} placeholder="Regular" />
              </div>
              <div className="form-group">
                <label>Harga (Rp)</label>
                <input type="number" required value={newProduct.price} onChange={e => setNewProduct({...newProduct, price: e.target.value})} placeholder="10000" />
              </div>
              <div className="form-group">
                <label>Stok Awal</label>
                <input type="number" required value={newProduct.stock} onChange={e => setNewProduct({...newProduct, stock: e.target.value})} placeholder="50" />
              </div>
            </div>
            <button type="submit" className="btn btn-primary">Simpan Menu Baru</button>
          </form>
        </div>

        {/* Stock Management Table */}
        <div className="admin-section-title">
          <h2>Manajemen Menu & Stok</h2>
        </div>
        <div className="admin-table-container" style={{marginBottom: '3rem'}}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Produk</th>
                <th>Varian</th>
                <th>Harga</th>
                <th>Sisa Stok</th>
                <th>Aksi Kelola Stok</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                product.variants.map((v, i) => (
                  <tr key={v.id}>
                    {i === 0 ? (
                      <td rowSpan={product.variants.length}>
                        <strong>{product.name}</strong><br/>
                        <button className="btn-delete" onClick={() => handleDeleteProduct(product.id)}>Hapus Menu</button>
                      </td>
                    ) : null}
                    <td>{v.name}</td>
                    <td>Rp {v.price.toLocaleString('id-ID')}</td>
                    <td>
                      <span className={`status-badge ${v.stock < 10 ? 'status-failed' : 'status-success'}`}>
                        {v.stock} Porsi
                      </span>
                    </td>
                    <td>
                      <button className="qty-btn-admin" onClick={() => updateStock(v.id, v.stock, -1)} disabled={v.stock === 0}>-1</button>
                      <button className="qty-btn-admin" onClick={() => updateStock(v.id, v.stock, 5)}>+5</button>
                      <button className="qty-btn-admin" onClick={() => updateStock(v.id, v.stock, 10)}>+10</button>
                    </td>
                  </tr>
                ))
              ))}
            </tbody>
          </table>
        </div>

        {/* Orders Table */}
        <div className="admin-section-title">
          <h2>Daftar Pesanan Masuk</h2>
        </div>
        <div className="admin-table-container">
          {loading ? (
            <p className="loading-text">Memuat pesanan...</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID Order</th>
                  <th>Waktu Pemesanan</th>
                  <th>Item yang Dibeli</th>
                  <th>Total Harga</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center">Belum ada pesanan masuk.</td>
                  </tr>
                ) : (
                  orders.map(order => (
                    <tr key={order.id}>
                      <td>#{order.id}</td>
                      <td>{new Date(order.created_at).toLocaleString('id-ID')}</td>
                      <td>
                        <ul className="admin-item-list">
                          {order.items.map((item, idx) => (
                            <li key={idx}>
                              {item.quantity}x {item.product_name} ({item.variant_name})
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td style={{fontWeight: 'bold'}}>Rp {order.total_amount.toLocaleString('id-ID')}</td>
                      <td>
                        <span className={`status-badge status-${order.status}`}>
                          {order.status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}

export default Admin;
