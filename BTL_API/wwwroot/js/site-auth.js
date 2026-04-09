/* ===== CellTech Store — Auth ===== */

function isLoggedIn() { return !!localStorage.getItem('AccountID'); }
function getAccountID() { return localStorage.getItem('AccountID'); }
function getRole() { return localStorage.getItem('Role'); }
function getCustomerID() { return localStorage.getItem('CustomerID'); }

async function fetchAndStoreCustomerID() {
    const accId = getAccountID();
    if (!accId) return null;
    try {
        const res = await fetch(`${API}/accounts/${encodeURIComponent(accId)}`);
        const data = await res.json();
        const acc = Array.isArray(data) ? data[0] : data;
        if (acc && acc.CustomerID) {
            localStorage.setItem('CustomerID', acc.CustomerID);
            return acc.CustomerID;
        }
    } catch (e) { console.error('Failed to fetch CustomerID:', e); }
    return null;
}

function logout() {
    if (confirm('Bạn có chắc chắn muốn đăng xuất?')) {
        localStorage.removeItem('AccountID');
        localStorage.removeItem('Role');
        localStorage.removeItem('CustomerID');
        window.location.href = '/';
    }
}

function requireLogin(redirectTo) {
    if (!isLoggedIn()) {
        sessionStorage.setItem('redirectAfterLogin', redirectTo || window.location.pathname);
        window.location.href = '/Login/Index';
        return false;
    }
    return true;
}
