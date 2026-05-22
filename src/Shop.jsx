import React, { useState, useEffect } from 'react';
import './index.css';

function Shop() {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');

  useEffect(() => {
    fetch('http://localhost:3000/api/products')
      .then(res => res.json())
      .then(data => {
        setProducts(data);
      })
      .catch(err => {
        console.error("Gagal mengambil data dari server:", err);
        alert("Backend server belum berjalan! Pastikan Anda menjalankan 'npm run dev'.");
      });
  }, []);

  const addToCart = (product, variant) => {
    setCart(prev => {
      const existingItem = prev.find(item => item.variant.id === variant.id);
      if (existingItem) {
        return prev.map(item =>
          item.variant.id === variant.id
            ? { ...item, qty: item.qty + 1 }
            : item
        );
      }
      return [...prev, { product, variant, qty: 1 }];
    });
    setIsCartOpen(true);
  };

  const updateQty = (variantId, delta) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.variant.id === variantId) {
          const newQty = item.qty + delta;
          return { ...item, qty: newQty > 0 ? newQty : 0 };
        }
        return item;
      }).filter(item => item.qty > 0);
    });
  };

  const cartTotal = cart.reduce((total, item) => total + (item.variant.price * item.qty), 0);
  const cartItemCount = cart.reduce((count, item) => count + item.qty, 0);

  const handleCheckout = async () => {
    setIsCheckingOut(true);
    if (!customerName || !customerAddress) {
      alert("Nama dan alamat wajib diisi!");
      setIsCheckingOut(false);
      return;
    }
    try {
      // 1. Simpan pesanan ke database dan minta token Midtrans
      const response = await fetch('http://localhost:3000/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cart: cart,
          totalAmount: cartTotal,
          customerName,
          customerAddress
        })
      });
      
      if (!response.ok) throw new Error('Gagal memproses pesanan');
      
      const data = await response.json();
      
      if (data.token) {
        // Tutup keranjang
        setIsCartOpen(false);
        
        // 2. Panggil Midtrans Snap Pop-up bawaan asli (Asli bukan mock)
        window.snap.pay(data.token, {
          onSuccess: function(result) {
              fetch(`http://localhost:3000/api/orders/${data.orderId}/success`, {
                method: 'PUT'
              }).then(() => {
                // Buat daftar produk
                const itemList = cart.map(item =>
                  `- ${item.product.name} (${item.variant.name}) x${item.qty}`
                ).join('\n');
                // Template pesan WA
                const message = `
            Halo Admin, saya sudah melakukan pembayaran.
            
            Nama: ${customerName}
            Alamat: ${customerAddress}
            
            Pesanan:
            ${itemList}
            
            Total: Rp ${cartTotal.toLocaleString('id-ID')}
            
            Mohon segera diproses ya admin.
            `;
            
                // Nomor admin
                const adminNumber = '628213195653';
                // Redirect WhatsApp
                window.open(
                  `https://wa.me/${adminNumber}?text=${encodeURIComponent(message)}`,
                  '_blank'
                );
            
                alert("Pembayaran berhasil!");
                console.log(result);
            
                setCart([]);
                setCustomerName('');
                setCustomerAddress('');
            
              }).catch(e => console.error("Gagal update DB", e));
            }
          onPending: function(result) {
            alert("Menunggu pembayaran Anda!");
            console.log(result);
            setCart([]);
          },
          onError: function(result) {
            alert("Pembayaran gagal!");
            console.log(result);
          },
          onClose: function() {
            alert("Anda menutup jendela sebelum menyelesaikan pembayaran.");
          }
        });
      } else {
        alert("Gagal mendapatkan token Midtrans.");
      }

    } catch (error) {
      alert("Terjadi kesalahan sistem saat checkout. Pastikan backend server menyala.");
      console.error(error);
    } finally {
      setIsCheckingOut(false);
    }
  };

  return (
    <div className="app-container">
      {/* Navbar */}
      <nav className="navbar">
        <div className="container">
          <a href="#" className="logo">
            KENTANG <span>TINGTUNG</span>
          </a>
          <div className="cart-icon" onClick={() => setIsCartOpen(true)}>
            <svg viewBox="0 0 24 24">
              <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/>
            </svg>
            {cartItemCount > 0 && <span className="cart-badge">{cartItemCount}</span>}
          </div>
        </div>
      </nav>

      <main>
        {/* Hero */}
        <section className="hero">
          <div className="container text-center hero-content">
            <h1 className="animate-fade-in">Siap Menemani Hari-harimu!</h1>
            <p className="animate-fade-in" style={{animationDelay: '0.2s'}}>
              Dibuat dari kentang dan baso pilihan, digoreng dengan sempurna, dan dibumbui dengan rasa yang pas.
            </p>
            <div className="ingredients animate-fade-in" style={{animationDelay: '0.4s'}}>
              <h4>Ingredients</h4>
              <div className="ingredient-item"><span>Crispiness</span><span>100%</span></div>
              <div className="ingredient-item"><span>Happiness</span><span>100%</span></div>
              <div className="ingredient-item"><span>Addiction</span><span>100%</span></div>
            </div>
          </div>
        </section>

        {/* Products */}
        <section className="products">
          <div className="container">
            <h2 className="section-title">Menu Favorit</h2>
            {products.length === 0 ? (
              <p className="text-center">Memuat produk dari database...</p>
            ) : (
              <div className="product-grid">
                {products.map(product => (
                  <ProductCard key={product.id} product={product} onAdd={addToCart} />
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <h2>KENTANG TINGTUNG</h2>
          <div className="social-links">
            <a href="https://instagram.com/haidaraliyafi_" target="_blank" rel="noopener noreferrer"><svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg> @kentangtingtung</a>
            <a href="https://wa.me/628213195653" target="_blank" rel="noopener noreferrer"><svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg> 0821 3195 653</a>
          </div>
          <p>&copy; 2026 Kentang Tingtung. All rights reserved.</p>
        </div>
      </footer>

      {/* Cart Sidebar */}
      <div className={`cart-overlay ${isCartOpen ? 'open' : ''}`} onClick={() => setIsCartOpen(false)}></div>
      <div className={`cart-sidebar ${isCartOpen ? 'open' : ''}`}>
        <div className="cart-header">
          <h2>Keranjang Belanja</h2>
          <button className="close-cart" onClick={() => setIsCartOpen(false)}>&times;</button>
        </div>
        <div className="cart-items">
          {cart.length === 0 ? (
            <div className="empty-cart">Keranjang masih kosong. Yuk belanja!</div>
          ) : (
            cart.map((item, idx) => (
              <div key={idx} className="cart-item">
                <img src={item.product.image} alt={item.product.name} className="cart-item-img" />
                <div className="cart-item-details">
                  <div className="cart-item-title">{item.product.name}</div>
                  <div className="cart-item-variant">Variant: {item.variant.name}</div>
                  <div className="cart-item-price">Rp {item.variant.price.toLocaleString('id-ID')}</div>
                </div>
                <div className="cart-item-actions">
                  <button className="qty-btn" onClick={() => updateQty(item.variant.id, -1)}>-</button>
                  <span>{item.qty}</span>
                  <button className="qty-btn" onClick={() => updateQty(item.variant.id, 1)}>+</button>
                </div>
              </div>
            ))
          )}
        </div>
        {cart.length > 0 && (
          <div className="cart-footer">
            <div className="checkout-form">
              <input
                type="text"
                placeholder="Nama Pembeli"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="checkout-input"
              />
            
              <textarea
                placeholder="Alamat Pembeli"
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                className="checkout-input"
              />
            </div>
            <div className="cart-total">
              <span>Total</span>
              <span>Rp {cartTotal.toLocaleString('id-ID')}</span>
            </div>
            <button className="btn btn-primary checkout-btn" onClick={handleCheckout} disabled={isCheckingOut}>
              {isCheckingOut ? 'Memproses...' : 'Checkout Sekarang'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ProductCard({ product, onAdd }) {
  if (!product.variants || product.variants.length === 0) return null;

  const [selectedVariant, setSelectedVariant] = useState(product.variants[0]);

  return (
    <div className="product-card">
      <div className="product-image-container">
        <img src={product.image} alt={product.name} className="product-image" />
      </div>
      <div className="product-info">
        <h3 className="product-title">{product.name}</h3>
        <p className="product-desc">{product.desc}</p>
        
        <div className="product-variants">
          {product.variants.map(v => (
            <div 
              key={v.id} 
              className={`variant-box ${selectedVariant.id === v.id ? 'selected' : ''}`}
              onClick={() => setSelectedVariant(v)}
            >
              <div className="variant-name">{v.name}</div>
              <div className="variant-price">{v.price / 1000}K</div>
              <div style={{fontSize: '10px', color: v.stock === 0 ? 'red' : 'green', marginTop: '2px'}}>
                {v.stock > 0 ? `Sisa: ${v.stock}` : 'Habis'}
              </div>
            </div>
          ))}
        </div>

        <button 
          className="btn btn-primary add-to-cart-btn"
          onClick={() => onAdd(product, selectedVariant)}
          disabled={selectedVariant.stock === 0}
          style={{ backgroundColor: selectedVariant.stock === 0 ? '#ccc' : undefined }}
        >
          {selectedVariant.stock === 0 ? 'Stok Habis' : `Add to Cart - Rp ${selectedVariant.price.toLocaleString('id-ID')}`}
        </button>
      </div>
    </div>
  );
}

export default Shop;
