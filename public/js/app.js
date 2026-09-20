// Small fetch wrapper: always sends cookies, always parses JSON, throws on non-2xx.
async function api(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

// Fetches the current user (or null if not logged in) and paints the nav accordingly.
async function refreshNavAccount() {
  const el = document.getElementById('navAccount');
  if (!el) return null;
  try {
    const { user } = await api('/auth/me');
    const adminLink = user.role === 'admin'
      ? `<button class="btn-account" onclick="location.href='/admin.html'">🛠️ Admin</button>`
      : '';
    el.innerHTML = `
      ${adminLink}
      <button class="btn-account" onclick="location.href='/index.html#account'">👋 ${user.name.split(' ')[0]}</button>
      <button class="btn-account" onclick="logout()">Log out</button>
    `;
    return user;
  } catch (err) {
    el.innerHTML = `<button class="btn-account" onclick="location.href='/login.html'">Log in</button>`;
    return null;
  }
}

async function logout() {
  await api('/auth/logout', { method: 'POST' });
  location.href = '/index.html';
}

document.addEventListener('DOMContentLoaded', refreshNavAccount);
