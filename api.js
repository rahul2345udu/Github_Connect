const axios = require('axios');
const Store = require('electron-store');
const store = new Store();

// Manually setting configuration values
store.set('wa_access_token', 'EAAIHSkUmZAG4BOyJXIqZAgpQaRpJIBRWNCAeZCPZBkQH8vGj1g9RH00mRPZAC6caP1n5IEK8YA213lzD6ZCIJHQpCZB0DNcRbY3RDlYtC7jZBw4AE4d8T9Ge4OHqHmLoBenr4eoyrAQs0UzsXqDhu0ZAJGKAOkZAMCIEVoHxPfU2YmIRnLiBRZAd1HcfecIYZCC8tPSAYwZDZD');
store.set('wa_phone_id', '443131372225762');
store.set('wa_retry_attempts', 2);
store.set('wa_template_name', 'Hello_World');
store.set('wa_verify_token', 'wa_verify_2rXv73dU91');

store.set('wp_consumer_key', 'ck_df13e1d596f1e3a207b3b0722909b69c6cfdc6bf');
store.set('wp_consumer_secret', 'cs_9fbffac5fda6a29b7ebe3385bedd30519aa81231');
store.set('wp_base_url', 'https://jhumadresses.in');

async function fetchOrdersPaginated(page = 1, perPage = 30, lastStoredId = 0) {
  let allOrders = [];
  try {
    const params = {
      consumer_key: store.get('wp_consumer_key'),
      consumer_secret: store.get('wp_consumer_secret'),
      per_page: perPage,
      page: page,
      after_id: lastStoredId > 0 ? lastStoredId : undefined,
    };

    const response = await axios.get(`${store.get('wp_base_url')}/wp-json/wc/v3/orders`, {
      params,
      timeout: 10000
    });
    const pageOrders = response.data;

    if (!pageOrders.length) return allOrders;

    const cleaned = pageOrders.map(order => {
      const phone = order?.billing?.phone?.replace(/[^0-9]/g, '') || '';
      const name = `${order?.billing?.first_name || ''} ${order?.billing?.last_name || ''}`.trim();
      return {
        id: order.id,
        phone,
        customerName: name || 'Unknown',
        orderNumber: order.number,
        date: order.date_created
      };
    });

    allOrders.push(...cleaned);
    return allOrders;
  } catch (error) {
    console.error('❌ WooCommerce order fetch error:', error.message);
    throw new Error('Failed to fetch orders: ' + error.message);
  }
}

async function sendWhatsAppMessage(phone, message, orderId, mediaFile = null, mediaUrl = null) {
  const accessToken = store.get('wa_access_token');
  const phoneId = store.get('wa_phone_id');
  const retryAttempts = store.get('wa_retry_attempts', 3);

  if (!accessToken || !phoneId) {
    throw new Error('WhatsApp API credentials not configured.');
  }

  const url = `https://graph.facebook.com/v18.0/${phoneId}/messages`;
  let payload = {
    messaging_product: 'whatsapp',
    to: phone
  };

  let mediaType = null;
  let storedMediaUrl = null;

  if (mediaFile) {
    throw new Error('Media upload not implemented. Use mediaUrl instead.');
  } else if (mediaUrl) {
    if (mediaUrl.includes('image')) {
      mediaType = 'image';
    } else if (mediaUrl.includes('video')) {
      mediaType = 'video';
    } else {
      mediaType = 'document';
    }
    payload.type = mediaType;
    payload[mediaType] = {
      link: mediaUrl,
      caption: message || null
    };
    storedMediaUrl = mediaUrl;
  } else {
    payload.type = 'text';
    payload.text = { body: message };
  }

  const config = {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    timeout: 30000
  };

  let attempt = 0;
  let success = false;
  let errorMessage = '';

  while (attempt < retryAttempts && !success) {
    try {
      const response = await axios.post(url, payload, config);
      if (response.status === 200) {
        success = true;
        return { success: true, mediaUrl: storedMediaUrl, mediaType };
      }
    } catch (error) {
      attempt++;
      errorMessage = error.response ? error.response.data : error.message;
      console.error(`Attempt ${attempt} failed: ${errorMessage}`);
      if (attempt < retryAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  throw new Error(`Failed to send message after ${retryAttempts} attempts: ${errorMessage}`);
}

async function fetchWhatsAppMessages(phone) {
  const db = require('./db');
  try {
    const messages = await db.getMessages(phone);
    return messages.map(msg => ({
      text: msg.message,
      mediaUrl: msg.media_url,
      mediaType: msg.media_type
    }));
  } catch (error) {
    console.error('❌ Error fetching WhatsApp messages:', error.message);
    throw new Error('Failed to fetch messages: ' + error.message);
  }
}

module.exports = {
  fetchOrdersPaginated,
  sendWhatsAppMessage,
  fetchWhatsAppMessages
};