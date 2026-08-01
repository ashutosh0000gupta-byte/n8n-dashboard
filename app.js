const state = { customers: [], selected: null };
const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
const formatDate = (value) => value ? new Date(Number.isFinite(Number(value)) ? Number(value) * 1000 : value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'No activity yet';
const initial = (name = '?') => escapeHtml(name.trim().charAt(0).toUpperCase() || '?');

function renderChats() {
  const term = document.querySelector('#chat-search').value.trim().toLowerCase();
  const matches = state.customers.filter((customer) => `${customer.profileName || ''} ${customer.wa_id || ''} ${customer.lastMessage || ''}`.toLowerCase().includes(term));
  document.querySelector('#customer-list').innerHTML = matches.length ? matches.map((customer) => {
    const name = customer.profileName || 'Customer';
    return `<button class="chat-card ${state.selected?.wa_id === customer.wa_id ? 'current' : ''}" data-wa-id="${escapeHtml(customer.wa_id)}" type="button"><span class="avatar">${initial(name)}</span><span class="chat-copy"><b>${escapeHtml(name)}</b><small>${escapeHtml(customer.lastMessage || 'No message preview')}</small></span><span class="chat-time">${formatDate(customer.lastMessageAt || customer.updatedAt)}</span></button>`;
  }).join('') : '<p class="empty">No chats found.</p>';
  document.querySelectorAll('[data-wa-id]').forEach((button) => button.addEventListener('click', () => selectChat(button.dataset.waId)));
}

async function loadDashboard() {
  try {
    const response = await fetch('./api/dashboard');
    if (!response.ok) throw new Error('Request failed');
    const data = await response.json();
    state.customers = data.recentCustomers || [];
    document.querySelector('#active-chats').textContent = data.activeChatCount ?? 0;
    document.querySelector('#customers').textContent = data.customerCount ?? 0;
    document.querySelector('#orders').textContent = data.orderCount ?? 0;
    document.querySelector('#carts').textContent = data.cartCount ?? 0;
    renderChats();
  } catch {
    document.querySelector('#customer-list').innerHTML = '<p class="empty">Could not load chats. Check the server and MongoDB connection.</p>';
  }
}

async function selectChat(waId) {
  const customer = state.customers.find((item) => item.wa_id === waId);
  if (!customer) return;
  state.selected = customer;
  renderChats();
  const name = customer.profileName || 'Customer';
  document.querySelector('#conversation-head').innerHTML = `<div class="avatar">${initial(name)}</div><div><h2>${escapeHtml(name)}</h2><p>WhatsApp · ${escapeHtml(customer.wa_id)}</p></div>`;
  document.querySelector('#contact-details').innerHTML = `<div class="avatar large">${initial(name)}</div><h3>${escapeHtml(name)}</h3><p>${escapeHtml(customer.wa_id)}</p><dl><div><dt>Last activity</dt><dd>${formatDate(customer.lastMessageAt || customer.updatedAt)}</dd></div><div><dt>Latest message</dt><dd>${escapeHtml(customer.lastMessage || '—')}</dd></div></dl>`;
  const history = document.querySelector('#chat-history');
  history.innerHTML = '<p class="loading">Loading conversation…</p>';
  try {
    const response = await fetch(`./api/chats/${encodeURIComponent(waId)}`);
    if (!response.ok) throw new Error('Request failed');
    const { messages } = await response.json();
    history.innerHTML = messages.length ? messages.map((message) => `<article class="bubble ${message.direction === 'outbound' ? 'outbound' : ''}"><p>${escapeHtml(message.text || message.message_text || '')}</p><small>${formatDate(message.receivedAt || message.createdAt)}</small></article>`).join('') : '<div class="empty-state"><div class="empty-icon">◌</div><h2>No stored messages</h2><p>Add the n8n logging nodes in the README to record incoming WhatsApp chats.</p></div>';
    history.scrollTop = history.scrollHeight;
  } catch { history.innerHTML = '<p class="empty">Could not load this conversation.</p>'; }
}

document.querySelector('#refresh').addEventListener('click', loadDashboard);
document.querySelector('#chat-search').addEventListener('input', renderChats);
document.querySelectorAll('.filters button').forEach((button) => button.addEventListener('click', () => { document.querySelector('.filters .selected').classList.remove('selected'); button.classList.add('selected'); }));
loadDashboard();
