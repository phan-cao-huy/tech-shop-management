/* ===== CellTech Store — Core: API, Utilities, UI Helpers ===== */

const API = 'http://127.0.0.1:5000';

// ======================= UTILITIES =======================

function formatPrice(n) {
    if (!n) return 'Giá liên hệ';
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);
}

function parseImages(imgStr) {
    if (!imgStr) return [];
    if (Array.isArray(imgStr)) return imgStr;
    try {
        const parsed = JSON.parse(imgStr);
        return Array.isArray(parsed) ? parsed : [String(imgStr)];
    } catch {
        return imgStr ? [String(imgStr)] : [];
    }
}

function getFirstImage(imgStr) {
    const imgs = parseImages(imgStr);
    return imgs.length > 0 ? imgs[0] : null;
}

const PLACEHOLDER_IMG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200' fill='%23cbd5e1'%3E%3Crect width='200' height='200' fill='%23f1f5f9'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-size='48'%3E📱%3C/text%3E%3C/svg%3E";

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function escapeHtmlWithBreaks(str) {
    if (!str) return '';
    const escaped = escapeHtml(String(str));
    return escaped.replace(/\\n/g, '<br>').replace(/\n/g, '<br>');
}

// ======================= UI HELPERS =======================

function updateCartBadge() {
    const badge = document.getElementById('cartBadge');
    if (badge) {
        const count = getCartCount();
        badge.textContent = count;
        badge.style.display = count > 0 ? 'flex' : 'none';
    }
}

function updateAuthUI() {
    const loginBtn = document.getElementById('navLogin');
    const logoutBtn = document.getElementById('navLogout');
    const ordersLink = document.getElementById('navOrders');
    const cartBtn = document.getElementById('navCart');

    if (isLoggedIn()) {
        if (loginBtn) loginBtn.style.display = 'none';
        if (logoutBtn) logoutBtn.style.display = '';
        if (ordersLink) ordersLink.style.display = '';
        if (cartBtn) cartBtn.style.display = '';
    } else {
        if (loginBtn) loginBtn.style.display = '';
        if (logoutBtn) logoutBtn.style.display = 'none';
        if (ordersLink) ordersLink.style.display = 'none';
        if (cartBtn) cartBtn.style.display = '';
    }
}

function showToast(message, type) {
    type = type || 'info';
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = 'toast-notification toast-' + type;
    toast.textContent = message;
    container.appendChild(toast);
    requestAnimationFrame(() => { toast.classList.add('toast-show'); });
    setTimeout(() => {
        toast.classList.remove('toast-show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function renderSkeletons(container, count) {
    let html = '';
    for (let i = 0; i < count; i++) {
        html += '<div class="skeleton skeleton-card"></div>';
    }
    container.innerHTML = html;
}

// ======================= API HELPERS =======================

async function apiFetch(path) {
    const res = await fetch(API + path);
    if (!res.ok) throw new Error('API error: ' + res.status);
    return res.json();
}

async function apiPost(path, body) {
    const res = await fetch(API + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    return { status: res.status, data: await res.json() };
}
