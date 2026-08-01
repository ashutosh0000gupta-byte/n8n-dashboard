const $ = (selector) => document.querySelector(selector);
const safe = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
const time = (value) => value ? new Date(value).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }) : '—';
const date = (value) => value ? new Date(value).toLocaleDateString([], { day:'2-digit', month:'short' }) : '—';
async function load() { try { const response = await fetch('./api/dashboard'); if (!response.ok) throw new Error(); const data = await response.json(); const chats = data.recentCustomers || []; $('#conversations').textContent = data.recentMessages?.length ?? 0; $('#customers').textContent = data.customerCount ?? 0; $('#orders').textContent = data.orderCount ?? 0; $('#active-chats').textContent = data.activeChatCount ?? 0; $('#products').textContent = '—'; $('#nav-chats').textContent = data.activeChatCount ?? 0; $('#footer-orders').textContent = data.orderCount ?? 0; $('#footer-chats').textContent = data.activeChatCount ?? 0; $('#sync-time').textContent = new Date().toLocaleString(); $('#live-conversations').innerHTML = chats.length ? chats.slice(0,5).map((chat) => `<article class="live-row" data-waid="${safe(chat.wa_id)}"><span class="mini-avatar">${safe((chat.profileName || '?')[0])}</span><div><b>${safe(chat.profileName || 'Customer')}</b><p>${safe(chat.lastMessage || 'No message preview')}</p></div><small>${time(chat.lastMessageAt || chat.updatedAt)}</small></article>`).join('') : '<p class="empty">No active conversations yet.</p>'; const orders = data.recentOrders || []; $('#orders-table').innerHTML = orders.length ? orders.slice(0,5).map((order, index) => `<tr><td>${safe(order.orderId || `ORD${String(index + 1).padStart(4,'0')}`)}</td><td>${safe(order.customerName || order.wa_id || 'Customer')}</td><td>${safe(order.productName || order.productId || '—')}</td><td>${safe(order.qty || 1)}</td><td>₹${safe(order.amount || order.total || order.price || '—')}</td><td><span class="badge">${safe(order.status || 'Processing')}</span></td><td>${date(order.createdAt)}</td></tr>`).join('') : '<tr><td colspan="7" class="empty">No orders to show yet.</td></tr>'; } catch { $('#live-conversations').innerHTML = '<p class="empty">Could not load dashboard. Check the Node server and MongoDB connection.</p>'; } }
$('#refresh').addEventListener('click', load); 

$('#live-conversations').addEventListener('click', async (e) => {
  const row = e.target.closest('.live-row');
  if (!row) return;
  const waId = row.dataset.waid;
  if (!waId || waId === 'undefined') return;
  
  $('#chat-modal').style.display = 'flex';
  $('#chat-modal-title').textContent = 'Loading...';
  $('#chat-messages').innerHTML = '<div class="loader">Loading messages...</div>';
  
  try {
    const res = await fetch(`/api/chats/${waId}`);
    const data = await res.json();
    $('#chat-modal-title').textContent = `Chat with ${row.querySelector('b').textContent}`;
    
    if (data.messages && data.messages.length > 0) {
      $('#chat-messages').innerHTML = data.messages.map(m => {
        const isBot = m.type === 'bot' || m.sender === 'bot';
        return `<div class="msg ${isBot ? 'msg-bot' : 'msg-user'}"><p>${safe(m.text || m.body || m.message || '—')}</p><small>${time(m.receivedAt || m.createdAt)}</small></div>`;
      }).join('');
      const msgs = $('#chat-messages');
      msgs.scrollTop = msgs.scrollHeight;
    } else {
      $('#chat-messages').innerHTML = '<p class="empty">No messages found.</p>';
    }
  } catch (err) {
    $('#chat-messages').innerHTML = '<p class="empty">Error loading messages.</p>';
  }
});

$('#close-chat-modal').addEventListener('click', () => {
  $('#chat-modal').style.display = 'none';
});

load();
