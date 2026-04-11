/* ===== CellTech Store — Orders ===== */

function buildStatusTimeline(status) {
    const steps = [
        { key: 'pending',    icon: 'bi-clock',         label: 'Chờ xác nhận' },
        { key: 'confirmed',  icon: 'bi-check-circle',  label: 'Đã xác nhận' },
        { key: 'packaging',  icon: 'bi-box',           label: 'Đang đóng gói' },
        { key: 'packaged',   icon: 'bi-box-seam',      label: 'Đã đóng gói' },
        { key: 'in_transit', icon: 'bi-truck',         label: 'Đang giao hàng' },
        { key: 'completed',  icon: 'bi-check2-circle', label: 'Hoàn thành' },
    ];
    const s = (status || '').toLowerCase();
    if (s === 'cancelled') {
        return '<div class="order-timeline-cancelled"><i class="bi bi-x-circle-fill"></i> Đơn hàng đã bị hủy</div>';
    }
    const currentIdx = steps.findIndex(st => st.key === s);
    return `<div class="order-timeline">${steps.map((step, i) => {
        const cls = i < currentIdx ? 'step-done' : (i === currentIdx ? 'step-current' : 'step-upcoming');
        return `<div class="timeline-step ${cls}"><div class="step-icon"><i class="bi ${step.icon}"></i></div><div class="step-label">${step.label}</div></div>`;
    }).join('')}</div>`;
}

async function loadOrdersPage() {
    const container = document.getElementById('ordersContainer');
    if (!container) return;

    if (!isLoggedIn()) {
        requireLogin('/Home/Orders');
        return;
    }

    container.innerHTML = '<div class="spinner"></div>';

    let custId = getCustomerID();
    if (!custId) {
        custId = await fetchAndStoreCustomerID();
    }

    if (!custId) {
        container.innerHTML = '<p class="text-muted" style="text-align:center;padding:3rem">Không thể xác định tài khoản. Vui lòng đăng nhập lại.</p>';
        return;
    }

    try {
        const allBills = await apiFetch('/bills/getall');
        const myBills = (Array.isArray(allBills) ? allBills : [])
            .filter(b => b.CustomerID === custId)
            .sort((a, b) => new Date(b.DateOrder || 0) - new Date(a.DateOrder || 0));

        if (myBills.length === 0) {
            container.innerHTML = `
            <div class="cart-empty">
                <i class="bi bi-receipt-cutoff"></i>
                <h3>Chưa có đơn hàng</h3>
                <p>Bạn chưa đặt đơn hàng nào.</p>
                <a href="/" class="btn-outline"><i class="bi bi-arrow-left"></i> Mua sắm ngay</a>
            </div>`;
            return;
        }

        // Load details for each bill
        const billsWithDetails = await Promise.all(myBills.map(async bill => {
            try {
                const details = await apiFetch('/bills/bill-details/get/' + encodeURIComponent(bill.BillID));
                return { ...bill, details: Array.isArray(details) ? details : [] };
            } catch {
                return { ...bill, details: [] };
            }
        }));

        // Filter bar
        const filterHtml = `<div class="orders-filter-bar">
            <label class="filter-label" for="orderStatusFilter"><i class="bi bi-funnel"></i> Lọc theo trạng thái</label>
            <select class="filter-select" id="orderStatusFilter" onchange="renderOrders()">
                <option value="">Tất cả</option>
                <option value="pending">Chờ xác nhận</option>
                <option value="confirmed">Đã xác nhận</option>
                <option value="packaging">Đang đóng gói</option>
                <option value="packaged">Đã đóng gói</option>
                <option value="in_transit">Đang giao hàng</option>
                <option value="completed">Hoàn thành</option>
                <option value="cancelled">Đã hủy</option>
            </select>
        </div>
        <div id="ordersListContainer"></div>`;

        container.innerHTML = filterHtml;

        const activeStatuses = ['pending', 'confirmed', 'packaging', 'packaged', 'in_transit'];
        window._allBillsWithDetails = billsWithDetails;
        window.renderOrders = function () {
            const filterVal = (document.getElementById('orderStatusFilter')?.value || '').toLowerCase();
            const filtered = filterVal ? billsWithDetails.filter(b => (b.Status || '').toLowerCase() === filterVal) : billsWithDetails;
            const listContainer = document.getElementById('ordersListContainer');
            if (!listContainer) return;

            if (filtered.length === 0) {
                listContainer.innerHTML = `<div class="cart-empty"><i class="bi bi-search"></i><h3>Không có đơn hàng</h3><p>Không tìm thấy đơn hàng nào với trạng thái này.</p></div>`;
                return;
            }

            listContainer.innerHTML = filtered.map(bill => {
            let statusClass = 'status-draft';
            let statusText = 'Đang xử lý';
            const s = (bill.Status || '').toLowerCase();
            if (s === 'pending') { statusClass = 'status-pending'; statusText = 'Chờ xác nhận'; }
            else if (s === 'confirmed') { statusClass = 'status-confirmed'; statusText = 'Đã xác nhận'; }
            else if (s === 'packaging') { statusClass = 'status-packaging'; statusText = 'Đang đóng gói'; }
            else if (s === 'packaged') { statusClass = 'status-packaged'; statusText = 'Đã đóng gói'; }
            else if (s === 'in_transit') { statusClass = 'status-in-transit'; statusText = 'Đang giao hàng'; }
            else if (s === 'completed') { statusClass = 'status-completed'; statusText = 'Hoàn thành'; }
            else if (s === 'cancelled') { statusClass = 'status-cancelled'; statusText = 'Đã hủy'; }

            const dateStr = bill.DateOrder ? new Date(bill.DateOrder).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
            const payMethodText = (bill.PayMethod || '').toLowerCase() === 'transfer' ? 'Chuyển khoản'
                : (bill.PayMethod || '').toLowerCase() === 'paypal' ? 'PayPal'
                : 'Tiền mặt';
            const itemCount = bill.details.reduce((s, d) => s + (d.Num || 0), 0);
            const customerName = bill.CustomerName || 'Chưa cập nhật';
            const customerPhone = bill.CustomerPhone || 'Chưa cập nhật';
            const customerAddress = bill.CustomerAddress || 'Chưa cập nhật';

            const liveClass = activeStatuses.includes(s) ? ' status-live' : '';

            return `
            <div class="order-card${s === 'cancelled' ? ' order-card--cancelled' : ''}">
                <div class="order-card-header">
                    <div>
                        <span class="order-id">#${escapeHtml(bill.BillID)}</span>
                        <span class="order-date" style="margin-left:.75rem">${dateStr}</span>
                    </div>
                    <span class="order-status ${statusClass}${liveClass}">${statusText}</span>
                </div>
                <div class="order-card-body">
                    ${bill.details.map(d => {
                const img = d.Image || PLACEHOLDER_IMG;
                const name = d.ProductName || d.ProductVariantID || '';
                const color = d.Color || '';
                const version = d.VariantVersion || '';
                const subtotal = (d.Price || 0) * (d.Num || 0);
                return `
                        <div class="order-detail-item">
                            <img class="order-detail-img" src="${escapeHtml(img)}" alt="" onerror="this.src='${PLACEHOLDER_IMG}'">
                            <div class="order-detail-info">
                                <div class="order-detail-name">${escapeHtml(name)}</div>
                                <div class="order-detail-meta">${version ? escapeHtml(version) : ''}${version && color ? ' · ' : ''}${color ? escapeHtml(color) : ''}</div>
                                <div class="order-detail-price">${formatPrice(d.Price || 0)} × ${d.Num || 0}</div>
                            </div>
                            <div class="order-detail-subtotal">${formatPrice(subtotal)}</div>
                        </div>`;
            }).join('')}
                </div>
                <div class="order-card-footer">
                    <div class="order-footer-info">
                        <span class="order-payment"><i class="bi bi-credit-card"></i> ${payMethodText}</span>
                        <span class="order-item-count"><i class="bi bi-box-seam"></i> ${itemCount} sản phẩm</span>
                    </div>
                    <div class="order-footer-right">
                        <span class="order-total">${formatPrice(bill.TotalPrice || 0)}</span>
                        ${s === 'pending' && (bill.PayMethod || '').toLowerCase() === 'transfer' ? `
                        <button class="btn btn-sm btn-primary" style="margin-right:.5rem" onclick="openTransferPayment('${escapeHtml(bill.BillID)}', ${bill.TotalPrice || 0})">
                            <i class="bi bi-qr-code-scan"></i> Thanh toán ngay
                        </button>` : ''}
                        <button class="order-toggle-btn" id="toggle-btn-${escapeHtml(bill.BillID)}" onclick="toggleOrderDetails('${escapeHtml(bill.BillID)}')">
                            Chi tiết <i class="bi bi-chevron-down chevron"></i>
                        </button>
                    </div>
                </div>
                <div id="order-details-${escapeHtml(bill.BillID)}" style="display:none; border-top:1px solid var(--border-light); background:var(--bg);">
                    <div style="padding: 1rem 1.25rem 0.75rem;">
                        <p class="order-detail-section-label"><i class="bi bi-diagram-3"></i> Tiến trình đơn hàng</p>
                        ${buildStatusTimeline(bill.Status)}
                    </div>
                    <div style="padding: 0.75rem 1.25rem 1.25rem; border-top: 1px solid var(--border-light);">
                        <p class="order-detail-section-label"><i class="bi bi-truck"></i> Thông tin giao hàng</p>
                        <p style="font-size: 0.83rem; color: var(--text-secondary); margin-bottom: 0.3rem;"><i class="bi bi-person-fill" style="color:var(--primary);margin-right:6px;"></i>${escapeHtml(customerName)}</p>
                        <p style="font-size: 0.83rem; color: var(--text-secondary); margin-bottom: 0.3rem;"><i class="bi bi-telephone-fill" style="color:var(--primary);margin-right:6px;"></i>${escapeHtml(customerPhone)}</p>
                        <p style="font-size: 0.83rem; color: var(--text-secondary); margin-bottom: 0;"><i class="bi bi-geo-alt-fill" style="color:var(--primary);margin-right:6px;"></i>${escapeHtml(customerAddress)}</p>
                    </div>
                </div>
            </div>`;
            }).join('');
        };

        window.renderOrders();

    } catch (err) {
        console.error(err);
        container.innerHTML = '<p class="text-muted" style="text-align:center;padding:3rem">Không thể tải lịch sử đơn hàng.</p>';
    }
}

window.toggleOrderDetails = function (billId) {
    const pane = document.getElementById('order-details-' + billId);
    const btn  = document.getElementById('toggle-btn-' + billId);
    if (pane) {
        const opening = pane.style.display === 'none';
        pane.style.display = opening ? 'block' : 'none';
        if (btn) btn.classList.toggle('is-open', opening);
    }
};

// ── Bank Transfer: reopen QR from order history ──────────────────────────

let _orderPollTimer = null;

window.openTransferPayment = function (billId, total) {
    const transferContent = 'CELLTECH ' + billId;
    const qrUrl = 'https://img.vietqr.io/image/TCB-0961978926-compact2.png'
        + '?amount=' + encodeURIComponent(Math.round(total))
        + '&addInfo=' + encodeURIComponent(transferContent)
        + '&accountName=' + encodeURIComponent('VU NHAT THANH');

    // Remove any existing modal
    const existing = document.getElementById('transferModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'transferModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem';
    modal.innerHTML = `
    <div style="background:var(--card-bg,#fff);border-radius:16px;padding:2rem;max-width:440px;width:100%;text-align:center;box-shadow:0 8px 40px rgba(0,0,0,.2);position:relative">
        <button onclick="closeTransferModal()" style="position:absolute;top:.75rem;right:.75rem;background:none;border:none;font-size:1.4rem;cursor:pointer;color:var(--text-muted,#888)">&times;</button>
        <h4 style="margin-bottom:.5rem"><i class="bi bi-bank"></i> Thanh toán chuyển khoản</h4>
        <p style="color:var(--text-muted,#666);margin-bottom:.25rem">Quét mã QR để thanh toán <strong>${formatPrice(total)}</strong></p>
        <p style="margin-bottom:.75rem">Nội dung: <strong style="color:var(--primary,#6c63ff)">${escapeHtml(transferContent)}</strong></p>
        <img src="${escapeHtml(qrUrl)}" alt="QR thanh toán"
            style="max-width:260px;width:100%;border:1px solid var(--border,#e0e0e0);border-radius:12px;padding:.4rem">
        <div style="margin-top:.75rem;font-size:.9rem">
            <p>Ngân hàng: <strong>Techcombank (TCB)</strong></p>
            <p>Số tài khoản: <strong>0961978926</strong></p>
            <p>Chủ tài khoản: <strong>VU NHAT THANH</strong></p>
        </div>
        <div id="modalPollStatus" style="margin-top:.75rem">
            <div class="spinner" style="width:22px;height:22px;border-width:3px;margin:.25rem auto"></div>
            <p style="color:var(--text-muted,#888);font-size:.9rem">Đang chờ xác nhận thanh toán...</p>
        </div>
    </div>`;
    document.body.appendChild(modal);

    if (_orderPollTimer) clearInterval(_orderPollTimer);
    _orderPollTimer = setInterval(async () => {
        try {
            const data = await apiFetch('/bills/' + encodeURIComponent(billId) + '/payment-status');
            if (data.Status && data.Status.toLowerCase() !== 'pending') {
                clearInterval(_orderPollTimer);
                const statusDiv = document.getElementById('modalPollStatus');
                if (statusDiv) {
                    statusDiv.innerHTML = '<p style="color:var(--success,#28a745)"><i class="bi bi-check-circle-fill"></i> Thanh toán xác nhận thành công!</p>';
                }
                showToast('Thanh toán thành công!', 'success');
                setTimeout(() => { window.location.reload(); }, 2000);
            }
        } catch (err) {
            console.error('Poll error:', err);
        }
    }, 3000);
};

window.closeTransferModal = function () {
    if (_orderPollTimer) { clearInterval(_orderPollTimer); _orderPollTimer = null; }
    const modal = document.getElementById('transferModal');
    if (modal) modal.remove();
};
