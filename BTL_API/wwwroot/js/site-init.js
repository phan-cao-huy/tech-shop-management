/* ===== CellTech Store — Init ===== */

document.addEventListener('DOMContentLoaded', () => {
    updateCartBadge();
    updateAuthUI();

    // Fetch CustomerID if logged in and not yet stored
    if (isLoggedIn() && !getCustomerID()) {
        fetchAndStoreCustomerID();
    }

    // Live search
    const headerSearch = document.getElementById('headerSearchInput');
    if (headerSearch) {
        let searchTimeout;
        headerSearch.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            const val = headerSearch.value.trim();
            if (!val) {
                hideSearchDropdown();
                return;
            }
            searchTimeout = setTimeout(() => liveSearch(val), 300);
        });

        // Also trigger on search button click
        const searchBtn = document.getElementById('headerSearchBtn');
        if (searchBtn) {
            searchBtn.addEventListener('click', () => {
                const val = headerSearch.value.trim();
                if (val) liveSearch(val);
            });
        }

        // Close dropdown on click outside
        document.addEventListener('click', e => {
            if (!e.target.closest('.header-search')) {
                hideSearchDropdown();
            }
        });

        // Close on Escape
        headerSearch.addEventListener('keydown', e => {
            if (e.key === 'Escape') {
                hideSearchDropdown();
                headerSearch.blur();
            }
        });
    }
});
