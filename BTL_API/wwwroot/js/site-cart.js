/* ===== CellTech Store — Cart (localStorage) ===== */

function getCart() {
    try { return JSON.parse(localStorage.getItem('cart') || '[]'); }
    catch { return []; }
}

function saveCart(cart) {
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartBadge();
}

function addToCart(variantId, productId, name, color, price, image, maxStock) {
    if (!isLoggedIn()) {
        requireLogin();
        return;
    }
    const cart = getCart();
    const existing = cart.find(c => c.variantId === variantId);
    if (existing) {
        if (existing.qty < maxStock) {
            existing.qty++;
            showToast('Đã cập nhật số lượng trong giỏ hàng!', 'success');
        } else {
            showToast('Đã đạt số lượng tối đa có sẵn!', 'warning');
            return;
        }
    } else {
        cart.push({ variantId, productId, name, color, price: Number(price), image, qty: 1, maxStock });
        showToast('Đã thêm vào giỏ hàng!', 'success');
    }
    saveCart(cart);
}

function removeFromCart(variantId) {
    let cart = getCart().filter(c => c.variantId !== variantId);
    saveCart(cart);
    showToast('Đã xóa khỏi giỏ hàng', 'info');
}

function updateCartQty(variantId, qty) {
    const cart = getCart();
    const item = cart.find(c => c.variantId === variantId);
    if (item) {
        item.qty = Math.max(1, Math.min(Number(qty), item.maxStock));
    }
    saveCart(cart);
}

function getCartCount() {
    return getCart().reduce((sum, i) => sum + i.qty, 0);
}

function getCartTotal() {
    return getCart().reduce((sum, i) => sum + i.price * i.qty, 0);
}

function clearCart() {
    localStorage.removeItem('cart');
    updateCartBadge();
}

// ======================= CART PAGE =======================

function loadCartPage() {
    const container = document.getElementById('cartContainer');
    if (!container) return;

    const cart = getCart();
    if (cart.length === 0) {
        container.innerHTML = `
        <div class="cart-empty">
            <i class="bi bi-cart-x"></i>
            <h3>Giỏ hàng trống</h3>
            <p>Bạn chưa thêm sản phẩm nào vào giỏ hàng.</p>
            <a href="/" class="btn-outline"><i class="bi bi-arrow-left"></i> Tiếp tục mua sắm</a>
        </div>`;
        return;
    }

    let itemsHtml = cart.map(item => `
    <div class="cart-item" data-vid="${escapeHtml(item.variantId)}">
        <div class="cart-item-img">
            <img src="${escapeHtml(item.image || PLACEHOLDER_IMG)}" alt="" onerror="this.src='${PLACEHOLDER_IMG}'">
        </div>
        <div class="cart-item-info">
            <div class="cart-item-name">${escapeHtml(item.name)}</div>
            <div class="cart-item-variant">${item.color ? escapeHtml(item.color) : ''}</div>
        </div>
        <div class="cart-item-actions">
            <div class="qty-selector">
                <button class="qty-btn" onclick="cartChangeQty('${escapeHtml(item.variantId)}', -1)">−</button>
                <input type="number" class="qty-input" value="${item.qty}" min="1" max="${item.maxStock}"
                    onchange="cartSetQty('${escapeHtml(item.variantId)}', this.value)">
                <button class="qty-btn" onclick="cartChangeQty('${escapeHtml(item.variantId)}', 1)">+</button>
            </div>
        </div>
        <div class="cart-item-price">${formatPrice(item.price * item.qty)}</div>
        <button class="cart-remove-btn" onclick="cartRemove('${escapeHtml(item.variantId)}')">
            <i class="bi bi-trash3"></i>
        </button>
    </div>`).join('');

    const total = getCartTotal();
    container.innerHTML = `
    <div>${itemsHtml}</div>
    <div class="cart-summary">
        <div class="cart-summary-row">
            <span>Tạm tính (${cart.reduce((s, i) => s + i.qty, 0)} sản phẩm)</span>
            <span>${formatPrice(total)}</span>
        </div>
        <div class="cart-summary-row total">
            <span>Tổng cộng</span>
            <span class="price">${formatPrice(total)}</span>
        </div>
        <a href="/Home/Checkout" class="btn-checkout">Tiến hành thanh toán</a>
    </div>
    <div style="margin-top:1rem">
        <a href="/" class="btn-outline"><i class="bi bi-arrow-left"></i> Tiếp tục mua sắm</a>
    </div>`;
}

function cartChangeQty(variantId, delta) {
    const cart = getCart();
    const item = cart.find(c => c.variantId === variantId);
    if (item) {
        item.qty = Math.max(1, Math.min(item.qty + delta, item.maxStock));
        saveCart(cart);
    }
    loadCartPage();
}

function cartSetQty(variantId, val) {
    const cart = getCart();
    const item = cart.find(c => c.variantId === variantId);
    if (item) {
        item.qty = Math.max(1, Math.min(parseInt(val) || 1, item.maxStock));
        saveCart(cart);
    }
    loadCartPage();
}

function cartRemove(variantId) {
    removeFromCart(variantId);
    loadCartPage();
}
