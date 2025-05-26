const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'whatsapp.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database.');
  }
});

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT NOT NULL,
      customerName TEXT NOT NULL,
      orderNumber TEXT NOT NULL,
      date TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      phone TEXT NOT NULL,
      message TEXT NOT NULL,
      direction TEXT NOT NULL,
      status TEXT NOT NULL,
      media_url TEXT,
      media_type TEXT,
      created_at TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_name TEXT NOT NULL,
      template_text TEXT NOT NULL
    )
  `);
});

async function storeOrders(orders) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO orders (id, phone, customerName, orderNumber, date)
        VALUES (?, ?, ?, ?, ?)
      `);

      for (const order of orders) {
        stmt.run(
          order.id || null,
          order.phone,
          order.customerName,
          order.orderNumber,
          order.date,
          (err) => {
            if (err) {
              console.error('Error storing order:', err.message);
            }
          }
        );
      }

      stmt.finalize((err) => {
        if (err) {
          reject(new Error('Failed to finalize order storage: ' + err.message));
        } else {
          resolve();
        }
      });
    });
  });
}

async function getOrder(orderId) {
  return new Promise((resolve, reject) => {
    db.get(`
      SELECT * FROM orders WHERE id = ?
    `, [orderId], (err, row) => {
      if (err) {
        console.error('Error fetching order:', err.message);
        reject(new Error('Failed to fetch order: ' + err.message));
      } else {
        resolve(row);
      }
    });
  });
}

async function getOrderByPhone(phone) {
  return new Promise((resolve, reject) => {
    db.get(`
      SELECT * FROM orders WHERE phone = ?
    `, [phone], (err, row) => {
      if (err) {
        console.error('Error fetching order by phone:', err.message);
        reject(new Error('Failed to fetch order by phone: ' + err.message));
      } else {
        resolve(row);
      }
    });
  });
}

async function getAllOrders() {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM orders`, [], (err, rows) => {
      if (err) {
        console.error('Error fetching all orders:', err.message);
        reject(new Error('Failed to fetch all orders: ' + err.message));
      } else {
        resolve(rows);
      }
    });
  });
}

async function storeMessage(message) {
  return new Promise((resolve, reject) => {
    db.run(`
      INSERT INTO messages (order_id, phone, message, direction, status, media_url, media_type, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      message.order_id,
      message.phone,
      message.message,
      message.direction,
      message.status,
      message.media_url,
      message.media_type,
      message.created_at
    ], (err) => {
      if (err) {
        console.error('Error storing message:', err.message);
        reject(new Error('Failed to store message: ' + err.message));
      } else {
        resolve();
      }
    });
  });
}

async function messageExists(phone, text, createdAt) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT id FROM messages WHERE phone = ? AND message = ? AND created_at = ?`,
      [phone, text],
      (err, row) => {
        if (err) return reject(err);
        resolve(!!row);
      }
    );
  });
}

async function getMessages(phone) {
  return new Promise((resolve, reject) => {
    db.all(`
      SELECT * FROM messages WHERE phone = ? ORDER BY created_at ASC
    `, [phone], (err, rows) => {
      if (err) {
        console.error('Error fetching messages:', err.message);
        reject(new Error('Failed to fetch messages: ' + err.message));
      } else {
        resolve(rows);
      }
    });
  });
}

async function getAllMessages() {
  return new Promise((resolve, reject) => {
    db.all(`
      SELECT * FROM messages ORDER BY created_at DESC
    `, [], (err, rows) => {
      if (err) {
        console.error('Error fetching all messages:', err.message);
        reject(new Error('Failed to fetch all messages: ' + err.message));
      } else {
        resolve(rows);
      }
    });
  });
}

async function addTemplate(templateName, templateText) {
  return new Promise((resolve, reject) => {
    db.run(`
      INSERT INTO templates (template_name, template_text)
      VALUES (?, ?)
    `, [templateName, templateText], (err) => {
      if (err) {
        console.error('Error adding template:', err.message);
        reject(new Error('Failed to add template: ' + err.message));
      } else {
        resolve();
      }
    });
  });
}

async function getTemplates() {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM templates`, [], (err, rows) => {
      if (err) {
        console.error('Error fetching templates:', err.message);
        reject(new Error('Failed to fetch templates: ' + err.message));
      } else {
        resolve(rows);
      }
    });
  });
}

async function deleteTemplate(id) {
  return new Promise((resolve, reject) => {
    db.run(`DELETE FROM templates WHERE id = ?`, [id], (err) => {
      if (err) {
        console.error('Error deleting template:', err.message);
        reject(new Error('Failed to delete template: ' + err.message));
      } else {
        resolve();
      }
    });
  });
}

async function deleteMessages(phone) {
  return new Promise((resolve, reject) => {
    db.run(`DELETE FROM messages WHERE phone = ?`, [phone], (err) => {
      if (err) {
        console.error('Error deleting messages:', err.message);
        reject(new Error('Failed to delete messages: ' + err.message));
      } else {
        resolve();
      }
    });
  });
}

async function getLastStoredOrderId() {
  return new Promise((resolve, reject) => {
    db.get(`SELECT MAX(id) as maxId FROM orders`, [], (err, row) => {
      if (err) {
        console.error('Error fetching last order ID:', err.message);
        reject(new Error('Failed to fetch last order ID: ' + err.message));
      } else {
        resolve(row?.maxId || 0);
      }
    });
  });
}

process.on('exit', () => {
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err.message);
    } else {
      console.log('Database connection closed.');
    }
  });
});

module.exports = {
  storeOrders,
  getOrder,
  getOrderByPhone,
  getAllOrders,
  storeMessage,
  getMessages,
  getAllMessages,
  addTemplate,
  getTemplates,
  deleteTemplate,
  getLastStoredOrderId,
  messageExists,
  deleteMessages  // ✅ Exported here for Clear Chat support
};
