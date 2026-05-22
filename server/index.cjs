const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const midtransClient = require('midtrans-client');
require('dotenv').config();

const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Midtrans Snap API
let snap = new midtransClient.Snap({
    isProduction: false,
    serverKey: process.env.MIDTRANS_SERVER_KEY,
    clientKey: process.env.MIDTRANS_CLIENT_KEY
});

// Initialize SQLite Database
const dbPath = path.resolve(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    initDb();
  }
});

// Create tables and seed data if not exists
function initDb() {
  db.serialize(() => {
    // Create Products Table
    db.run(`CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      desc TEXT,
      image TEXT
    )`);

    // Create Variants Table
    db.run(`CREATE TABLE IF NOT EXISTS variants (
      id TEXT PRIMARY KEY,
      product_id TEXT,
      name TEXT NOT NULL,
      price INTEGER NOT NULL,
      stock INTEGER DEFAULT 50,
      FOREIGN KEY (product_id) REFERENCES products(id)
    )`);

    // Create Orders Table
    db.run(`CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      total_amount INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Create Order Items Table
    db.run(`CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER,
      variant_id TEXT,
      quantity INTEGER,
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (variant_id) REFERENCES variants(id)
    )`);

    // Seed Data
    db.get("SELECT COUNT(*) as count FROM products", (err, row) => {
      if (row.count === 0) {
        console.log("Seeding initial product data...");
        
        const products = [
          { id: 'p1', name: 'Kentang Goreng', desc: 'Kentang goreng crispy dan lezat, digoreng dengan sempurna.', image: '/assets/kentang_goreng.png' },
          { id: 'p2', name: 'Baso Goreng', desc: 'Baso pilihan yang digoreng crispy, enak disantap sendiri atau dengan saus.', image: '/assets/baso_goreng.png' },
          { id: 'p3', name: 'Kentang Tingtung', desc: 'Kombinasi spesial kentang dan basreng dengan saus lezat favoritmu!', image: '/assets/kentang_tingtung.png' }
        ];

        const variants = [
          { id: 'v1_small', product_id: 'p1', name: 'Small', price: 8000, stock: 50 },
          { id: 'v1_large', product_id: 'p1', name: 'Large', price: 15000, stock: 50 },
          { id: 'v2_small', product_id: 'p2', name: 'Small', price: 8000, stock: 50 },
          { id: 'v2_large', product_id: 'p2', name: 'Large', price: 15000, stock: 50 },
          { id: 'v3_start', product_id: 'p3', name: 'Start from', price: 8000, stock: 50 }
        ];

        const insertProduct = db.prepare(`INSERT INTO products (id, name, desc, image) VALUES (?, ?, ?, ?)`);
        products.forEach(p => insertProduct.run(p.id, p.name, p.desc, p.image));
        insertProduct.finalize();

        const insertVariant = db.prepare(`INSERT INTO variants (id, product_id, name, price, stock) VALUES (?, ?, ?, ?, ?)`);
        variants.forEach(v => insertVariant.run(v.id, v.product_id, v.name, v.price, v.stock));
        insertVariant.finalize();
      }
    });
  });
}

// 1. Get all products with their variants
app.get('/api/products', (req, res) => {
  const query = `
    SELECT p.id as p_id, p.name as p_name, p.desc as p_desc, p.image as p_image,
           v.id as v_id, v.name as v_name, v.price as v_price, v.stock as v_stock
    FROM products p
    LEFT JOIN variants v ON p.id = v.product_id
  `;

  db.all(query, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    const productsMap = new Map();
    rows.forEach(row => {
      if (!productsMap.has(row.p_id)) {
        productsMap.set(row.p_id, {
          id: row.p_id, name: row.p_name, desc: row.p_desc, image: row.p_image, variants: []
        });
      }
      if (row.v_id) {
        productsMap.get(row.p_id).variants.push({
          id: row.v_id, name: row.v_name, price: row.v_price, stock: row.v_stock
        });
      }
    });

    res.json(Array.from(productsMap.values()));
  });
});

// 2. Create a new product (Admin)
app.post('/api/products', (req, res) => {
  const { name, desc, image, variantName, price, stock } = req.body;
  if (!name || !price) {
    return res.status(400).json({ error: 'Name and price are required' });
  }

  const productId = 'p' + Date.now();
  const variantId = 'v' + Date.now();
  const vName = variantName || 'Regular';

  db.serialize(() => {
    db.run("BEGIN TRANSACTION");
    const insertProduct = db.prepare(`INSERT INTO products (id, name, desc, image) VALUES (?, ?, ?, ?)`);
    insertProduct.run(productId, name, desc || '', image || '/assets/hero.png');
    insertProduct.finalize();

    const insertVariant = db.prepare(`INSERT INTO variants (id, product_id, name, price, stock) VALUES (?, ?, ?, ?, ?)`);
    insertVariant.run(variantId, productId, vName, parseInt(price), parseInt(stock) || 0);
    insertVariant.finalize();

    db.run("COMMIT", (err) => {
      if (err) {
        db.run("ROLLBACK");
        return res.status(500).json({ error: 'Transaction failed' });
      }
      res.json({ message: 'Product created successfully', id: productId });
    });
  });
});

// 3. Delete a product (Admin)
app.delete('/api/products/:id', (req, res) => {
  const productId = req.params.id;

  db.serialize(() => {
    db.run("BEGIN TRANSACTION");
    
    // First delete variants associated with the product
    db.run(`DELETE FROM variants WHERE product_id = ?`, [productId], (err) => {
      if (err) {
        db.run("ROLLBACK");
        return res.status(500).json({ error: 'Failed to delete variants' });
      }
      
      // Then delete the product itself
      db.run(`DELETE FROM products WHERE id = ?`, [productId], (err) => {
        if (err) {
          db.run("ROLLBACK");
          return res.status(500).json({ error: 'Failed to delete product' });
        }
        
        db.run("COMMIT", (commitErr) => {
          if (commitErr) return res.status(500).json({ error: 'Transaction commit failed' });
          res.json({ message: 'Product deleted successfully' });
        });
      });
    });
  });
});

// 4. Create a new order & request Midtrans Token
app.post('/api/orders', (req, res) => {
  const { cart, totalAmount } = req.body;
  
  if (!cart || cart.length === 0) {
    return res.status(400).json({ error: 'Cart is empty' });
  }

  db.serialize(() => {
    db.run("BEGIN TRANSACTION");

    // Insert to orders table with 'pending' status
    db.run(`INSERT INTO orders (total_amount, status) VALUES (?, ?)`, [totalAmount, 'pending'], function(err) {
      if (err) {
        db.run("ROLLBACK");
        return res.status(500).json({ error: 'Failed to create order' });
      }

      const orderId = this.lastID;
      const stmt = db.prepare(`INSERT INTO order_items (order_id, variant_id, quantity) VALUES (?, ?, ?)`);
      
      cart.forEach(item => {
        stmt.run(orderId, item.variant.id, item.qty);
      });
      stmt.finalize();
      
      db.run("COMMIT", async (commitErr) => {
        if (commitErr) {
          return res.status(500).json({ error: 'Transaction commit failed' });
        }

        try {
          // Construct item details for Midtrans
          const item_details = cart.map(item => ({
            id: item.variant.id,
            price: item.variant.price,
            quantity: item.qty,
            name: `${item.product.name} (${item.variant.name})`
          }));

          // Create parameter for Midtrans API
          let parameter = {
            "transaction_details": {
                "order_id": `KTG-UAS-${orderId}-${Date.now()}`,
                "gross_amount": totalAmount
            },
            "item_details": item_details,
            "credit_card": {
                "secure" : true
            }
          };

          // Call Midtrans API
          const transaction = await snap.createTransaction(parameter);
          
          res.status(201).json({ 
            message: 'Order created successfully', 
            orderId: orderId,
            token: transaction.token // This token is needed by Frontend Snap JS
          });
        } catch (e) {
          console.error("Midtrans Error:", e.message);
          res.status(500).json({ error: 'Failed to get Midtrans Token' });
        }
      });
    });
  });
});

// 3. (Optional) Webhook Endpoint to handle payment notifications from Midtrans
app.post('/api/midtrans/webhook', (req, res) => {
  snap.transaction.notification(req.body)
    .then((statusResponse) => {
      let orderId = statusResponse.order_id;
      let transactionStatus = statusResponse.transaction_status;
      let fraudStatus = statusResponse.fraud_status;

      let localOrderId = orderId.split('-')[2]; // Extract local ID from KTG-UAS-<ID>-<TIMESTAMP>

      if (transactionStatus == 'capture'){
          if (fraudStatus == 'challenge'){
              db.run(`UPDATE orders SET status = 'challenge' WHERE id = ?`, [localOrderId]);
          } else if (fraudStatus == 'accept'){
              db.run(`UPDATE orders SET status = 'success' WHERE id = ?`, [localOrderId]);
          }
      } else if (transactionStatus == 'settlement'){
          db.run(`UPDATE orders SET status = 'success' WHERE id = ?`, [localOrderId]);
      } else if (transactionStatus == 'cancel' || transactionStatus == 'deny' || transactionStatus == 'expire'){
          db.run(`UPDATE orders SET status = 'failed' WHERE id = ?`, [localOrderId]);
      } else if (transactionStatus == 'pending'){
          db.run(`UPDATE orders SET status = 'pending' WHERE id = ?`, [localOrderId]);
      }
      
      res.status(200).send('OK');
    })
    .catch((e) => {
      res.status(500).json({error: e.message});
    });
});

// 5. (Demo Purpose) Endpoint to manually mark order as success from Frontend and reduce stock
app.put('/api/orders/:id/success', (req, res) => {
  const localOrderId = req.params.id;
  
  db.serialize(() => {
    db.run("BEGIN TRANSACTION");

    // Get items to decrement stock
    db.all(`SELECT variant_id, quantity FROM order_items WHERE order_id = ?`, [localOrderId], (err, items) => {
      if (err) {
        db.run("ROLLBACK");
        return res.status(500).json({ error: 'Failed to fetch items' });
      }

      // Decrement stock for each item
      const updateStock = db.prepare(`UPDATE variants SET stock = stock - ? WHERE id = ?`);
      items.forEach(item => {
        updateStock.run(item.quantity, item.variant_id);
      });
      updateStock.finalize();

      // Mark order as success
      db.run(`UPDATE orders SET status = 'success' WHERE id = ?`, [localOrderId], function(err) {
        if (err) {
          db.run("ROLLBACK");
          return res.status(500).json({ error: 'Failed to update order status' });
        }
        
        db.run("COMMIT", (commitErr) => {
          if (commitErr) return res.status(500).json({ error: 'Transaction commit failed' });
          res.json({ message: 'Order status updated to success and stock decremented' });
        });
      });
    });
  });
});

// 6. Get all orders for Admin Dashboard
app.get('/api/orders/all', (req, res) => {
  const query = `
    SELECT 
      o.id as order_id, o.total_amount, o.status, o.created_at,
      oi.quantity,
      v.name as variant_name,
      p.name as product_name
    FROM orders o
    LEFT JOIN order_items oi ON o.id = oi.order_id
    LEFT JOIN variants v ON oi.variant_id = v.id
    LEFT JOIN products p ON v.product_id = p.id
    ORDER BY o.created_at DESC
  `;

  db.all(query, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    const ordersMap = new Map();
    rows.forEach(row => {
      if (!ordersMap.has(row.order_id)) {
        ordersMap.set(row.order_id, {
          id: row.order_id,
          total_amount: row.total_amount,
          status: row.status,
          created_at: row.created_at,
          items: []
        });
      }
      if (row.product_name) {
        ordersMap.get(row.order_id).items.push({
          product_name: row.product_name,
          variant_name: row.variant_name,
          quantity: row.quantity
        });
      }
    });

    res.json(Array.from(ordersMap.values()));
  });
});

// 7. Update Stock manually from Admin Dashboard
app.put('/api/variants/:id/stock', (req, res) => {
  const variantId = req.params.id;
  const { stock } = req.body;
  
  if (stock === undefined || stock < 0) {
    return res.status(400).json({ error: 'Invalid stock value' });
  }

  db.run(`UPDATE variants SET stock = ? WHERE id = ?`, [stock, variantId], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Failed to update stock' });
    }
    res.json({ message: 'Stock updated successfully' });
  });
});

app.listen(port, () => {
  console.log(`Backend API running at http://localhost:${port}`);
});
