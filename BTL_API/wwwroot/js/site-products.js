/* ===== CellTech Store — Product Listing, Filters, Featured, Search ===== */

const PRODUCTS_PER_PAGE = 12;
let _currentPage = 1;
let _filteredProducts = [];
let _productsLoading = null;

function buildProductList(products, variants) {
    const variantMap = {};
    (Array.isArray(variants) ? variants : []).forEach(v => {
        const pid = v.ProductID;
        if (!variantMap[pid]) variantMap[pid] = [];
        variantMap[pid].push(v);
    });
    return (Array.isArray(products) ? products : []).map(p => {
        const pvs = variantMap[p.ProductID] || [];
        const prices = pvs.map(v => v.SellingPrice).filter(x => x != null);
        const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
        const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
        const totalStock = pvs.reduce((s, v) => s + (v.StockQuantity || 0), 0);
        const colors = [...new Set(pvs.map(v => v.Color).filter(Boolean))];
        const img = getFirstImage(p.Images) || (pvs.length > 0 ? pvs[0].Image : null);
        return { ...p, variants: pvs, minPrice, maxPrice, totalStock, colors, displayImage: img };
    });
}

async function ensureProductsLoaded() {
    if (window._allProducts) return window._allProducts;
    if (_productsLoading) return _productsLoading;
    _productsLoading = (async () => {
        const [products, variants] = await Promise.all([
            apiFetch('/products/getall'),
            apiFetch('/variants/getall')
        ]);
        window._allProducts = buildProductList(products, variants);
        return window._allProducts;
    })();
    return _productsLoading;
}

// ======================= FEATURED PRODUCTS BANNER =======================

async function loadFeaturedProducts() {
    const container = document.getElementById('featuredScroll');
    if (!container) return;

    try {
        const featured = await apiFetch('/reports/featured-products');
        if (!Array.isArray(featured) || featured.length === 0) {
            container.closest('.featured-banner').style.display = 'none';
            return;
        }

        container.innerHTML = featured.map((p, idx) => {
            const img = getFirstImage(p.Images) || PLACEHOLDER_IMG;
            const priceText = p.MinPrice === p.MaxPrice
                ? formatPrice(p.MinPrice)
                : formatPrice(p.MinPrice) + ' – ' + formatPrice(p.MaxPrice);
            const rankClass = idx < 3 ? `rank-${idx + 1}` : 'rank-other';

            return `
            <div class="featured-card" onclick="window.location.href='/Product/Detail?id=${encodeURIComponent(p.ProductID)}'">
                <span class="featured-card-rank ${rankClass}">${idx + 1}</span>
                <div class="featured-card-img">
                    <img src="${escapeHtml(img)}" alt="${escapeHtml(p.ProductName)}" onerror="this.src='${PLACEHOLDER_IMG}'" loading="lazy">
                    <span class="featured-badge"><i class="bi bi-fire"></i> ${p.TotalSold} đã bán</span>
                </div>
                <div class="featured-card-body">
                    <div class="featured-card-brand">${escapeHtml(p.Brand || '')}</div>
                    <div class="featured-card-name">${escapeHtml(p.ProductName)}</div>
                    <div class="featured-card-price">${priceText}</div>
                </div>
            </div>`;
        }).join('');

    } catch (err) {
        console.error('Failed to load featured products:', err);
        container.closest('.featured-banner').style.display = 'none';
    }
}

// ======================= PRODUCT LISTING (Home/Index) =======================

let _allCategoryProducts = []; // products filtered by current category

async function loadStorefront() {
    const grid = document.getElementById('productGrid');
    const pillsContainer = document.getElementById('categoryPills');
    if (!grid) return;

    renderSkeletons(grid, 8);

    try {
        const [productList, categories] = await Promise.all([
            ensureProductsLoaded(),
            apiFetch('/categories/getall').catch(() => [])
        ]);

        // Render categories
        if (pillsContainer && Array.isArray(categories) && categories.length > 0) {
            let pillsHtml = '<button class="category-pill active" data-cat="all">Tất cả</button>';
            categories.forEach(c => {
                pillsHtml += `<button class="category-pill" data-cat="${escapeHtml(c.CategoryID)}">${escapeHtml(c.Name)}</button>`;
            });
            pillsContainer.innerHTML = pillsHtml;

            pillsContainer.addEventListener('click', e => {
                const pill = e.target.closest('.category-pill');
                if (!pill) return;
                pillsContainer.querySelectorAll('.category-pill').forEach(p => p.classList.remove('active'));
                pill.classList.add('active');
                const cat = pill.dataset.cat;
                _allCategoryProducts = cat === 'all' ? productList : productList.filter(p => p.CategoryID === cat);
                populateBrandFilter(_allCategoryProducts);
                applyAdvancedFilters();
            });
        }

        _allCategoryProducts = productList;
        populateBrandFilter(productList);
        initFilterListeners();
        applyAdvancedFilters();

    } catch (err) {
        console.error(err);
        grid.innerHTML = '<p class="text-muted" style="grid-column:1/-1;text-align:center;padding:3rem">Không thể tải sản phẩm. Vui lòng kiểm tra kết nối.</p>';
    }
}

function populateBrandFilter(products) {
    const select = document.getElementById('filterBrand');
    if (!select) return;
    const brands = [...new Set((products || []).map(p => p.Brand).filter(Boolean))].sort();
    const prev = select.value;
    select.innerHTML = '<option value="all">Tất cả</option>';
    brands.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b;
        opt.textContent = b;
        select.appendChild(opt);
    });
    // keep previous selection if still valid
    if (brands.includes(prev)) select.value = prev;
    else select.value = 'all';
}

function initFilterListeners() {
    const sortEl = document.getElementById('filterSort');
    const brandEl = document.getElementById('filterBrand');
    const priceMinEl = document.getElementById('filterPriceMin');
    const priceMaxEl = document.getElementById('filterPriceMax');
    const inStockEl = document.getElementById('filterInStock');
    const resetBtn = document.getElementById('filterResetBtn');

    if (sortEl) sortEl.addEventListener('change', () => applyAdvancedFilters());
    if (brandEl) brandEl.addEventListener('change', () => applyAdvancedFilters());
    if (inStockEl) inStockEl.addEventListener('change', () => applyAdvancedFilters());

    let priceTimer;
    const debouncedFilter = () => { clearTimeout(priceTimer); priceTimer = setTimeout(() => applyAdvancedFilters(), 400); };
    if (priceMinEl) priceMinEl.addEventListener('input', debouncedFilter);
    if (priceMaxEl) priceMaxEl.addEventListener('input', debouncedFilter);

    if (resetBtn) resetBtn.addEventListener('click', resetFilters);
}

function resetFilters() {
    const sortEl = document.getElementById('filterSort');
    const brandEl = document.getElementById('filterBrand');
    const priceMinEl = document.getElementById('filterPriceMin');
    const priceMaxEl = document.getElementById('filterPriceMax');
    const inStockEl = document.getElementById('filterInStock');
    if (sortEl) sortEl.value = 'default';
    if (brandEl) brandEl.value = 'all';
    if (priceMinEl) priceMinEl.value = '';
    if (priceMaxEl) priceMaxEl.value = '';
    if (inStockEl) inStockEl.checked = false;
    applyAdvancedFilters();
}

function applyAdvancedFilters() {
    let products = [..._allCategoryProducts];

    // Brand filter (dropdown)
    const selectedBrand = document.getElementById('filterBrand')?.value;
    if (selectedBrand && selectedBrand !== 'all') {
        products = products.filter(p => p.Brand === selectedBrand);
    }

    // Price range
    const minVal = parseFloat(document.getElementById('filterPriceMin')?.value);
    const maxVal = parseFloat(document.getElementById('filterPriceMax')?.value);
    if (!isNaN(minVal) && minVal > 0) {
        products = products.filter(p => p.maxPrice >= minVal);
    }
    if (!isNaN(maxVal) && maxVal > 0) {
        products = products.filter(p => p.minPrice <= maxVal);
    }

    // In-stock only
    if (document.getElementById('filterInStock')?.checked) {
        products = products.filter(p => p.totalStock > 0);
    }

    // Sort
    const sort = document.getElementById('filterSort')?.value || 'default';
    switch (sort) {
        case 'price-asc':
            products.sort((a, b) => a.minPrice - b.minPrice);
            break;
        case 'price-desc':
            products.sort((a, b) => b.maxPrice - a.maxPrice);
            break;
        case 'name-asc':
            products.sort((a, b) => (a.ProductName || '').localeCompare(b.ProductName || '', 'vi'));
            break;
        case 'name-desc':
            products.sort((a, b) => (b.ProductName || '').localeCompare(a.ProductName || '', 'vi'));
            break;
    }

    // Update result count
    const countEl = document.getElementById('filterResultCount');
    if (countEl) {
        const total = _allCategoryProducts.length;
        if (products.length === total) {
            countEl.textContent = '';
        } else {
            countEl.textContent = `Hiển thị ${products.length} / ${total} sản phẩm`;
        }
    }

    renderProducts(products);
}

function renderProducts(products) {
    _filteredProducts = products || [];
    _currentPage = 1;
    renderProductPage();
}

function renderProductPage() {
    const grid = document.getElementById('productGrid');
    if (!grid) return;

    if (!_filteredProducts || _filteredProducts.length === 0) {
        grid.innerHTML = '<p class="text-muted" style="grid-column:1/-1;text-align:center;padding:3rem">Không tìm thấy sản phẩm nào.</p>';
        removeLoadMore();
        return;
    }

    const end = _currentPage * PRODUCTS_PER_PAGE;
    const visible = _filteredProducts.slice(0, end);

    grid.innerHTML = visible.map(p => {
        const outOfStock = p.totalStock <= 0;
        const img = p.displayImage || PLACEHOLDER_IMG;
        const priceText = p.minPrice === p.maxPrice
            ? formatPrice(p.minPrice)
            : formatPrice(p.minPrice) + ' – ' + formatPrice(p.maxPrice);

        return `
        <div class="product-card ${outOfStock ? 'out-of-stock' : ''}" onclick="window.location.href='/Product/Detail?id=${encodeURIComponent(p.ProductID)}'">
            <div class="product-card-img">
                ${outOfStock ? '<span class="badge-stock badge-out-of-stock">Hết hàng</span>' : ''}
                <img src="${escapeHtml(img)}" alt="${escapeHtml(p.ProductName)}" onerror="this.src='${PLACEHOLDER_IMG}'" loading="lazy">
            </div>
            <div class="product-card-body">
                <div class="product-card-brand">${escapeHtml(p.Brand || '')}</div>
                <div class="product-card-name">${escapeHtml(p.ProductName)}</div>
                <div class="product-card-price">${priceText}</div>
            </div>
        </div>`;
    }).join('');

    if (end < _filteredProducts.length) {
        showLoadMore();
    } else {
        removeLoadMore();
    }
}

function showLoadMore() {
    let btn = document.getElementById('loadMoreBtn');
    if (!btn) {
        btn = document.createElement('div');
        btn.id = 'loadMoreBtn';
        btn.className = 'load-more-container';
        btn.innerHTML = '<button class="btn-load-more" onclick="loadMoreProducts()"></button>';
        const grid = document.getElementById('productGrid');
        grid.parentNode.insertBefore(btn, grid.nextSibling);
    }
    const remaining = _filteredProducts.length - _currentPage * PRODUCTS_PER_PAGE;
    btn.querySelector('button').innerHTML = `<i class="bi bi-plus-circle"></i> Xem thêm (${remaining} sản phẩm)`;
    btn.style.display = '';
}

function removeLoadMore() {
    const btn = document.getElementById('loadMoreBtn');
    if (btn) btn.style.display = 'none';
}

function loadMoreProducts() {
    _currentPage++;
    renderProductPage();
}

// ======================= LIVE SEARCH =======================

async function liveSearch(keyword) {
    const dropdown = document.getElementById('searchDropdown');
    if (!dropdown) return;

    keyword = keyword.toLowerCase();
    dropdown.innerHTML = '<div class="search-loading"><div class="spinner" style="width:24px;height:24px;border-width:2px"></div></div>';
    dropdown.classList.add('active');

    try {
        const products = await ensureProductsLoaded();
        const filtered = products.filter(p =>
            (p.ProductName || '').toLowerCase().includes(keyword) ||
            (p.Brand || '').toLowerCase().includes(keyword)
        ).slice(0, 8);

        if (filtered.length === 0) {
            dropdown.innerHTML = '<div class="search-empty">Không tìm thấy sản phẩm nào</div>';
            return;
        }

        dropdown.innerHTML = filtered.map(p => {
            const img = p.displayImage || PLACEHOLDER_IMG;
            const priceText = p.minPrice === p.maxPrice
                ? formatPrice(p.minPrice)
                : formatPrice(p.minPrice) + ' – ' + formatPrice(p.maxPrice);
            const outOfStock = p.totalStock <= 0;

            return `
            <a class="search-result-item ${outOfStock ? 'out-of-stock' : ''}" href="/Product/Detail?id=${encodeURIComponent(p.ProductID)}">
                <img src="${escapeHtml(img)}" alt="" onerror="this.src='${PLACEHOLDER_IMG}'">
                <div class="search-result-info">
                    <div class="search-result-name">${escapeHtml(p.ProductName)}</div>
                    <div class="search-result-price">${priceText}</div>
                    ${outOfStock ? '<span class="search-result-stock">Hết hàng</span>' : ''}
                </div>
            </a>`;
        }).join('');
    } catch (err) {
        dropdown.innerHTML = '<div class="search-empty">Lỗi tìm kiếm</div>';
    }
}

function hideSearchDropdown() {
    const dropdown = document.getElementById('searchDropdown');
    if (dropdown) {
        dropdown.classList.remove('active');
        dropdown.innerHTML = '';
    }
}
