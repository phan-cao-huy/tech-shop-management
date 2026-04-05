let currentAccData = [];
let currentAccPage = 1;
const accRowsPerPage = 5;

document.addEventListener("DOMContentLoaded", function () {
    loadAccounts();
});

// ==========================================
// 1. TẢI TOÀN BỘ TÀI KHOẢN
// ==========================================
function loadAccounts() {
    document.getElementById('accSearchInput').value = ''; // Reset ô tìm kiếm
    fetch('http://127.0.0.1:5000/accounts/getall')
        .then(res => res.json())
        .then(data => {
            currentAccData = data;
            currentAccPage = 1;
            renderAccountTable();
        })
        .catch(err => showError(err.message));
}

// ==========================================
// 2. TÌM KIẾM TÀI KHOẢN
// ==========================================
function handleAccSearch(e) {
    if (e.key === 'Enter') searchAccounts();
}

function searchAccounts() {
    const keyword = document.getElementById('accSearchInput').value.trim();
    if (!keyword) {
        loadAccounts();
        return;
    }

    fetch(`http://127.0.0.1:5000/accounts/search?keyword=${encodeURIComponent(keyword)}`, { method: 'POST' })
        .then(res => res.json())
        .then(data => {
            currentAccData = data;
            currentAccPage = 1;
            renderAccountTable();
        })
        .catch(err => showError(err.message));
}

// ==========================================
// 3. XÓA TÀI KHOẢN
// ==========================================
function deleteAccount(id) {
    if (confirm(`Bạn có chắc muốn vô hiệu hóa tài khoản ${id} không?`)) {
        fetch(`http://127.0.0.1:5000/accounts/delete/${id}`, { method: 'PUT' })
            .then(res => res.json())
            .then(data => {
                alert(data.mess || data.error || "Thành công!");
                searchAccounts(); // Reload lại danh sách hiện tại
            })
            .catch(err => alert("Lỗi khi xóa: " + err.message));
    }
}

// ==========================================
// 4. VẼ BẢNG & PHÂN TRANG
// ==========================================
function renderAccountTable() {
    const tbody = document.getElementById('accountTableBody');
    if (!currentAccData || currentAccData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4"><i>Không tìm thấy tài khoản nào.</i></td></tr>`;
        document.querySelector('.pagination-acc').innerHTML = '';
        return;
    }

    let startIndex = (currentAccPage - 1) * accRowsPerPage;
    let paginatedData = currentAccData.slice(startIndex, startIndex + accRowsPerPage);

    tbody.innerHTML = paginatedData.map(acc => {
        let roleBadge = acc.Role === 'Admin' ? 'bg-danger' : (acc.Role === 'Manager' ? 'bg-warning text-dark' : 'bg-primary');

        return `
        <tr>
            <td><strong>${acc.AccountID}</strong></td>
            <td class="text-primary fw-bold">${acc.Username || 'N/A'}</td>
            <td><span class="badge ${roleBadge} rounded-pill px-3 py-1">${acc.Role || 'User'}</span></td>
            <td class="text-center">
                <span class="badge bg-success rounded-pill px-3 py-1">Hoạt động</span>
            </td>
            <td class="text-center pe-3">
                <button class="btn btn-sm btn-light text-warning me-1" title="Sửa" onclick="alert('Cần viết thêm API /update')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-light text-danger" title="Xóa" onclick="deleteAccount('${acc.AccountID}')">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </td>
        </tr>`;
    }).join('');

    renderAccPagination();
}

function renderAccPagination() {
    let totalPages = Math.ceil(currentAccData.length / accRowsPerPage);
    let container = document.querySelector('.pagination-acc');
    let html = '';

    if (totalPages <= 1) { container.innerHTML = ''; return; }

    html += `<li class="page-item ${currentAccPage === 1 ? 'disabled' : ''}"><a class="page-link" href="#" onclick="changeAccPage(event, ${currentAccPage - 1})">Trước</a></li>`;
    for (let i = 1; i <= totalPages; i++) {
        let active = currentAccPage === i ? 'style="background-color: #1b45cf; border-color: #1b45cf; color: white;"' : '';
        html += `<li class="page-item ${currentAccPage === i ? 'active' : ''}"><a class="page-link" href="#" onclick="changeAccPage(event, ${i})" ${active}>${i}</a></li>`;
    }
    html += `<li class="page-item ${currentAccPage === totalPages ? 'disabled' : ''}"><a class="page-link" href="#" onclick="changeAccPage(event, ${currentAccPage + 1})">Sau</a></li>`;
    container.innerHTML = html;
}

function changeAccPage(e, page) {
    e.preventDefault();
    let totalPages = Math.ceil(currentAccData.length / accRowsPerPage);
    if (page >= 1 && page <= totalPages) {
        currentAccPage = page;
        renderAccountTable();
    }
}

function showError(msg) {
    document.getElementById('accountTableBody').innerHTML = `<tr><td colspan="6" class="text-center text-danger">Lỗi Backend: ${msg}</td></tr>`;
}