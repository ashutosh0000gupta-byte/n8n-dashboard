const formatDate = (value) => value ? new Date(Number.isFinite(Number(value)) ? Number(value) * 1000 : value).toLocaleString() : '—';
const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));

function rows(items, render, empty) {
  return items.length ? items.map(render).join('') : `<p class="empty">${empty}</p>`;
}

async function load() {
  const status = document.querySelector('#status');
  status.textContent = 'Loading…';
  try {
    const response = await fetch('/api/dashboard');
    if (!response.ok) throw new Error('Request failed');
    const data = await response.json();
    document.querySelector('#customers').textContent = data.customerCount;
    document.querySelector('#orders').textContent = data.orderCount;
    document.querySelector('#carts').textContent = data.cartCount;
    document.querySelector('#customer-list').innerHTML = rows(data.recentCustomers, (customer) => `
      <div class="row"><div><b>${escapeHtml(customer.profileName || 'Customer')}</b><small>${escapeHtml(customer.wa_id)}</small></div><div><small>${formatDate(customer.lastMessageAt || customer.updatedAt)}</small><p>${escapeHtml(customer.lastMessage || '')}</p></div></div>`, 'No customers yet.');
    document.querySelector('#message-list').innerHTML = rows(data.recentMessages, (message) => `
      <div class="row"><div><b>${escapeHtml(message.customerName || message.wa_id)}</b><small>${escapeHtml(message.wa_id)}</small></div><div><small>${formatDate(message.receivedAt || message.createdAt)}</small><p>${escapeHtml(message.text || '')}</p></div></div>`, 'No messages yet.');
    status.textContent = `Updated ${new Date().toLocaleTimeString()}`;
  } catch { status.textContent = 'Could not load data. Check the MongoDB connection and administrator credentials.'; }
}
document.querySelector('#refresh').addEventListener('click', load);
load();
