const $ = (selector) => document.querySelector(selector);
const safe = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
const time = (value) => value ? new Date(value).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }) : '—';
const date = (value) => value ? new Date(value).toLocaleDateString([], { day:'2-digit', month:'short' }) : '—';

// -- Auth & Login --
let authToken = localStorage.getItem('s5_admin_token') || '';
let socket = null;

const apiFetch = async (url, options = {}) => {
  options.headers = { ...options.headers, 'Authorization': `Basic ${authToken}` };
  const res = await fetch(url, options);
  if (res.status === 401) {
    showLogin();
    throw new Error('Unauthorized');
  }
  return res;
};

function showLogin() {
  $('#login-overlay').style.display = 'flex';
  if (socket) socket.disconnect();
}

$('#login-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const u = $('#username').value;
  const p = $('#password').value;
  authToken = btoa(`${u}:${p}`);
  try {
    $('#login-error').textContent = '';
    const res = await fetch('/api/dashboard', { headers: { 'Authorization': `Basic ${authToken}` } });
    if (res.ok) {
      localStorage.setItem('s5_admin_token', authToken);
      $('#login-overlay').style.display = 'none';
      initApp();
    } else {
      $('#login-error').textContent = 'Invalid credentials';
    }
  } catch (err) {
    $('#login-error').textContent = 'Connection error';
  }
});

// -- Theme Toggle --
const initTheme = () => {
  const savedTheme = localStorage.getItem('s5_theme');
  if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.body.classList.add('dark-mode');
  }
};
$('#theme-toggle')?.addEventListener('click', () => {
  document.body.classList.toggle('dark-mode');
  const isDark = document.body.classList.contains('dark-mode');
  localStorage.setItem('s5_theme', isDark ? 'dark' : 'light');
});
initTheme();

// -- Dashboard Logic --
async function load() { 
  try { 
    const response = await apiFetch('/api/dashboard'); 
    const data = await response.json(); 
    const chats = data.recentCustomers || []; 
    $('#conversations').textContent = data.recentMessages?.length ?? 0; 
    $('#customers').textContent = data.customerCount ?? 0; 
    $('#orders').textContent = data.orderCount ?? 0; 
    $('#active-chats').textContent = data.activeChatCount ?? 0; 
    $('#products').textContent = '—'; 
    $('#nav-chats').textContent = data.activeChatCount ?? 0; 
    $('#footer-orders').textContent = data.orderCount ?? 0; 
    $('#footer-chats').textContent = data.activeChatCount ?? 0; 
    $('#sync-time').textContent = new Date().toLocaleString(); 
    $('#live-conversations').innerHTML = chats.length ? chats.slice(0,5).map((chat) => `<article class="live-row" data-waid="${safe(chat.wa_id)}"><span class="mini-avatar">${safe((chat.profileName || '?')[0])}</span><div><b>${safe(chat.profileName || 'Customer')}</b><p>${safe(chat.lastMessage || 'No message preview')}</p></div><small>${time(chat.lastMessageAt || chat.updatedAt)}</small></article>`).join('') : '<p class="empty">No active conversations yet.</p>'; 
    const orders = data.recentOrders || []; 
    $('#orders-table').innerHTML = orders.length ? orders.slice(0,5).map((order, index) => `<tr><td>${safe(order.orderId || `ORD${String(index + 1).padStart(4,'0')}`)}</td><td>${safe(order.customerName || order.wa_id || 'Customer')}</td><td>${safe(order.productName || order.productId || '—')}</td><td>${safe(order.qty || 1)}</td><td>₹${safe(order.amount || order.total || order.price || '—')}</td><td><span class="badge">${safe(order.status || 'Processing')}</span></td><td>${date(order.createdAt)}</td></tr>`).join('') : '<tr><td colspan="7" class="empty">No orders to show yet.</td></tr>'; 
  } catch(e) { 
    if(e.message !== 'Unauthorized') $('#live-conversations').innerHTML = '<p class="empty">Could not load dashboard.</p>'; 
  } 
}
$('#refresh').addEventListener('click', load); 

async function loadChatMessages(waId, name) {
  try {
    const res = await apiFetch(`/api/chats/${waId}`);
    const data = await res.json();
    $('#chat-modal-title').textContent = `Chat with ${name}`;
    
    if (data.messages && data.messages.length > 0) {
      $('#chat-messages').innerHTML = data.messages.map(m => {
        const isBot = m.type === 'bot' || m.sender === 'bot';
        const isHuman = m.type === 'human';
        let cssClass = 'msg-user';
        if (isBot) cssClass = 'msg-bot';
        else if (isHuman) cssClass = 'msg-human';
        return `<div class="msg ${cssClass}"><p>${safe(m.text || m.body || m.message || '—')}</p><small>${time(m.receivedAt || m.createdAt)}</small></div>`;
      }).join('');
      const msgs = $('#chat-messages');
      msgs.scrollTop = msgs.scrollHeight;
    } else {
      $('#chat-messages').innerHTML = '<p class="empty">No messages found.</p>';
    }

    const mode = data.customer?.mode || 'ai';
    const toggleBtn = $('#toggle-mode-btn');
    const inputArea = $('#chat-input-area');
    
    if (mode === 'human') {
      toggleBtn.textContent = 'Switch to AI Mode';
      toggleBtn.classList.add('active');
      inputArea.style.display = 'flex';
    } else {
      toggleBtn.textContent = 'Take Over (Switch to Human Mode)';
      toggleBtn.classList.remove('active');
      inputArea.style.display = 'none';
    }
  } catch (err) {
    if(err.message !== 'Unauthorized') $('#chat-messages').innerHTML = '<p class="empty">Error loading messages.</p>';
  }
}

$('#toggle-mode-btn').addEventListener('click', async () => {
  const waId = $('#chat-modal').dataset.activeWaid;
  if (!waId) return;
  const isHuman = $('#toggle-mode-btn').classList.contains('active');
  const newMode = isHuman ? 'ai' : 'human';
  
  try {
    const res = await apiFetch(`/api/chats/${waId}/mode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: newMode })
    });
    if (res.ok) {
      loadChatMessages(waId, $('#chat-modal').dataset.activeName);
    }
  } catch (err) {}
});

$('#send-chat-btn').addEventListener('click', async () => {
  const waId = $('#chat-modal').dataset.activeWaid;
  const input = $('#chat-input');
  const text = input.value.trim();
  if (!waId || !text) return;
  
  try {
    input.disabled = true;
    $('#send-chat-btn').disabled = true;
    const res = await apiFetch(`/api/messages/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ waId, text })
    });
    if (res.ok) {
      input.value = '';
    } else {
      alert('Failed to send message');
    }
  } catch (err) {} finally {
    input.disabled = false;
    $('#send-chat-btn').disabled = false;
    input.focus();
  }
});

$('#chat-input').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') $('#send-chat-btn').click();
});

$('#live-conversations').addEventListener('click', async (e) => {
  const row = e.target.closest('.live-row');
  if (!row) return;
  const waId = row.dataset.waid;
  if (!waId || waId === 'undefined') return;
  
  const name = row.querySelector('b').textContent;
  $('#chat-modal').dataset.activeWaid = waId;
  $('#chat-modal').dataset.activeName = name;
  
  $('#chat-modal').style.display = 'flex';
  $('#chat-modal-title').textContent = 'Loading...';
  $('#chat-messages').innerHTML = '<div class="loader">Loading messages...</div>';
  
  await loadChatMessages(waId, name);
});

$('#close-chat-modal').addEventListener('click', () => {
  $('#chat-modal').style.display = 'none';
  delete $('#chat-modal').dataset.activeWaid;
  delete $('#chat-modal').dataset.activeName;
});

function initApp() {
  load();
  if (socket) socket.disconnect();
  socket = io({ auth: { token: authToken } });
  
  socket.on('update', (data) => {
    if (data.type === 'connected') {
      const b = document.querySelector('.bot-status b i');
      if(b) {
        b.textContent = 'Online (Live)';
        b.style.color = '#17a862';
      }
    } else {
      load();
      const activeWaid = $('#chat-modal').dataset.activeWaid;
      const activeName = $('#chat-modal').dataset.activeName;
      if (activeWaid && $('#chat-modal').style.display === 'flex') {
        loadChatMessages(activeWaid, activeName);
      }
    }
  });

  socket.on('connect_error', () => {
    const b = document.querySelector('.bot-status b i');
    if(b) {
      b.textContent = 'Reconnecting...';
      b.style.color = 'orange';
    }
  });
}

if (authToken) {
  initApp();
} else {
  showLogin();
}
