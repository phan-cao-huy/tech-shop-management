/* ===== CellTech Store — Orders ===== */

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

        container.innerHTML = billsWithDetails.map(bill => {
            const statusClass = (bill.Status || '').toLowerCase() === 'completed' ? 'status-completed'
                : (bill.Status || '').toLowerCase() === 'cancelled' ? 'status-cancelled'
                : 'status-draft';
            const statusText = (bill.Status || '').toLowerCase() === 'completed' ? 'Hoàn thành'
                : (bill.Status || '').toLowerCase() === 'cancelled' ? 'Đã hủy'
                : 'Đang xử lý';
            const dateStr = bill.DateOrder ? new Date(bill.DateOrder).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
            const payMethodText = (bill.PayMethod || '').toLowerCase() === 'transfer' ? 'Chuyển khoản' : 'Tiền mặt';
            const itemCount = bill.details.reduce((s, d) => s + (d.Num || 0), 0);

            return `
            <div class="order-card">
                <div class="order-card-header">
                    <div>
                        <span class="order-id">Đơn hàng #${escapeHtml(bill.BillID)}</span>
                        <span class="order-date" style="margin-left:.75rem">${dateStr}</span>
                    </div>
                    <span class="order-status ${statusClass}">${statusText}</span>
                </div>
                <div class="order-card-body">
                    ${bill.details.map(d => {
                        const img = d.Image || PLACEHOLDER_IMG;
                        const name = d.ProductName || d.ProductVariantID || '';
                        const color = d.Color || '';
                        const version = d.VariantDescription || '';
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
                        <span class="order-item-count">${itemCount} sản phẩm</span>
                    </div>
                    <div class="order-total">Tổng: ${formatPrice(bill.TotalPrice || 0)}</div>
                </div>
            </div>`;
        }).join('');

    } catch (err) {
        console.error(err);
        container.innerHTML = '<p class="text-muted" style="text-align:center;padding:3rem">Không thể tải lịch sử đơn hàng.</p>';
    }
}
