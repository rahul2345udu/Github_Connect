// ✅ Required modules
const express = require('express');
const bodyParser = require('body-parser');
const db = require('./src/db'); // Adjust path if needed

const app = express();
const PORT = process.env.PORT || 10000;
const VERIFY_TOKEN = process.env.WA_VERIFY_TOKEN || "wa_verify_2rXv73dU91";

app.use(bodyParser.json());

// ✅ Webhook Verification (GET)
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log("✅ Webhook verified");
    return res.status(200).send(challenge);
  } else {
    console.warn("❌ Webhook verification failed");
    return res.sendStatus(403);
  }
});

// ✅ Webhook Receiver (POST)
app.post('/webhook', async (req, res) => {
  try {
    const body = req.body;
    console.log("📩 Incoming webhook:", JSON.stringify(body, null, 2));

    if (body.object === 'whatsapp_business_account') {
      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          const field = change.field;

          // ✅ Handle messages
          if (field === 'messages' && change.value?.messages?.length) {
            for (const message of change.value.messages) {
              const phone = message.from;
              const text = message.text?.body || '';
              const mediaUrl = message.image?.link || message.video?.link || message.document?.link || null;
              const mediaType = message.image
                ? 'image'
                : message.video
                ? 'video'
                : message.document
                ? 'document'
                : null;

              // ✅ Ensure order exists
              let order = await db.getOrderByPhone(phone);
              if (!order) {
                const dummyOrder = {
                  id: null,
                  phone,
                  customerName: "Unknown",
                  orderNumber: "N/A",
                  date: new Date().toISOString().split('T')[0]
                };
                await db.storeOrders([dummyOrder]);
                console.log(`📦 Created placeholder order for ${phone}`);
                order = await db.getOrderByPhone(phone);
              }

              const orderId = order?.id || null;

              // ✅ Save the message
              await db.storeMessage({
                order_id: orderId,
                phone,
                message: text,
                direction: 'received',
                status: 'received',
                media_url: mediaUrl,
                media_type: mediaType,
                created_at: new Date().toISOString()
              });

              console.log(`✅ Message saved from ${phone}`);
            }
          }

          // ✅ Optional: status events
          if (field === 'message_status') {
            console.log('📮 Received message_status event');
          }

          // ✅ Optional: echoes
          if (field === 'message_echoes') {
            console.log('📨 Received message_echoes event');
          }
        }
      }
    }

    res.sendStatus(200); // Respond to Meta
  } catch (err) {
    console.error("❌ Webhook error:", err);
    res.sendStatus(500);
  }
});

// ✅ Test route (GET /)
app.get("/", (req, res) => {
  res.send("✅ WhatsApp Webhook is Live!");
});

// ✅ Start server
app.listen(PORT, () => {
  console.log(`🚀 Webhook server running at http://localhost:${PORT}`);
  console.log(`🌐 Public URL (Render): https://whatsapp-webhook-q07u.onrender.com/webhook`);
});
