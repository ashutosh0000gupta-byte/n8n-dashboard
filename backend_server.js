import 'dotenv/config';
import express from 'express';
import { MongoClient } from 'mongodb';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { createServer } from 'node:http';

const required = ['MONGODB_URI', 'MONGODB_DATABASE', 'ADMIN_USERNAME', 'ADMIN_PASSWORD'];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) throw new Error(`Missing environment variables: ${missing.join(', ')}`);

const app = express();
const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
const db = client.db(process.env.MONGODB_DATABASE);
const server = createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
const indexFile = fileURLToPath(new URL('./frontend_dashboard.html', import.meta.url));
const appFile = fileURLToPath(new URL('./frontend_dashboard.js', import.meta.url));
const stylesFile = fileURLToPath(new URL('./frontend_styles.css', import.meta.url));

function adminOnly(req, res, next) {
  let encoded = '';
  const header = req.headers.authorization || '';
  if (header.startsWith('Basic ')) {
    encoded = header.split(' ')[1];
  } else if (req.query.auth) {
    encoded = req.query.auth;
  }

  const [user, pass] = encoded
    ? Buffer.from(encoded, 'base64').toString().split(':')
    : [];

  if (user === process.env.ADMIN_USERNAME && pass === process.env.ADMIN_PASSWORD) return next();
  return res.status(401).json({ error: 'Authentication required' });
}

app.use(express.json());
app.get('/', (_req, res) => res.sendFile(indexFile));
app.get('/frontend_dashboard.js', (_req, res) => res.sendFile(appFile));
app.get('/frontend_styles.css', (_req, res) => res.sendFile(stylesFile));

app.use('/api', adminOnly);

app.get('/api/dashboard', async (_req, res, next) => {
  try {
    const activeSince = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [customerCount, orderCount, cartCount, productCount, activeChatCount, recentMessages, recentCustomers, recentOrders] = await Promise.all([
      db.collection('customers').countDocuments(),
      db.collection('orders').countDocuments(),
      db.collection('cart').countDocuments(),
      db.collection('product_info').countDocuments(),
      db.collection('customers').countDocuments({ $or: [{ lastMessageAt: { $gte: activeSince } }, { updatedAt: { $gte: activeSince } }] }),
      db.collection('conversations').find({}, { projection: { _id: 0 } }).sort({ receivedAt: -1, createdAt: -1 }).limit(20).toArray(),
      db.collection('customers').find({}, { projection: { _id: 0 } }).sort({ lastMessageAt: -1, updatedAt: -1 }).limit(50).toArray(),
      db.collection('orders').find({}, { projection: { _id: 0 } }).sort({ createdAt: -1 }).limit(5).toArray(),
    ]);
    res.json({ customerCount, orderCount, cartCount, productCount, activeChatCount, recentMessages, recentCustomers, recentOrders });
  } catch (error) { next(error); }
});

app.get('/api/chats/:waId', async (req, res, next) => {
  try {
    const messages = await db.collection('conversations')
      .find({ wa_id: req.params.waId }, { projection: { _id: 0 } })
      .sort({ receivedAt: 1, createdAt: 1 })
      .limit(100)
      .toArray();
    const customer = await db.collection('customers').findOne({ wa_id: req.params.waId });
    res.json({ messages, customer });
  } catch (error) { next(error); }
});

app.post('/api/chats/:waId/mode', async (req, res, next) => {
  try {
    const { mode } = req.body;
    if (mode !== 'ai' && mode !== 'human') {
      return res.status(400).json({ error: 'Invalid mode. Must be "ai" or "human".' });
    }
    await db.collection('customers').updateOne(
      { wa_id: req.params.waId },
      { $set: { mode, updatedAt: new Date().toISOString() } }
    );
    res.json({ success: true, mode });
  } catch (error) { next(error); }
});

app.post('/api/messages/send', async (req, res, next) => {
  try {
    const { waId, text } = req.body;
    if (!waId || !text) return res.status(400).json({ error: 'Missing waId or text.' });

    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    if (!phoneId || !token) {
      return res.status(500).json({ error: 'WhatsApp credentials not configured on backend.' });
    }

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: waId,
      type: 'text',
      text: { preview_url: false, body: text }
    };

    const response = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('WhatsApp API Error:', data);
      return res.status(500).json({ error: 'Failed to send WhatsApp message', details: data });
    }

    const now = new Date().toISOString();
    await db.collection('conversations').insertOne({
      wa_id: waId,
      text: text,
      direction: 'outbound',
      type: 'human',
      receivedAt: now,
      createdAt: now,
      message_id: data.messages?.[0]?.id || `outbound-${Date.now()}`
    });

    await db.collection('customers').updateOne(
      { wa_id: waId },
      { $set: { lastMessageAt: now, updatedAt: now } }
    );

    res.json({ success: true, message_id: data.messages?.[0]?.id });
  } catch (error) { next(error); }
});

// Socket.IO Server Setup (Replaces SSE & Change Streams)
io.on('connection', (socket) => {
  console.log('Dashboard connected via Socket.IO:', socket.id);
  socket.emit('update', { type: 'connected' });
});

// Polling MongoDB for changes to emit via Socket.IO
let lastCheckTime = new Date();
setInterval(async () => {
  try {
    const recentMessages = await db.collection('messages').find({ timestamp: { $gte: lastCheckTime.toISOString() } }).limit(1).toArray();
    const recentOrders = await db.collection('orders').find({ created_at: { $gte: lastCheckTime.toISOString() } }).limit(1).toArray();
    const recentAnalytics = await db.collection('analytics').find({ timestamp: { $gte: lastCheckTime.toISOString() } }).limit(1).toArray();
    
    if (recentMessages.length > 0) io.emit('update', { collection: 'messages', operation: 'insert' });
    if (recentOrders.length > 0) io.emit('update', { collection: 'orders', operation: 'insert' });
    if (recentAnalytics.length > 0) io.emit('update', { collection: 'analytics', operation: 'insert' });

    if (recentMessages.length > 0 || recentOrders.length > 0 || recentAnalytics.length > 0) {
      lastCheckTime = new Date();
    }
  } catch (error) {
    console.error('Polling error:', error.message);
  }
}, 2000);

app.use((error, _req, res, _next) => res.status(500).json({ error: 'Unable to load dashboard data.' }));
server.listen(Number(process.env.PORT || 3000), () => console.log(`S5 Nutrition dashboard: http://localhost:${process.env.PORT || 3000}`));
