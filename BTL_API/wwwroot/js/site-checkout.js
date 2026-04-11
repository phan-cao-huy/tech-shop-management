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
                    <div class="payment-option" data-method="PayPal">
                        <i class="bi bi-paypal"></i> PayPal
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
            <div id="paypal-button-container" style="display:none;margin-top:1rem"></div>
        </div>
    </div>`;

    // Load customer info
    loadCustomerInfo();

    // Payment method selection
    document.querySelectorAll('.payment-option').forEach(opt => {
        opt.addEventListener('click', () => {
            document.querySelectorAll('.payment-option').forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
            togglePayPalButton(opt.dataset.method);
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

// ── PayPal integration ──────────────────────────────────────────

let _paypalSdkLoaded = false;

function togglePayPalButton(method) {
    const ppContainer = document.getElementById('paypal-button-container');
    const placeBtn = document.getElementById('btnPlaceOrder');
    if (!ppContainer) return;

    if (method === 'PayPal') {
        placeBtn.style.display = 'none';
        ppContainer.style.display = 'block';
        ppContainer.innerHTML = `
            <div class="spinner" style="width:28px;height:28px;border-width:3px;margin:.75rem auto"></div>`;
        _initPayPalCheckout(ppContainer);
    } else {
        placeBtn.style.display = '';
        ppContainer.style.display = 'none';
        ppContainer.innerHTML = '';
    }
}

async function _initPayPalCheckout(ppContainer) {
    try {
        const cart = getCart();
        if (cart.length === 0) { showToast('Giỏ hàng trống!', 'warning'); return; }
        const custId = getCustomerID();
        if (!custId) { showToast('Vui lòng đăng nhập lại!', 'danger'); return; }

        // Just load the SDK — no bill created until after payment
        await _loadPayPalSdk();

        ppContainer.innerHTML = '';
        _mountPayPalButtons(ppContainer, custId, cart);

    } catch (err) {
        console.error('_initPayPalCheckout error:', err);
        ppContainer.innerHTML = `<p class="text-muted">${escapeHtml(err.message || 'Lỗi khởi tạo PayPal')}</p>`;
    }
}

function _loadPayPalSdk() {
    if (_paypalSdkLoaded || typeof paypal !== 'undefined') {
        _paypalSdkLoaded = true;
        return Promise.resolve();
    }
    return apiFetch('/paypal/client-id').then(cfg => {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(cfg.clientId)}&currency=USD`;
            script.onload = () => { _paypalSdkLoaded = true; resolve(); };
            script.onerror = () => reject(new Error('PayPal SDK failed to load. Check Client ID.'));
            document.head.appendChild(script);
        });
    });
}


function _mountPayPalButtons(ppContainer, custId, cart) {
    const items = cart.map(i => ({ ProductVariantID: i.variantId, Num: i.qty }));

    paypal.Buttons({
        style: { layout: 'vertical', color: 'blue', shape: 'rect', label: 'paypal' },

        createOrder: async function () {
            try {
                const ppRes = await apiPost('/paypal/create-order', { CustomerID: custId, items });
                if (ppRes.status !== 200 || !ppRes.data.orderID) {
                    const errMsg = ppRes.data.error || 'Tạo đơn PayPal thất bại (status ' + ppRes.status + ')';
                    showToast(errMsg, 'danger');
                    throw new Error(errMsg);
                }
                return ppRes.data.orderID;
            } catch (err) {
                const msg = err.message || String(err);
                showToast('createOrder lỗi: ' + msg, 'danger');
                throw err;
            }
        },

        onApprove: async function (data) {
            const captureRes = await apiPost('/paypal/capture-order', {
                orderID: data.orderID,
                CustomerID: custId,
                items
            });
            if (captureRes.status === 200 && captureRes.data.success) {
                clearCart();
                showToast('Thanh toán PayPal thành công!', 'success');
                setTimeout(() => { window.location.href = '/Home/Orders'; }, 1500);
            } else {
                showToast(captureRes.data.error || 'Lỗi xác nhận thanh toán', 'danger');
            }
        },

        onError: function (err) {
            console.error('PayPal onError:', err);
        },

        onCancel: function () {
            showToast('Bạn đã hủy thanh toán PayPal.', 'warning');
        }
    }).render(ppContainer);
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

        const total = getCartTotal();
        const payMethod = document.querySelector('.payment-option.active')?.dataset.method || 'Cash';

        if (payMethod === 'Cash') {
            // 1. Create bill as Pending
            const billRes = await apiPost('/bills/add', {
                CustomerID: custId,
                EmployeeID: null,
                PaymentMethod: 'Cash',
                Status: 'Pending',
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

            // 3. Confirm (deduct stock, set Confirmed)
            const confirmRes = await apiPost('/bills/' + encodeURIComponent(billId) + '/confirm', {});
            if (confirmRes.status === 200) {
                clearCart();
                showToast('Đặt hàng thành công!', 'success');
                setTimeout(() => { window.location.href = '/Home/Orders'; }, 1500);
            } else {
                throw new Error(confirmRes.data.mess || 'Sản phẩm đã hết hàng');
            }
        } else if (payMethod === 'Transfer') {
            // Transfer: create bill as Pending, wait for SePay webhook
            const billRes = await apiPost('/bills/add', {
                CustomerID: custId,
                EmployeeID: null,
                PaymentMethod: 'Transfer',
                Status: 'Pending',
                TotalPrice: 0
            });
            if (billRes.status !== 200 || !billRes.data.BillID) {
                throw new Error(billRes.data.mess || billRes.data.error || 'Không thể tạo đơn hàng');
            }
            const billId = billRes.data.BillID;
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
            clearCart();
            showTransferPayment(billId, total);
        }

    } catch (err) {
        console.error(err);
        showToast(err.message || 'Đã xảy ra lỗi khi đặt hàng', 'danger');
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-bag-check"></i> Đặt hàng';
    }
}

// ── Bank Transfer: show static VietQR ────────────────────────────────────

function showTransferPayment(billId, total) {
    const container = document.getElementById('checkoutContainer');
    if (!container) return;

    const transferContent = 'CELLTECH ' + billId;
    const qrUrl = 'https://img.vietqr.io/image/TCB-0961978926-compact2.png'
        + '?amount=' + encodeURIComponent(Math.round(total))
        + '&addInfo=' + encodeURIComponent(transferContent)
        + '&accountName=' + encodeURIComponent('VU NHAT THANH');

    container.innerHTML = `
    <div class="checkout-section text-center" style="max-width:480px;margin:0 auto">
        <h3><i class="bi bi-bank"></i> Thanh toán chuyển khoản</h3>
        <p class="text-muted mb-1">Quét mã QR bên dưới để thanh toán
            <strong>${formatPrice(total)}</strong>
        </p>
        <p class="mb-3">Nội dung chuyển khoản bắt buộc:
            <strong style="color:var(--primary)">${escapeHtml(transferContent)}</strong>
        </p>
        <img
            src="${escapeHtml(qrUrl)}"
            alt="QR Code thanh toán"
            style="max-width:280px;width:100%;border:1px solid var(--border);border-radius:12px;padding:.5rem"
        >
        <div class="mt-3" style="font-size:.95rem">
            <p>Ngân hàng: <strong>Techcombank (TCB)</strong></p>
            <p>Số tài khoản: <strong>0961978926</strong></p>
            <p>Chủ tài khoản: <strong>VU NHAT THANH</strong></p>
        </div>
        <div id="transferStatus" class="mt-3">
            <div class="spinner" style="width:24px;height:24px;border-width:3px;margin:.5rem auto"></div>
            <p class="text-muted">Đang chờ xác nhận thanh toán...</p>
        </div>
    </div>`;

    pollPaymentStatus(billId);
}

let _paymentPollTimer = null;

function pollPaymentStatus(billId) {
    _paymentPollTimer = setInterval(async () => {
        try {
            const data = await apiFetch('/bills/' + encodeURIComponent(billId) + '/payment-status');
            if (data.Status && data.Status !== 'Pending') {
                clearInterval(_paymentPollTimer);
                const statusDiv = document.getElementById('transferStatus');
                if (statusDiv) {
                    statusDiv.innerHTML = '<p style="color:var(--success)"><i class="bi bi-check-circle-fill"></i> Thanh toán xác nhận thành công!</p>';
                }
                showToast('Thanh toán thành công!', 'success');
                setTimeout(() => { window.location.href = '/Home/Orders'; }, 2000);
            }
        } catch (err) {
            console.error('Payment poll error:', err);
        }
    }, 3000);
}


