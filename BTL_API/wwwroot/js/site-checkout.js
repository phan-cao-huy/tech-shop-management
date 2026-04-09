/* ===== CellTech Store — Checkout ===== */

function loadCheckoutPage() {
    const container = document.getElementById('checkoutContainer');
    if (!container) return;

    if (!isLoggedIn()) {
        requireLogin('/Home/Checkout');
        return;
    }

    const cart = getCart();
    if (cart.length === 0) {
        window.location.href = '/Home/Cart';
        return;
    }

    const total = getCartTotal();

    // Load customer info
    const custId = getCustomerID();

    let summaryHtml = cart.map(item => `
    <div class="order-summary-item">
        <span class="item-name">${escapeHtml(item.name)} ${item.color ? '<small style="color:var(--text-muted)">- ' + escapeHtml(item.color) + '</small>' : ''}</span>
        <span class="item-qty">x${item.qty}</span>
        <span class="item-price">${formatPrice(item.price * item.qty)}</span>
    </div>`).join('');

    container.innerHTML = `
    <div class="row g-4">
        <div class="col-lg-7">
            <div class="checkout-section">
                <h3><i class="bi bi-person"></i> Thông tin giao hàng</h3>
                <div id="customerInfoArea">
                    <div class="spinner" style="margin:1rem auto"></div>
                </div>
            </div>
            <div class="checkout-section">
                <h3><i class="bi bi-credit-card"></i> Phương thức thanh toán</h3>
                <div class="payment-options">
                    <div class="payment-option active" data-method="Cash">
                        <i class="bi bi-cash-stack"></i> Tiền mặt
                    </div>
                    <div class="payment-option" data-method="Transfer">
                        <i class="bi bi-bank"></i> Chuyển khoản
                    </div>
                </div>
            </div>
        </div>
        <div class="col-lg-5">
            <div class="checkout-section">
                <h3><i class="bi bi-receipt"></i> Đơn hàng của bạn</h3>
                ${summaryHtml}
                <div class="cart-summary-row total" style="border-top:2px solid var(--border);margin-top:.75rem;padding-top:.75rem">
                    <span>Tổng cộng</span>
                    <span class="price">${formatPrice(total)}</span>
                </div>
            </div>
            <button class="btn-checkout" id="btnPlaceOrder" onclick="placeOrder()">
                <i class="bi bi-bag-check"></i> Đặt hàng
            </button>
        </div>
    </div>`;

    // Load customer info
    loadCustomerInfo();

    // Payment method selection
    document.querySelectorAll('.payment-option').forEach(opt => {
        opt.addEventListener('click', () => {
            document.querySelectorAll('.payment-option').forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
        });
    });
}

async function loadCustomerInfo() {
    const area = document.getElementById('customerInfoArea');
    if (!area) return;

    let custId = getCustomerID();
    if (!custId) {
        custId = await fetchAndStoreCustomerID();
    }

    if (!custId) {
        area.innerHTML = '<p class="text-muted">Không thể tải thông tin khách hàng.</p>';
        return;
    }

    try {
        const data = await apiFetch('/customers/' + encodeURIComponent(custId));
        const cust = Array.isArray(data) ? data[0] : data;
        if (!cust) {
            area.innerHTML = '<p class="text-muted">Không tìm thấy thông tin khách hàng.</p>';
            return;
        }
        area.innerHTML = `
        <div class="mb-3">
            <label class="form-label-modern">Họ và tên</label>
            <input class="form-input" id="custName" value="${escapeHtml(cust.FullName || '')}" readonly>
        </div>
        <div class="row g-3">
            <div class="col-md-6">
                <label class="form-label-modern">Số điện thoại</label>
                <input class="form-input" id="custPhone" value="${escapeHtml(cust.Phone || '')}" readonly>
            </div>
            <div class="col-md-6">
                <label class="form-label-modern">Email</label>
                <input class="form-input" id="custEmail" value="${escapeHtml(cust.Email || '')}" readonly>
            </div>
        </div>
        <div class="mt-3">
            <label class="form-label-modern">Địa chỉ giao hàng</label>
            <input class="form-input" id="custAddress" value="${escapeHtml(cust.Address || '')}">
        </div>`;
    } catch (err) {
        console.error(err);
        area.innerHTML = '<p class="text-muted">Lỗi tải thông tin khách hàng.</p>';
    }
}

async function placeOrder() {
    const btn = document.getElementById('btnPlaceOrder');
    if (btn.disabled) return;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner" style="width:20px;height:20px;border-width:2px;margin:0 auto"></span>';

    try {
        const cart = getCart();
        if (cart.length === 0) { showToast('Giỏ hàng trống!', 'warning'); return; }

        const custId = getCustomerID();
        if (!custId) { showToast('Vui lòng đăng nhập lại!', 'danger'); return; }

        const payMethod = document.querySelector('.payment-option.active')?.dataset.method || 'Cash';

        // 1. Create bill
        const billRes = await apiPost('/bills/add', {
            CustomerID: custId,
            EmployeeID: null,
            PaymentMethod: payMethod,
            Status: 'Draft',
            TotalPrice: 0
        });

        if (billRes.status !== 200 || !billRes.data.BillID) {
            throw new Error(billRes.data.mess || billRes.data.error || 'Không thể tạo đơn hàng');
        }

        const billId = billRes.data.BillID;

        // 2. Add bill details
        for (const item of cart) {
            const detailRes = await apiPost('/bill-details/add', {
                BillID: billId,
                ProductVariantID: item.variantId,
                Num: item.qty
            });
            if (detailRes.status !== 200) {
                throw new Error(detailRes.data.mess || 'Lỗi thêm sản phẩm vào đơn hàng');
            }
        }

        // 3. Checkout (deduct stock)
        const checkoutRes = await apiPost('/bills/' + encodeURIComponent(billId) + '/checkout', {});

        if (checkoutRes.status === 200 && !checkoutRes.data.mess?.includes('out of stock')) {
            clearCart();
            showToast('Đặt hàng thành công!', 'success');
            setTimeout(() => { window.location.href = '/Home/Orders'; }, 1500);
        } else {
            throw new Error(checkoutRes.data.mess || 'Sản phẩm đã hết hàng');
        }

    } catch (err) {
        console.error(err);
        showToast(err.message || 'Đã xảy ra lỗi khi đặt hàng', 'danger');
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-bag-check"></i> Đặt hàng';
    }
}
