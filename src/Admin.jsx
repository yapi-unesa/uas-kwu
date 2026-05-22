import React, { useState, useEffect } from 'react';
import './admin.css';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function Admin() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);

  // States for dynamic product creation modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newProductDesc, setNewProductDesc] = useState('');
  const [newProductImage, setNewProductImage] = useState('');
  const [newVariants, setNewVariants] = useState([
    { name: 'Porsi Standar', price: 8000, stock: 50 }
  ]);

  const handleLogin = (e) => {
    e.preventDefault();
    if (password === 'admin123') {
      setIsAuthenticated(true);
      fetchData();
    } else {
      alert("Password salah!");
      setPassword('');
    }
  };

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      fetch(`${API_BASE_URL}/api/orders/all`).then(res => res.json()),
      fetch(`${API_BASE_URL}/api/products`).then(res => res.json())
    ]).then(([ordersData, productsData]) => {
      setOrders(ordersData);
      setProducts(productsData);
      setLoading(false);
    }).catch(err => {
      console.error("Gagal mengambil data:", err);
      setLoading(false);
    });
  };

  const updateStock = (variantId, currentStock, delta) => {
    const newStock = currentStock + delta;
    if (newStock < 0) return;

    fetch(`${API_BASE_URL}/api/variants/${variantId}/stock`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stock: newStock })
    })
    .then(res => res.json())
    .then(() => {
      fetchData(); // Refresh data setelah update
    })
    .catch(err => console.error("Gagal update stok:", err));
  };

  const handleDeleteProduct = (productId, productName) => {
    if (window.confirm(`Peringatan: Apakah Anda yakin ingin menghapus menu "${productName}"?\n\nMenghapus menu yang sudah pernah dibeli akan mempengaruhi data statistik penjualan di Dashboard.`)) {
      fetch(`${API_BASE_URL}/api/products/${productId}`, {
        method: 'DELETE'
      })
      .then(res => res.json())
      .then(() => {
        alert("Menu berhasil dihapus!");
        fetchData();
      })
      .catch(err => {
        console.error("Gagal menghapus produk:", err);
        alert("Gagal menghapus menu.");
      });
    }
  };

  const handleCreateProduct = (e) => {
    e.preventDefault();
    if (!newProductName.trim()) {
      alert("Nama menu wajib diisi!");
      return;
    }
    if (newVariants.length === 0) {
      alert("Minimal harus ada 1 varian!");
      return;
    }

    // Validate variants
    for (let v of newVariants) {
      if (!v.name.trim()) {
        alert("Nama varian wajib diisi!");
        return;
      }
      if (v.price <= 0) {
        alert("Harga varian harus lebih besar dari 0!");
        return;
      }
      if (v.stock < 0) {
        alert("Stok tidak boleh bernilai negatif!");
        return;
      }
    }

    const payload = {
      name: newProductName,
      desc: newProductDesc,
      image: newProductImage.trim() || '/assets/kentang_tingtung.png',
      variants: newVariants
    };

    fetch(`${API_BASE_URL}/api/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(() => {
      alert("Menu baru berhasil ditambahkan!");
      setIsModalOpen(false);
      // Reset form fields
      setNewProductName('');
      setNewProductDesc('');
      setNewProductImage('');
      setNewVariants([{ name: 'Porsi Standar', price: 8000, stock: 50 }]);
      fetchData();
    })
    .catch(err => {
      console.error("Gagal menambahkan menu baru:", err);
      alert("Terjadi kesalahan saat menambahkan menu.");
    });
  };

  const addVariantRow = () => {
    setNewVariants(prev => [...prev, { name: '', price: 8000, stock: 50 }]);
  };

  const removeVariantRow = (index) => {
    if (newVariants.length === 1) return;
    setNewVariants(prev => prev.filter((_, idx) => idx !== index));
  };

  const updateVariantRow = (index, field, value) => {
    setNewVariants(prev => prev.map((item, idx) => {
      if (idx === index) {
        return { 
          ...item, 
          [field]: field === 'price' || field === 'stock' ? (value === '' ? '' : Number(value)) : value 
        };
      }
      return item;
    }));
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
      const name = item.product_name || '[Menu Dihapus]';
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
        <button className="admin-logout" onClick={() => setIsAuthenticated(false)}>Logout</button>
      </header>

      <main className="admin-main">
        <div className="admin-header-title">
          <h1>Dashboard Pesanan & Stok</h1>
          <div className="admin-header-actions">
            <button onClick={() => setIsModalOpen(true)} className="admin-btn-accent">Tambah Menu Baru</button>
            <button onClick={fetchData} className="admin-btn-refresh">Refresh Data</button>
          </div>
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

        {/* Product Management Table */}
        <div className="admin-section-title">
          <h2>Manajemen Menu & Produk</h2>
        </div>
        <div className="admin-table-container" style={{marginBottom: '3rem'}}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Gambar</th>
                <th>Nama Menu</th>
                <th>Deskripsi</th>
                <th>Varian & Harga</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center">Belum ada menu produk. Silakan tambahkan!</td>
                </tr>
              ) : (
                products.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <img src={product.image} alt={product.name} className="admin-product-img" />
                    </td>
                    <td><strong>{product.name}</strong></td>
                    <td style={{maxWidth: '300px', color: '#666', fontSize: '0.9rem'}}>{product.desc || '-'}</td>
                    <td>
                      <ul className="admin-item-list" style={{paddingLeft: '15px'}}>
                        {product.variants.map((v) => (
                          <li key={v.id}>
                            {v.name}: <strong>Rp {v.price.toLocaleString('id-ID')}</strong> (Stok: {v.stock})
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td>
                      <button 
                        onClick={() => handleDeleteProduct(product.id, product.name)} 
                        className="admin-btn-danger"
                      >
                        Hapus
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Stock Management Table */}
        <div className="admin-section-title">
          <h2>Manajemen Stok Inventaris</h2>
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
                    {i === 0 ? <td rowSpan={product.variants.length}><strong>{product.name}</strong></td> : null}
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
                              {item.quantity}x {item.product_name || '[Menu Dihapus]'} ({item.variant_name || 'Varian Dihapus'})
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

      {/* Modal Form Tambah Menu Baru */}
      {isModalOpen && (
        <div className="admin-modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3>Tambah Menu Produk Baru</h3>
              <button className="admin-modal-close" onClick={() => setIsModalOpen(false)}>&times;</button>
            </div>
            <form onSubmit={handleCreateProduct}>
              <div className="admin-modal-body">
                <div className="admin-form-group">
                  <label>Nama Menu *</label>
                  <input 
                    type="text" 
                    placeholder="Contoh: Sosis Bakar"
                    value={newProductName}
                    onChange={(e) => setNewProductName(e.target.value)}
                    className="admin-input"
                    required
                  />
                </div>
                
                <div className="admin-form-group">
                  <label>Deskripsi Menu</label>
                  <textarea 
                    placeholder="Contoh: Sosis sapi panggang lezat dengan bumbu barbeque..."
                    value={newProductDesc}
                    onChange={(e) => setNewProductDesc(e.target.value)}
                    className="admin-form-textarea"
                  />
                </div>
                
                <div className="admin-form-group">
                  <label>Path/URL Gambar (Kosongkan untuk default)</label>
                  <input 
                    type="text" 
                    placeholder="Contoh: /assets/kentang_tingtung.png"
                    value={newProductImage}
                    onChange={(e) => setNewProductImage(e.target.value)}
                    className="admin-input"
                  />
                </div>
                
                <div className="admin-form-group">
                  <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Varian Ukuran / Porsi *</span>
                    <button 
                      type="button" 
                      onClick={addVariantRow} 
                      className="qty-btn-admin" 
                      style={{ fontSize: '0.8rem', padding: '4px 8px' }}
                    >
                      + Tambah Varian
                    </button>
                  </label>
                  
                  <div className="admin-variant-builder">
                    {newVariants.map((variant, index) => (
                      <div key={index} className="admin-variant-row">
                        <input 
                          type="text" 
                          placeholder="Nama Varian (Small/Large)" 
                          value={variant.name}
                          onChange={(e) => updateVariantRow(index, 'name', e.target.value)}
                          required
                        />
                        <input 
                          type="number" 
                          placeholder="Harga (Rupiah)" 
                          value={variant.price}
                          min="1"
                          onChange={(e) => updateVariantRow(index, 'price', e.target.value)}
                          required
                        />
                        <input 
                          type="number" 
                          placeholder="Stok Awal" 
                          value={variant.stock}
                          min="0"
                          onChange={(e) => updateVariantRow(index, 'stock', e.target.value)}
                          required
                        />
                        <button 
                          type="button" 
                          onClick={() => removeVariantRow(index)} 
                          className="admin-btn-danger"
                          style={{ padding: '6px 10px', height: '36px', display: 'flex', alignItems: 'center' }}
                          disabled={newVariants.length === 1}
                        >
                          &times;
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="admin-modal-footer">
                <button type="button" onClick={() => setIsModalOpen(false)} className="admin-btn-secondary">
                  Batal
                </button>
                <button type="submit" className="admin-btn-accent" style={{ padding: '10px 20px' }}>
                  Simpan Menu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Admin;
