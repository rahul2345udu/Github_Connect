const db = require('./db');

const manualOrders = [
  {
    phone: '918013508258',
    customerName: 'Test Customer 1',
    orderNumber: 'M-1001',
    date: new Date().toISOString()
  },
  {
    phone: '918272953014',
    customerName: 'Test Customer 2',
    orderNumber: 'M-1002',
    date: new Date().toISOString()
  }
];

(async () => {
  try {
    for (const order of manualOrders) {
      await db.storeOrders([order]);
      console.log(`✅ Inserted: ${order.customerName} (${order.phone})`);
    }
    console.log('✅ All manual test orders inserted successfully.');
  } catch (err) {
    console.error('❌ Error inserting manual orders:', err.message);
  }
})();
