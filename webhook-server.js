// ✅ Required modules
const express = require('express');
const bodyParser = require('body-parser');
const db = require('./src/db'); // Make sure the path is correct

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

          // ✅ Handle normal user messages
          if (field === 'messages' && change.value?.messages?.length) {
            for (const message of change.value.messages) {
              const phone = message.from;
              const text = message.text?.body || '';
              const mediaUrl =
                message.image?.link || message.video?.link || message.document?.link || null;
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
                const orderData = {
                  id: null,
                  phone,
                  customerName: "Unknown",
                  orderNumber: "N/A",
                  date: new Date().toISOString().split('T')[0]
                };
                await db.storeOrders([orderData]);
                console.log(`📦 Dummy order created for ${phone}`);
                order = await db.getOrderByPhone(phone);
              }
              const orderId = order.id;

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

          // ✅ Handle message status updates (optional)
          if (field === 'message_status') {
            console.log('📮 Received message_status event');
          }

          // ✅ Handle message echoes (optional)
          if (field === 'message_echoes') {
            console.log('📨 Received message_echoes event');
          }
        }
      }
    }

    return res.sendStatus(200); // Always respond to webhook
  } catch (err) {
    console.error("❌ Webhook error:", err.message);
    return res.sendStatus(500);
  }
});

// ✅ Test route for browser
app.get("/", (req, res) => {
  res.send("✅ WhatsApp Webhook is Live!");
});

// ✅ Start the server
app.listen(PORT, () => {
  console.log(`🚀 Webhook server running at http://localhost:${PORT}`);
});
