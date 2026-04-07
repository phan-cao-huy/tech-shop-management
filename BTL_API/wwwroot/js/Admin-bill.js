let currentBillData = [];
let currentBillPage = 1;
const billRowsPerPage = 5;

document.addEventListener("DOMContentLoaded", function () {
    executeBillSearch();
});

function executeBillSearch() {
    let keyword = document.getElementById('billSearchInput').value;
    let statusFilter = document.getElementById('filterBill').value;

    fetch('http://127.0.0.1:5000/bills/getall')
        .then(res => res.json())
        .then(data => {
            if (statusFilter !== "All") {
                data = data.filter(bill => bill.Status === statusFilter);
            }

            if (keyword !== "") {
                const kw = keyword.toLowerCase();
                data = data.filter(bill =>
                    (bill.BillID && bill.BillID.toLowerCase().includes(kw)) ||
                    (bill.CustomerID && bill.CustomerID.toLowerCase().includes(kw)) ||
                    (bill.CustomerName && bill.CustomerName.toLowerCase().includes(kw)) ||
                    (bill.EmployeeName && bill.EmployeeName.toLowerCase().includes(kw))
                )
            }
            currentBillData = data;
            currentBillPage = 1;
            renderBillTable();
        })
        .catch(err => {
            document.getElementById('billTableBody').innerHTML = `<tr><td colspan="9" class="text-center text-danger py-4"><i>Lỗi khi tải dữ liệu: ${err.message}</i></td></tr>`;
        });
}

function renderBillTable() {
    const tableBody = document.getElementById('billTableBody');
    if (currentBillData.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="9" class="text-center text-muted py-4">Không có đơn hàng nào.</td></tr>`;
        document.getElementById('billPagination').innerHTML = '';
        return;
    }

    let startIndex = (currentBillPage - 1) * billRowsPerPage;
    let paginatedData = currentBillData.slice(startIndex, startIndex + billRowsPerPage);

    tableBody.innerHTML = paginatedData.map(bill => {
        let badge = '';
        let actionButtons = `<button class="btn btn-sm btn-light text-primary me-1" title="Xem chi tiết" onclick="viewBillDetails('${bill.BillID}', ${bill.TotalPrice})"><i class="fas fa-eye"></i></button>`;

      
        if (bill.Status === 'Draft') {
            badge = `<span class="badge bg-warning text-dark">Nháp</span>`;
            actionButtons += `<button class="btn btn-sm btn-light text-primary me-1" title="Chốt & Giao hàng" onclick="checkoutBill('${bill.BillID}')"><i class="fas fa-truck"></i></button>`;
            actionButtons += `<button class="btn btn-sm btn-light text-danger" title="Hủy đơn" onclick="cancelBill('${bill.BillID}')"><i class="fas fa-times-circle"></i></button>`;
        }
        else if (bill.Status === 'Shipping') {
            badge = `<span class="badge bg-info text-dark">Đang giao</span>`;
            actionButtons += `<button class="btn btn-sm btn-light text-primary me-1" title="Khách đã nhận (Bắt đầu đếm ngược đổi trả)" onclick="deliverBill('${bill.BillID}')"><i class="fas fa-box-open"></i></button>`;
        }
        else if (bill.Status === 'Delivered') {
            badge = `<span class="badge bg-primary">Đã giao (Chờ chốt)</span>`;
            actionButtons += `<button class="btn btn-sm btn-light text-success me-1" title="Khách chốt / Hết hạn đổi trả" onclick="completeBill('${bill.BillID}')"><i class="fas fa-check-double"></i></button>`;
            actionButtons += `<button class="btn btn-sm btn-light text-danger" title="Khách trả hàng & Hoàn tiền" onclick="returnBill('${bill.BillID}')"><i class="fas fa-exchange-alt"></i></button>`;
        }
        else if (bill.Status === 'Completed') {
            badge = `<span class="badge bg-success">Hoàn thành</span>`;
            // Vẫn có thể cho ngoại lệ trả hàng nếu cần, tùy quy định cửa hàng
            actionButtons += `<button class="btn btn-sm btn-light text-danger" title="Ngoại lệ: Trả hàng" onclick="returnBill('${bill.BillID}')"><i class="fas fa-exchange-alt"></i></button>`;
        }
        else if (bill.Status === 'Returned') {
            badge = `<span class="badge bg-dark">Trả hàng (Đã hoàn kho)</span>`;
        }
        else if (bill.Status === 'Cancelled') {
            badge = `<span class="badge text-bg-danger">Đã hủy</span>`;
        }

        let orderDate = bill.DateOrder ? new Date(bill.DateOrder).toLocaleString('vi-VN') : '-';

        let customerDisplay = bill.CustomerName
            ? `<strong>${bill.CustomerName}</strong><br><small class="text-muted">${bill.CustomerID}</small>`
            : `<span class="text-muted">Khách vãng lai</span>`;

        let employeeDisplay = bill.EmployeeName
            ? `<strong>${bill.EmployeeName}</strong><br><small class="text-muted">${bill.EmployeeID}</small>`
            : (bill.EmployeeID ? bill.EmployeeID : '-');

        return `
        <tr>
            <td><strong>${bill.BillID}</strong></td>
            <td>${customerDisplay}</td>
            <td>${employeeDisplay}</td>
            <td>${orderDate}</td>
            <td>${bill.PayMethod || 'Cash'}</td>
            <td class="text-danger fw-bold">${(bill.TotalPrice || 0).toLocaleString()}đ</td>
            <td class="text-center">${badge}</td>
            <td class="text-center pe-3">${actionButtons}</td>
        </tr>`;
    }).join('');

    renderBillPagination();
}

// XEM CHI TIẾT ĐƠN HÀNG 
function viewBillDetails(billId, totalPrice) {
    document.getElementById('detailBillId').innerText = billId;
    document.getElementById('detailTotalPrice').innerText = (totalPrice || 0).toLocaleString() + 'đ';

    fetch(`http://127.0.0.1:5000/bill-details/get/${billId}`)
        .then(res => res.json())
        .then(data => {
            const detailBody = document.getElementById('billDetailTableBody');
            if (!data || data.length === 0) {
                detailBody.innerHTML = `<tr><td colspan="4" class="text-center">Chưa có sản phẩm nào trong đơn này.</td></tr>`;
            } else {
                detailBody.innerHTML = data.map(item => {
                    let subTotal = item.Num * item.Price;
                    return `
                    <tr>
                        <td>
                           <strong>${item.ProductName || 'Sản phẩm không xác định'}</strong>
                           <br/>
                           <small class="text-muted">Mã: ${item.ProductVariantID} | Màu: ${item.Color || 'Mặc định'}</small>
                        </td>
                        <td class="text-center">${item.Num}</td>
                        <td class="text-end">${item.Price.toLocaleString()}đ</td>
                        <td class="text-end text-primary fw-bold">${subTotal.toLocaleString()}đ</td>
                    </tr>`;
                }).join('');
            }
            new bootstrap.Modal(document.getElementById('viewBillDetailModal')).show();
        })
        .catch(err => alert("Lỗi khi lấy chi tiết đơn hàng!"));
}

// DUYỆT ĐƠN SANG TRẠNG THÁI ĐANG GIAO
function checkoutBill(billId) {
    if (!confirm(`Xác nhận chốt đơn [${billId}]? Thao tác này sẽ TRỪ TỒN KHO và chuyển trạng thái sang Đang giao.`)) return;

    fetch(`http://127.0.0.1:5000/bills/${billId}/checkout`, { method: 'POST' })
        .then(res => res.json())
        .then(result => {
            if (result.mess && result.mess.includes("không đủ số lượng")) {
                alert("Thất bại: " + result.mess);
            } else if (result.error) {
                alert("Lỗi Server: " + result.error);
            } else {
                alert("Đã chốt đơn và bắt đầu giao hàng!");
                executeBillSearch();
            }
        });
}

// XÁC NHẬN HOÀN THÀNH (HÀM MỚI)
function completeBill(billId) {
    if (!confirm(`Xác nhận khách hàng đã nhận được đơn [${billId}] thành công?`)) return;

    fetch(`http://127.0.0.1:5000/bills/${billId}/complete`, { method: 'POST' })
        .then(res => res.json())
        .then(result => {
            if (result.error) {
                alert("Lỗi Server: " + result.error);
            } else if (result.mess && result.mess.includes("Chỉ có thể")) {
                alert("Lỗi: " + result.mess);
            } else {
                alert("Xác nhận hoàn thành đơn hàng!");
                executeBillSearch();
            }
        })
        .catch(err => alert("Lỗi kết nối: " + err.message));
}

function deliverBill(billId) {
    if (!confirm(`Xác nhận bưu tá đã giao thành công đơn [${billId}]? Đơn sẽ chuyển sang trạng thái chờ đổi trả.`)) return;
    fetch(`http://127.0.0.1:5000/bills/${billId}/deliver`, { method: 'POST' })
        .then(res => res.json())
        .then(result => {
            if (result.error) alert("Lỗi: " + result.error);
            else { alert(result.mess); executeBillSearch(); }
        });
}

function returnBill(billId) {
    if (!confirm(`XÁC NHẬN TRẢ HÀNG cho đơn [${billId}]? Hệ thống sẽ CỘNG LẠI TỒN KHO và HỦY DOANH THU đơn này.`)) return;
    fetch(`http://127.0.0.1:5000/bills/${billId}/return`, { method: 'POST' })
        .then(res => res.json())
        .then(result => {
            if (result.error) alert("Lỗi: " + result.error);
            else { alert(result.mess); executeBillSearch(); }
        });
}

// HỦY ĐƠN 
function cancelBill(billId) {
    if (!confirm(`Bạn có chắc chắn muốn HỦY đơn hàng [${billId}]? Nếu đơn đang giao hoặc đã hoàn thành, tồn kho sẽ được cộng lại.`)) return;

    fetch(`http://127.0.0.1:5000/bills/${billId}/cancel`, { method: 'POST' })
        .then(res => res.json())
        .then(result => {
            if (result.error) {
                alert("Lỗi: " + result.error);
            } else {
                alert(result.mess || "Đã hủy đơn hàng thành công!");
                executeBillSearch();
            }
        });
}

// PHÂN TRANG 
function renderBillPagination() {
    let totalPages = Math.ceil(currentBillData.length / billRowsPerPage);
    let html = '';

    if (totalPages <= 1) {
        document.getElementById('billPagination').innerHTML = '';
        return;
    }

    html += `
        <li class="page-item ${currentBillPage === 1 ? 'disabled' : ''}">
            <a class="page-link" href="#" onclick="changeBillPage(event, ${currentBillPage - 1})">Trước</a>
        </li>`;

    for (let i = 1; i <= totalPages; i++) {
        html += `
            <li class="page-item ${i === currentBillPage ? 'active' : ''}">
                <a class="page-link" href="#" onclick="changeBillPage(event, i)">${i}</a>
            </li>`;
    }

    html += `
        <li class="page-item ${currentBillPage === totalPages ? 'disabled' : ''}">
            <a class="page-link" href="#" onclick="changeBillPage(event, ${currentBillPage + 1})">Sau</a>
        </li>`;

    document.getElementById('billPagination').innerHTML = html;
}

function changeBillPage(e, page) {
    e.preventDefault();
    currentBillPage = page;
    renderBillTable();
}

// MỞ FORM TẠO ĐƠN HÀNG 
function openAddBillModal() {
    document.getElementById('addCustomerID').value = '';
    document.getElementById('addPayMethod').value = 'Cash';
    document.getElementById('billDetailArea').innerHTML = '';
    addBillDetailRow();

    let empInput = document.getElementById('addEmployeeID');
    let empIdFromJS = localStorage.getItem('EmployeeID');

    if (empIdFromJS) {
        empInput.value = empIdFromJS;
        empInput.setAttribute('readonly', 'true');
        empInput.classList.add('bg-light');
    } else {
        empInput.value = '';
        empInput.removeAttribute('readonly');
        empInput.classList.remove('bg-light');
    }

    new bootstrap.Modal(document.getElementById('addBillModal')).show();
}

function addBillDetailRow() {
    const id = Date.now();
    const html = `
        <div class="row g-2 mb-2 detail-row align-items-center" id="row-${id}">
            <div class="col-md-8">
                <input type="text" class="form-control d-var-id" placeholder="Mã sản phẩm (VD: VAR1)" required>
            </div>
            <div class="col-md-3">
                <input type="number" class="form-control d-num" placeholder="Số lượng" min="1" value="1" required>
            </div>
            <div class="col-md-1 text-end">
                <button class="btn btn-outline-danger" onclick="document.getElementById('row-${id}').remove()"><i class="fas fa-trash"></i></button>
            </div>
        </div>
    `;
    document.getElementById('billDetailArea').insertAdjacentHTML('beforeend', html);
}

// LƯU ĐƠN HÀNG & CHI TIẾT LÊN SERVER
async function submitFullBill() {
    const customerId = document.getElementById('addCustomerID').value.trim() || null;
    const employeeId = document.getElementById('addEmployeeID').value.trim();
    const payMethod = document.getElementById('addPayMethod').value;

    if (!employeeId) {
        alert("Thiếu mã nhân viên lập đơn!"); return;
    }

    const rows = document.querySelectorAll('.detail-row');
    if (rows.length === 0) {
        alert("Đơn hàng phải có ít nhất 1 sản phẩm!"); return;
    }

    let details = [];
    let isValid = true;
    rows.forEach(row => {
        const vId = row.querySelector('.d-var-id').value.trim();
        const num = row.querySelector('.d-num').value;
        if (!vId || !num || num <= 0) isValid = false;
        details.push({ ProductVariantID: vId, Num: parseInt(num) });
    });

    if (!isValid) {
        alert("Vui lòng điền đúng mã sản phẩm và số lượng > 0!"); return;
    }

    try {
        const billRes = await fetch('http://127.0.0.1:5000/bills/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                CustomerID: customerId,
                EmployeeID: employeeId,
                PaymentMethod: payMethod,
                Status: 'Draft',
                TotalPrice: 0
            })
        });

        const billData = await billRes.json();
        if (!billRes.ok) throw new Error(billData.mess || billData.error || "Lỗi tạo đơn");

        const newBillId = billData.BillID;

        for (const item of details) {
            item.BillID = newBillId;
            const detRes = await fetch('http://127.0.0.1:5000/bill-details/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item)
            });

            if (!detRes.ok) {
                const errData = await detRes.json();
                console.error("Lỗi dòng:", item, errData);
                alert(`Lỗi khi thêm sản phẩm ${item.ProductVariantID}: ${errData.mess || 'Không xác định'}`);
            }
        }

        alert("Tạo đơn hàng nháp thành công!");
        location.reload();

    } catch (err) {
        alert("Lỗi: " + err.message);
    }
}