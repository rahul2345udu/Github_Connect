# Github_Connect

A desktop application built with Electron and Node.js to integrate with WhatsApp Cloud API.  
This tool is designed for Mac OS to send, receive, and manage WhatsApp messages using Meta’s Cloud API.

---

## 🧩 Features

- WhatsApp Cloud API integration
- Auto message receiving via Webhook
- Broadcast & template message sender
- User-friendly HTML frontend with Electron
- SQLite or file-based DB storage
- Works on Mac OS (M1/M2/M3 and Intel)

---

## 💻 Requirements

- macOS (Ventura / Monterey / Big Sur or later)
- Node.js ≥ 16.x
- npm (comes with Node)
- WhatsApp Business API token & phone number ID
- Meta App with webhook set

---

## 🚀 Installation & Run (Development Mode)

```bash
# 1. Clone this repository
git clone https://github.com/rahul2345udu/Github_Connect.git

# 2. Go into the directory
cd Github_Connect

# 3. Install dependencies
npm install

# 4. Start the Electron app
npm run app

# 5. Start the webhook server (in another terminal)
npm run webhook
