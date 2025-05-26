// ✅ Renderer.js Fully Fixed with Clear Chat & Duplication Patch
console.log("✅ Renderer.js loaded");
const { ipcRenderer } = require('electron');
const { fetchOrdersPaginated, sendWhatsAppMessage, fetchWhatsAppMessages } = require('./api');
const db = require('./db');

let selectedOrder = null;
let pollingInterval = null;
let currentPage = 1;
const ordersPerPage = 30;

function safeNavigate(href) {
  try {
    window.location.href = href;
  } catch (err) {
    console.error(`Navigation failed to ${href}:`, err);
    alert(`Failed to navigate to ${href}`);
  }
}

function setupNavigation() {
  const navLinks = document.querySelectorAll('.nav-link');
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const href = link.getAttribute('href');
      safeNavigate(href);
    });
  });
}

window.addEventListener('DOMContentLoaded', () => {
  try {
    setupNavigation();
    const page = document.title.toLowerCase();
    if (page.includes('dashboard')) initDashboard();
    else if (page.includes('logs')) initLogs();
    else if (page.includes('broadcast')) initBroadcast();
    else if (page.includes('templates')) initTemplates();
  } catch (err) {
    console.error('Initialization error:', err);
    alert('Something went wrong loading the page. Please restart the app.');
  }

  setInterval(async () => {
    try {
      await fetchAndDisplayOrders();
    } catch (err) {
      console.error('Auto-refresh error:', err);
    }
  }, 5 * 60 * 1000);
});

async function initDashboard() {
  try {
    await fetchAndDisplayOrders();
    setupOrderSelection();
    setupMessageSending();
    startMessagePolling();

    const loadMoreButton = document.getElementById('load-more-orders');
    if (loadMoreButton) {
      loadMoreButton.addEventListener('click', async () => {
        currentPage++;
        await fetchAndDisplayOrders();
      });
    }
  } catch (err) {
    console.error('Dashboard init error:', err);
    alert('Failed to initialize dashboard. Check console for details.');
  }
}

async function fetchAndDisplayOrders() {
  const orderList = document.getElementById('order-list');
  if (!orderList) return;

  try {
    const lastStoredId = await db.getLastStoredOrderId();
    const orders = await fetchOrdersPaginated(currentPage, ordersPerPage, lastStoredId);

    if (!orders.length) {
      orderList.innerHTML = `<div class="order-item">No orders found</div>`;
      return;
    }

    for (const order of orders) {
      if (!order.phone) continue;
      const orderItem = document.createElement('div');
      orderItem.className = 'order-item';
      orderItem.dataset.orderId = order.id;
      orderItem.innerHTML = `
        <div class="order-info">
          <div class="order-number">Order #${order.orderNumber || 'N/A'}</div>
          <div class="customer-name">${order.customerName || 'Unknown'}</div>
          <div class="phone-number">${order.phone}</div>
        </div>
      `;
      orderList.appendChild(orderItem);
    }

    await db.storeOrders(orders);
  } catch (error) {
    console.error('Order fetch error:', error);
    orderList.innerHTML = `<div class="order-item">Failed to load orders</div>`;
  }
}

function setupOrderSelection() {
  const orderItems = document.querySelectorAll('.order-item');
  orderItems.forEach(item => {
    item.addEventListener('click', async () => {
      orderItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      const orderId = parseInt(item.dataset.orderId);
      selectedOrder = await db.getOrder(orderId);
      const chatHeader = document.getElementById('chat-header');
      chatHeader.innerHTML = `
        <div class="chat-info">
          <div class="chat-name" id="chat-customer-name">${selectedOrder.customerName}</div>
          <div class="chat-phone" id="chat-phone-number">${selectedOrder.phone}</div>
          <button id="clear-chat-btn" class="clear-chat-button">🪑 Clear Chat</button>
        </div>
      `;

      try {
        await loadMessageHistory(selectedOrder.phone);

        const clearBtn = document.getElementById('clear-chat-btn');
        if (clearBtn) {
          clearBtn.onclick = async () => {
            if (confirm("Are you sure you want to clear this chat?")) {
              try {
                await db.deleteMessages(selectedOrder.phone);
                await loadMessageHistory(selectedOrder.phone);
              } catch (err) {
                console.error("Clear chat error:", err);
                alert("Failed to clear chat");
              }
            }
          };
        }

      } catch (err) {
        console.error('Order select error:', err);
        alert('Failed to load order details.');
      }
    });
  });
}

async function loadMessageHistory(phone) {
  const chatMessages = document.getElementById('chat-messages');
  if (!chatMessages) return;

  try {
    const messages = await db.getMessages(phone);
    chatMessages.innerHTML = '';
    messages.forEach(msg => {
      const messageDiv = document.createElement('div');
      messageDiv.className = `message ${msg.direction === 'sent' ? 'sent' : 'received'}`;
      messageDiv.innerHTML = `
        <div class="message-content">
          ${msg.message}
          ${msg.media_url ? `<br><a href="${msg.media_url}" target="_blank">View ${msg.media_type}</a>` : ''}
        </div>
        <div class="message-time">${new Date(msg.created_at).toLocaleString()}</div>
      `;
      chatMessages.appendChild(messageDiv);
    });
    chatMessages.scrollTop = chatMessages.scrollHeight;
  } catch (err) {
    console.error('Message load error:', err);
    chatMessages.innerHTML = 'Failed to load messages';
  }
}

function setupMessageSending() {
  const form = document.getElementById('message-form');
  const input = document.getElementById('message-input');
  const select = document.getElementById('template-select');
  const media = document.getElementById('media-input');

  if (!form || !input || !select || !media) return;

  db.getTemplates().then(t => {
    t.forEach(template => {
      const option = document.createElement('option');
      option.value = template.template_text;
      option.textContent = template.template_name;
      select.appendChild(option);
    });
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!selectedOrder) return alert('Select an order');

    const msg = input.value || select.value;
    const file = media.files[0];
    if (!msg && !file) return alert('Enter a message');

    try {
      const r = await sendWhatsAppMessage(selectedOrder.phone, msg, selectedOrder.id, file);
      const timestamp = new Date().toISOString();
      await db.storeMessage({
        order_id: selectedOrder.id,
        phone: selectedOrder.phone,
        message: msg,
        direction: 'sent',
        status: 'sent',
        created_at: timestamp,
        media_url: r.mediaUrl || null,
        media_type: r.mediaType || null
      });
      await loadMessageHistory(selectedOrder.phone);
      input.value = '';
      select.value = '';
      media.value = '';
    } catch (e) {
      console.error('Send error:', e);
      alert('Send failed: ' + e.message);
    }
  });
}

function startMessagePolling() {
  if (pollingInterval) clearInterval(pollingInterval);

  pollingInterval = setInterval(async () => {
    if (selectedOrder) {
      try {
        // ❌ No more fetching from API
        // ✅ Just reload messages from local DB, updated via webhook
        await loadMessageHistory(selectedOrder.phone);
      } catch (e) {
        console.error('Polling refresh error:', e);
      }
    }
  }, 30000); // 30 seconds
}


async function initLogs() {
  const logsTableBody = document.getElementById('logs-table-body');
  if (!logsTableBody) return;

  try {
    const messages = await db.getAllMessages();
    logsTableBody.innerHTML = '';
    messages.forEach(msg => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${msg.order_id}</td>
        <td>${msg.phone}</td>
        <td>${msg.message}</td>
        <td>${msg.direction}</td>
        <td>${msg.status}</td>
        <td>${msg.media_url ? `<a href="${msg.media_url}" target="_blank">${msg.media_type}</a>` : '-'}</td>
        <td>${new Date(msg.created_at).toLocaleString()}</td>
      `;
      logsTableBody.appendChild(row);
    });
  } catch (err) {
    console.error('Logs init error:', err);
    logsTableBody.innerHTML = '<tr><td colspan="7">Failed to load logs</td></tr>';
  }
}

function initBroadcast() {
  const form = document.getElementById('broadcast-form');
  if (!form) return;

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const msg = document.getElementById('broadcast-message')?.value;
    if (!msg) return alert('Enter broadcast message');

    try {
      const orders = await db.getAllOrders();
      for (const order of orders) {
        if (order.phone) {
          try {
            const r = await sendWhatsAppMessage(order.phone, msg, order.id);
            await db.storeMessage({
              order_id: order.id,
              phone: order.phone,
              message: msg,
              direction: 'sent',
              status: 'sent',
              created_at: new Date().toISOString(),
              media_url: r.mediaUrl || null,
              media_type: r.mediaType || null
            });
          } catch (e) {
            console.error(`Broadcast error to ${order.phone}:`, e);
          }
        }
      }
      alert('Broadcast sent!');
    } catch (err) {
      console.error('Broadcast error:', err);
      alert('Broadcast failed: ' + err.message);
    }
  });
}

async function initTemplates() {
  const form = document.getElementById('template-form');
  const table = document.getElementById('templates-table-body');
  if (!form || !table) return;

  async function loadTemplates() {
    try {
      const templates = await db.getTemplates();
      table.innerHTML = '';
      templates.forEach(template => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${template.template_name}</td>
          <td>${template.template_text}</td>
          <td><button onclick="deleteTemplate(${template.id})">Delete</button></td>
        `;
        table.appendChild(row);
      });
    } catch (err) {
      console.error('Template load error:', err);
      table.innerHTML = '<tr><td colspan="3">Failed to load templates</td></tr>';
    }
  }

  await loadTemplates();

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const name = document.getElementById('template-name')?.value;
    const text = document.getElementById('template-text')?.value;
    if (!name || !text) return alert('Enter template name and text');

    try {
      await db.addTemplate(name, text);
      await loadTemplates();
      form.reset();
    } catch (err) {
      console.error('Template add error:', err);
      alert('Failed to add template: ' + err.message);
    }
  });

  window.deleteTemplate = async (id) => {
    try {
      await db.deleteTemplate(id);
      await loadTemplates();
    } catch (err) {
      console.error('Template delete error:', err);
      alert('Failed to delete template: ' + err.message);
    }
  };
}