// Chờ giao diện load xong thì mới gọi API
document.addEventListener("DOMContentLoaded", function () {
    executeSearch();
});

function executeSearch() {
    let keyword = document.getElementById('searchInput').value;
    let roleFilter = document.getElementById('filterRole').value;

    // CHỤP X-QUANG 1: Xem JS có lấy đúng chữ mày gõ không?
    console.log("1. Chữ đang tìm:", keyword, "| Chức vụ lọc:", roleFilter);

    fetch('http://127.0.0.1:5000/employees/search?keyword=' + keyword, {
        method: 'POST'
    })
        .then(response => response.json())
        .then(data => {
            // CHỤP X-QUANG 2: Xem Python trả về cái mảng có bao nhiêu người?
            console.log("2. Data từ Python gửi về:", data);

            if (roleFilter !== "All") {
                data = data.filter(emp => emp.Role === roleFilter);
                // CHỤP X-QUANG 3: Xem lọc xong còn mấy người?
                console.log("3. Data sau khi lọc chức vụ:", data);
            }

            renderTable(data);
        })
        .catch(error => console.error('Lỗi khi tìm kiếm:', error));
}

// 3. Hàm chuyên làm nhiệm vụ vẽ HTML (Tách ra dùng chung cho sạch code)
function renderTable(data) {
    const tableBody = document.getElementById('employeeTableBody');
    let htmlContent = '';

    // Nếu tìm không thấy ai thì báo lỗi cho thân thiện
    if (!data || data.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4"><i>Không tìm thấy nhân viên nào phù hợp với bộ lọc.</i></td></tr>`;
        return;
    }

    data.forEach(emp => {
        let firstLetter = emp.FullName ? emp.FullName.charAt(0).toUpperCase() : '?';
        let badgeClass = 'bg-secondary';
        let role = emp.Role;
        if (role === 'Quản lý') badgeClass = 'bg-danger';
        else if (role === 'Bán hàng') badgeClass = 'bg-primary';
        else if (role === 'Thủ kho') badgeClass = 'bg-dark';
        else if (role === 'Thu ngân') badgeClass = 'bg-success';
        else if (role === 'Kỹ thuật') badgeClass = 'bg-info text-dark';

        htmlContent += `
            <tr>
                <td class="ps-3"><input type="checkbox" class="form-check-input"></td>
                <td><strong>${emp.EmployeeID}</strong></td>
                <td>
                    <div class="d-flex align-items-center">
                        <div class="bg-primary text-white rounded-circle d-flex justify-content-center align-items-center me-2" style="width: 35px; height: 35px; font-weight: bold;">
                            ${firstLetter}
                        </div>
                        ${emp.FullName}
                    </div>
                </td>
                <td>${emp.Phone || ''}</td>
                <td>${emp.Email || ''}</td>
                <td class="text-center">
                    <span class="badge ${badgeClass} rounded-pill px-3 py-2">${emp.Role}</span>
                </td>
                <td class="text-center pe-3">
                    <button class="btn btn-sm btn-light text-primary" title="Sửa" onclick="openEditModal('${emp.EmployeeID}')"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-sm btn-light text-danger" title="Xóa" onclick="deleteEmployee('${emp.EmployeeID}')"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `;
    });

    tableBody.innerHTML = htmlContent;
}
function saveNewEmployee() {
    // 1. Lấy dữ liệu từ các ô input mà người dùng vừa gõ
    const empData = {
        FullName: document.getElementById('addFullName').value,
        Role: document.getElementById('addRole').value,
        Phone: document.getElementById('addPhone').value,
        Email: document.getElementById('addEmail').value,
        Username: document.getElementById('addUsername').value,
        Password: document.getElementById('addPassword').value
    };

    // Kiểm tra sơ bộ xem có để trống ô nào không
    if (!empData.FullName || !empData.Phone || !empData.Username || !empData.Password) {
        alert("Vui lòng điền đầy đủ các trường bắt buộc!");
        return;
    }

    // 2. Dùng Fetch API gọi sang cổng 5000 của Python
    fetch('http://127.0.0.1:5000/employees/add', {
        method: 'POST', // Chuyển phương thức thành POST
        headers: {
            'Content-Type': 'application/json' // Báo cho Python biết tao gửi JSON đấy nhé
        },
        body: JSON.stringify(empData) // Ép cái Object empData thành chuỗi JSON
    })
        .then(response => {
            return response.json().then(data => ({ status: response.status, body: data }));
        })
        .then(result => {
            // Nếu Python trả về HTTP Status 200 (Thành công)
            if (result.status === 200) {
                alert("Thêm nhân viên thành công!");

                // Xóa trắng form để lần sau mở lên nhập tiếp
                document.getElementById('formAddEmployee').reset();

                // Đóng cái cửa sổ Modal đi
                var myModalEl = document.getElementById('addEmployeeModal');
                var modal = bootstrap.Modal.getInstance(myModalEl);
                modal.hide();

                // QUAN TRỌNG: Gọi lại hàm load bảng để nó hiển thị ngay nhân viên mới
                loadEmployees();
            }
            // Nếu Python báo lỗi (Trùng Username, SĐT... - Status 400 hoặc 500)
            else {
                alert("Lỗi: " + (result.body.mess || result.body.error));
            }
        })
        .catch(error => {
            console.error('Lỗi khi lưu dữ liệu:', error);
            alert("Không kết nối được với Server Python!");
        });
}
// Hàm Xóa nhân viên
function deleteEmployee(id) {
    // 1. Cảnh báo trước khi xóa (Cực kỳ quan trọng trong UI/UX)
    if (!confirm(`Bạn có chắc chắn muốn xóa nhân viên có mã [${id}] không? Hành động này sẽ xóa luôn cả tài khoản đăng nhập của người này và không thể khôi phục!`)) {
        return; // Nếu user bấm Cancel (Hủy) thì dừng luôn không làm gì cả
    }

    fetch(`http://127.0.0.1:5000/employees/delete/${id}`, {
        method: 'DELETE' 
    })
        .then(response => {
            return response.json().then(data => ({ status: response.status, body: data }));
        })
        .then(result => {
            // Nếu Python trả về HTTP Status 200 (Xóa thành công)
            if (result.status === 200) {
                alert("Đã tiễn nhân viên lên đường thành công!");

                loadEmployees();
            }
            
            else {
                alert("Không thể xóa: " + (result.body.mess || result.body.error));
            }
        })
        .catch(error => {
            console.error('Lỗi khi gọi API xóa:', error);
            alert("Lỗi kết nối đến Server Python! Hãy kiểm tra lại backend.");
        });
}
// 1. Hàm Mở Modal và lấy thông tin cũ điền vào
function openEditModal(id) {
    // Gọi API lấy thông tin chi tiết của 1 nhân viên (GET /employees/get/<id>)
    fetch('http://127.0.0.1:5000/employees/' + id)
        .then(response => response.json())
        .then(data => {
            if (data && data.length > 0) {
                let emp = data[0]; // Lấy object đầu tiên trong mảng trả về

                // Đổ dữ liệu vào các ô input của Form Sửa
                document.getElementById('editEmployeeId').value = emp.EmployeeID;
                document.getElementById('editFullName').value = emp.FullName;
                document.getElementById('editRole').value = emp.Role;
                document.getElementById('editPhone').value = emp.Phone;
                document.getElementById('editEmail').value = emp.Email;

                // Dùng lệnh của Bootstrap để gọi cái Modal bật lên
                var editModal = new bootstrap.Modal(document.getElementById('editEmployeeModal'));
                editModal.show();
            } else {
                alert("Không tìm thấy thông tin nhân viên này trong CSDL!");
            }
        })
        .catch(error => console.error('Lỗi lấy thông tin:', error));
}

// 2. Hàm Lưu thay đổi khi bấm nút "Lưu Thay Đổi"
function submitEditEmployee() {
    // Lấy ID bị ẩn ra để biết đang sửa nhân viên nào
    let id = document.getElementById('editEmployeeId').value;

    // Gom dữ liệu mới trên form thành JSON
    const updateData = {
        FullName: document.getElementById('editFullName').value,
        Role: document.getElementById('editRole').value,
        Phone: document.getElementById('editPhone').value,
        Email: document.getElementById('editEmail').value
    };

    // Bắn API Update (PUT) sang Python
    fetch(`http://127.0.0.1:5000/employees/update/${id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
    })
        .then(response => {
            return response.json().then(data => ({ status: response.status, body: data }));
        })
        .then(result => {
            if (result.status === 200) {
                alert("Cập nhật thông tin thành công!");

                // Tắt Modal Sửa đi
                var myModalEl = document.getElementById('editEmployeeModal');
                var modal = bootstrap.Modal.getInstance(myModalEl);
                modal.hide();

                // Load lại bảng để thấy chữ mới vừa sửa
                loadEmployees();
            } else {
                alert("Lỗi khi cập nhật: " + (result.body.mess || result.body.error));
            }
        })
        .catch(error => {
            console.error('Lỗi khi Update:', error);
            alert("Lỗi kết nối Server Python!");
        });
}