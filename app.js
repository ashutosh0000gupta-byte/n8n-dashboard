const formatDate = (value) => value ? new Date(Number.isFinite(Number(value)) ? Number(value) * 1000 : value).toLocaleString() : '—';
const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));

function rows(items, render, empty) {
  return items.length ? items.map(render).join('') : `<p class="empty">${empty}</p>`;
}

async function load() {
  const status = document.querySelector('#status');
  status.textContent = 'Loading…';
  try {
    const response = await fetch('./api/dashboard');
    if (!response.ok) throw new Error('Request failed');
    const data = await response.json();
    document.querySelector('#customers').textContent = data.customerCount;
    document.querySelector('#orders').textContent = data.orderCount;
    document.querySelector('#carts').textContent = data.cartCount;
    document.querySelector('#active-chats').textContent = data.activeChatCount;
    document.querySelector('#customer-list').innerHTML = rows(data.recentCustomers, (customer) => `
      <button class="chat-row" type="button" data-wa-id="${escapeHtml(customer.wa_id)}"><div><b>${escapeHtml(customer.profileName || 'Customer')}</b><small>${escapeHtml(customer.wa_id)}</small></div><div><small>${formatDate(customer.lastMessageAt || customer.updatedAt)}</small><p>${escapeHtml(customer.lastMessage || '')}</p></div></button>`, 'No customers yet.');
    document.querySelectorAll('[data-wa-id]').forEach((button) => button.addEventListener('click', () => loadChat(button.dataset.waId)));
    status.textContent = `Updated ${new Date().toLocaleTimeString()}`;
  } catch {
    status.textContent = 'The dashboard API is unavailable on GitHub Pages. Deploy server.js to a Node.js host to show live data.';
  }
}

async function loadChat(waId) {
  const history = document.querySelector('#chat-history');
  history.textContent = 'Loading chat…';
  try {
    const response = await fetch(`./api/chats/${encodeURIComponent(waId)}`);
    if (!response.ok) throw new Error('Request failed');
    const { messages } = await response.json();
    history.innerHTML = rows(messages, (message) => `<div class="message"><small>${formatDate(message.receivedAt || message.createdAt)}</small><p>${escapeHtml(message.text || message.message_text || '')}</p></div>`, 'No messages stored for this customer.');
  } catch { history.textContent = 'Could not load this chat.'; }
}
document.querySelector('#refresh').addEventListener('click', load);
load();
