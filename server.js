import 'dotenv/config';
import express from 'express';
import { MongoClient } from 'mongodb';
import { fileURLToPath } from 'node:url';

const required = ['MONGODB_URI', 'MONGODB_DATABASE', 'ADMIN_USERNAME', 'ADMIN_PASSWORD'];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) throw new Error(`Missing environment variables: ${missing.join(', ')}`);

const app = express();
const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
const db = client.db(process.env.MONGODB_DATABASE);
const indexFile = fileURLToPath(new URL('./index.html', import.meta.url));
const appFile = fileURLToPath(new URL('./app.js', import.meta.url));
const stylesFile = fileURLToPath(new URL('./styles.css', import.meta.url));

function adminOnly(req, res, next) {
  const header = req.headers.authorization || '';
  const [kind, encoded] = header.split(' ');
  const [user, pass] = kind === 'Basic' && encoded
    ? Buffer.from(encoded, 'base64').toString().split(':')
    : [];
  if (user === process.env.ADMIN_USERNAME && pass === process.env.ADMIN_PASSWORD) return next();
  res.set('WWW-Authenticate', 'Basic realm="S5 Nutrition admin"');
  return res.status(401).send('Authentication required');
}

app.use(adminOnly);
app.get('/', (_req, res) => res.sendFile(indexFile));
app.get('/app.js', (_req, res) => res.sendFile(appFile));
app.get('/styles.css', (_req, res) => res.sendFile(stylesFile));

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
    res.json({ messages });
  } catch (error) { next(error); }
});

// Server-Sent Events (SSE) for Real-Time Updates
const clients = new Set();

app.get('/api/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });
  
  clients.add(res);
  res.write('data: {"type": "connected"}\n\n');

  req.on('close', () => {
    clients.delete(res);
  });
});

function broadcastUpdate(collection, operation) {
  const data = JSON.stringify({ type: 'update', collection, operation });
  for (const client of clients) {
    client.write(`data: ${data}\n\n`);
  }
}

try {
  ['customers', 'conversations', 'orders', 'cart'].forEach(coll => {
    const changeStream = db.collection(coll).watch();
    changeStream.on('change', (change) => {
      broadcastUpdate(coll, change.operationType);
    });
    changeStream.on('error', (err) => {
      console.error(`Change stream error on ${coll}:`, err.message);
    });
  });
  console.log('MongoDB Change Streams initialized.');
} catch (error) {
  console.error('Could not initialize Change Streams. Ensure MongoDB is a Replica Set:', error.message);
}

app.use((error, _req, res, _next) => res.status(500).json({ error: 'Unable to load dashboard data.' }));
app.listen(Number(process.env.PORT || 3000), () => console.log(`S5 Nutrition dashboard: http://localhost:${process.env.PORT || 3000}`));
