import 'dotenv/config';
import express from 'express';
import { MongoClient } from 'mongodb';

const required = ['MONGODB_URI', 'MONGODB_DATABASE', 'ADMIN_USERNAME', 'ADMIN_PASSWORD'];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) throw new Error(`Missing environment variables: ${missing.join(', ')}`);

const app = express();
const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
const db = client.db(process.env.MONGODB_DATABASE);

function adminOnly(req, res, next) {
  const header = req.headers.authorization || '';
  const [kind, encoded] = header.split(' ');
  const [user, pass] = kind === 'Basic' && encoded
    ? Buffer.from(encoded, 'base64').toString().split(':')
    : [];
  if (user === process.env.ADMIN_USERNAME && pass === process.env.ADMIN_PASSWORD) return next();
  res.set('WWW-Authenticate', 'Basic realm="GlowCare admin"');
  return res.status(401).send('Authentication required');
}

app.use(adminOnly);
app.use(express.static('public'));

app.get('/api/dashboard', async (_req, res, next) => {
  try {
    const [customerCount, orderCount, cartCount, recentMessages, recentCustomers] = await Promise.all([
      db.collection('customers').countDocuments(),
      db.collection('orders').countDocuments(),
      db.collection('cart').countDocuments(),
      db.collection('conversations').find({}, { projection: { _id: 0 } }).sort({ receivedAt: -1, createdAt: -1 }).limit(20).toArray(),
      db.collection('customers').find({}, { projection: { _id: 0 } }).sort({ lastMessageAt: -1, updatedAt: -1 }).limit(20).toArray(),
    ]);
    res.json({ customerCount, orderCount, cartCount, recentMessages, recentCustomers });
  } catch (error) { next(error); }
});

app.use((error, _req, res, _next) => res.status(500).json({ error: 'Unable to load dashboard data.' }));
app.listen(Number(process.env.PORT || 3000), () => console.log(`GlowCare dashboard: http://localhost:${process.env.PORT || 3000}`));
