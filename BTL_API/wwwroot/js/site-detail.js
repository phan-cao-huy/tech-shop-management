/* ===== CellTech Store — Product Detail, Variant Selection, Gallery ===== */

async function loadProductDetail(productId) {
    const container = document.getElementById('productDetail');
    if (!container || !productId) return;

    container.innerHTML = '<div class="spinner"></div>';

    try {
        const [product, variants] = await Promise.all([
            apiFetch('/products/' + encodeURIComponent(productId)),
            apiFetch('/products/' + encodeURIComponent(productId) + '/variants')
        ]);

        if (!product || (Array.isArray(product) && product.length === 0)) {
            container.innerHTML = '<p class="text-muted" style="text-align:center;padding:3rem">Không tìm thấy sản phẩm.</p>';
            return;
        }

        const prod = Array.isArray(product) ? product[0] : product;
        const variantList = Array.isArray(variants) ? variants : [];

        // Extract specs from product (keys that aren't standard columns)
        const standardKeys = ['ProductID', 'ProductName', 'Brand', 'Images', 'CategoryID', 'Information'];
        const specs = {};
        Object.keys(prod).forEach(k => {
            if (!standardKeys.includes(k) && prod[k] != null && prod[k] !== '') {
                specs[k] = prod[k];
            }
        });

        // Build gallery images: product images + unique variant images
        const productImages = parseImages(prod.Images);
        const variantImages = variantList.map(v => v.Image).filter(Boolean);
        const allImagesSet = new Set();
        const allImages = [];
        [...productImages, ...variantImages].forEach(img => {
            if (img && !allImagesSet.has(img)) {
                allImagesSet.add(img);
                allImages.push(img);
            }
        });
        if (allImages.length === 0) allImages.push(PLACEHOLDER_IMG);

        window._galleryImages = allImages;
        window._galleryIndex = 0;

        // Default to first variant
        const defaultVariant = variantList.length > 0 ? variantList[0] : null;
        const defaultImg = defaultVariant && defaultVariant.Image ? defaultVariant.Image : allImages[0];
        const defaultImgIdx = allImages.indexOf(defaultImg);
        if (defaultImgIdx >= 0) window._galleryIndex = defaultImgIdx;

        let specsHtml = '';
        if (Object.keys(specs).length > 0) {
            specsHtml = '<table class="specs-table">' +
                Object.entries(specs).map(([k, v]) => {
                    if (typeof v === 'object') {
                        return Object.entries(v).map(([sk, sv]) =>
                            `<tr><th>${escapeHtml(sk)}</th><td>${escapeHtmlWithBreaks(String(sv))}</td></tr>`
                        ).join('');
                    }
                    return `<tr><th>${escapeHtml(k)}</th><td>${escapeHtmlWithBreaks(String(v))}</td></tr>`;
                }).join('') +
                '</table>';
        }

        const thumbsHtml = allImages.map((img, i) =>
            `<img class="gallery-thumb ${i === window._galleryIndex ? 'active' : ''}" src="${escapeHtml(img)}" alt="" onclick="gallerySelect(${i})" onerror="this.src='${PLACEHOLDER_IMG}'">`
        ).join('');

        container.innerHTML = `
        <div class="row g-4">
            <div class="col-md-5">
                <div class="detail-gallery">
                    <div class="gallery-main">
                        ${allImages.length > 1 ? '<button class="gallery-nav gallery-prev" onclick="galleryPrev()"><i class="bi bi-chevron-left"></i></button>' : ''}
                        <img id="detailMainImg" src="${escapeHtml(allImages[window._galleryIndex])}" alt="${escapeHtml(prod.ProductName)}" onerror="this.src='${PLACEHOLDER_IMG}'">
                        ${allImages.length > 1 ? '<button class="gallery-nav gallery-next" onclick="galleryNext()"><i class="bi bi-chevron-right"></i></button>' : ''}
                    </div>
                    ${allImages.length > 1 ? '<div class="gallery-thumbs" id="galleryThumbs">' + thumbsHtml + '</div>' : ''}
                </div>
            </div>
            <div class="col-md-7">
                <div class="detail-info">
                    <div class="detail-brand">${escapeHtml(prod.Brand || '')}</div>
                    <h1 class="detail-name">${escapeHtml(prod.ProductName)}</h1>
                    <div class="detail-price" id="detailPrice">${defaultVariant ? formatPrice(defaultVariant.SellingPrice) : 'Liên hệ'}</div>

                    ${variantList.length > 0 ? (() => {
                        // Group variants by version (Note field = Description)
                        const versions = [];
                        const versionMap = {};
                        variantList.forEach((v, i) => {
                            const ver = v.Note || v.Description || '';
                            if (!versionMap[ver]) {
                                versionMap[ver] = [];
                                versions.push(ver);
                            }
                            versionMap[ver].push({ variant: v, idx: i });
                        });
                        const hasVersions = versions.length > 1 || (versions.length === 1 && versions[0] !== '');

                        // Get colors for the first version
                        const firstVersionVariants = versionMap[versions[0]] || [];
                        const defaultVerColors = firstVersionVariants.map(item => ({
                            color: item.variant.Color || 'Mặc định',
                            idx: item.idx,
                            stock: item.variant.StockQuantity || 0
                        }));

                        let html = '<div class="variant-selector">';
                        if (hasVersions) {
                            html += '<div class="variant-label">Phiên bản</div>';
                            html += '<div class="variant-options" id="versionOptions">';
                            html += versions.map((ver, vi) => {
                                const verVariants = versionMap[ver];
                                const allOutOfStock = verVariants.every(item => (item.variant.StockQuantity || 0) <= 0);
                                return `<button class="variant-option ${vi === 0 ? 'active' : ''} ${allOutOfStock ? 'out-of-stock' : ''}"
                                    data-version="${escapeHtml(ver)}"
                                    ${allOutOfStock ? 'title="Hết hàng"' : ''}>
                                    ${escapeHtml(ver || 'Mặc định')}
                                </button>`;
                            }).join('');
                            html += '</div>';
                        }
                        // Color selector
                        const showColors = defaultVerColors.length > 1 || !hasVersions;
                        html += '<div class="variant-label" style="margin-top:.75rem">Màu sắc</div>';
                        html += '<div class="variant-options" id="variantOptions">';
                        html += defaultVerColors.map((c, ci) => `
                            <button class="variant-option ${ci === 0 ? 'active' : ''} ${c.stock <= 0 ? 'out-of-stock' : ''}"
                                data-idx="${c.idx}"
                                ${c.stock <= 0 ? 'title="Hết hàng"' : ''}>
                                ${escapeHtml(c.color)}
                            </button>
                        `).join('');
                        html += '</div></div>';
                        return html;
                    })() : ''}

                    <div class="stock-info ${defaultVariant && defaultVariant.StockQuantity > 0 ? 'in-stock' : 'out-of-stock'}" id="stockInfo" style="${defaultVariant && !defaultVariant.SellingPrice ? 'display:none' : ''}">
                        <i class="bi ${defaultVariant && defaultVariant.StockQuantity > 0 ? 'bi-check-circle-fill' : 'bi-x-circle-fill'}"></i>
                        <span id="stockText">${defaultVariant ? (defaultVariant.StockQuantity > 0 ? 'Còn ' + defaultVariant.StockQuantity + ' sản phẩm' : 'Hết hàng') : 'Không có phiên bản'}</span>
                    </div>

                    <div class="contact-price-box" id="contactPriceBox" style="${!defaultVariant || defaultVariant.SellingPrice ? 'display:none' : ''}">
                        <i class="bi bi-telephone-fill"></i>
                        <div>
                            <div class="contact-price-title">Liên hệ để biết giá</div>
                            <div class="contact-price-desc">Vui lòng gọi <a href="tel:19001234"><strong>1900 1234</strong></a> để được tư vấn và báo giá tốt nhất.</div>
                        </div>
                    </div>

                    <div class="qty-selector" id="qtySelector" style="${!defaultVariant || defaultVariant.StockQuantity <= 0 || !defaultVariant.SellingPrice ? 'display:none' : ''}">
                        <button class="qty-btn" onclick="changeQty(-1)">−</button>
                        <input type="number" class="qty-input" id="qtyInput" value="1" min="1" max="${defaultVariant ? defaultVariant.StockQuantity : 1}" oninput="clampQtyInput(this)">
                        <button class="qty-btn" onclick="changeQty(1)">+</button>
                    </div>

                    <button class="btn-add-cart" id="btnAddCart" ${!defaultVariant || defaultVariant.StockQuantity <= 0 || !defaultVariant.SellingPrice ? 'disabled' : ''}>
                        <i class="bi bi-cart-plus"></i>
                        ${!defaultVariant ? 'Hết hàng' : !defaultVariant.SellingPrice ? 'Giá liên hệ' : defaultVariant.StockQuantity <= 0 ? 'Hết hàng' : 'Thêm vào giỏ hàng'}
                    </button>

                    ${specsHtml ? '<h3 style="margin-top:2rem;font-size:1.1rem;font-weight:600">Thông số kỹ thuật</h3>' + specsHtml : ''}
                </div>
            </div>
        </div>`;

        // Store variants and version map for interaction
        window._detailVariants = variantList;
        window._detailProduct = prod;
        // Build version map
        window._versionMap = {};
        variantList.forEach((v, i) => {
            const ver = v.Note || v.Description || '';
            if (!window._versionMap[ver]) window._versionMap[ver] = [];
            window._versionMap[ver].push({ variant: v, idx: i });
        });

        // Version selection
        const versionContainer = document.getElementById('versionOptions');
        if (versionContainer) {
            versionContainer.addEventListener('click', e => {
                const btn = e.target.closest('.variant-option');
                if (!btn || btn.classList.contains('out-of-stock')) return;
                versionContainer.querySelectorAll('.variant-option').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const ver = btn.dataset.version;
                updateColorOptions(ver);
            });
        }

        // Variant color selection
        const optionsContainer = document.getElementById('variantOptions');
        if (optionsContainer) {
            optionsContainer.addEventListener('click', e => {
                const btn = e.target.closest('.variant-option');
                if (!btn || btn.classList.contains('out-of-stock')) return;
                optionsContainer.querySelectorAll('.variant-option').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const idx = parseInt(btn.dataset.idx);
                selectVariant(idx);
            });
        }

        // Add to cart
        document.getElementById('btnAddCart').addEventListener('click', () => {
            const activeBtn = document.querySelector('#variantOptions .variant-option.active');
            const idx = activeBtn ? parseInt(activeBtn.dataset.idx) : 0;
            const v = window._detailVariants[idx];
            if (!v || v.StockQuantity <= 0) return;

            const maxStock = v.StockQuantity;
            let qty = parseInt(document.getElementById('qtyInput').value) || 1;
            qty = Math.max(1, Math.min(qty, maxStock));

            const img = v.Image || getFirstImage(prod.Images) || PLACEHOLDER_IMG;
            const cart = getCart();
            const existing = cart.find(c => c.variantId === v.ProductVariantID);
            if (existing) {
                const maxAdd = maxStock - existing.qty;
                if (maxAdd <= 0) {
                    showToast('Đã đạt số lượng tối đa có sẵn!', 'warning');
                    return;
                }
                const addQty = Math.min(qty, maxAdd);
                existing.qty += addQty;
                if (addQty < qty) {
                    showToast(`Chỉ thêm được ${addQty} sản phẩm (đã có ${existing.qty - addQty} trong giỏ)`, 'warning');
                } else {
                    showToast('Đã cập nhật giỏ hàng!', 'success');
                }
            } else {
                if (!isLoggedIn()) { requireLogin(); return; }
                cart.push({
                    variantId: v.ProductVariantID,
                    productId: prod.ProductID,
                    name: prod.ProductName,
                    color: v.Color || '',
                    price: Number(v.SellingPrice),
                    image: img,
                    qty: qty,
                    maxStock: maxStock
                });
                showToast('Đã thêm vào giỏ hàng!', 'success');
            }
            saveCart(cart);
        });

    } catch (err) {
        console.error(err);
        container.innerHTML = '<p class="text-muted" style="text-align:center;padding:3rem">Không thể tải thông tin sản phẩm.</p>';
    }
}

function updateColorOptions(version) {
    const colorContainer = document.getElementById('variantOptions');
    if (!colorContainer || !window._versionMap) return;
    const items = window._versionMap[version] || [];
    colorContainer.innerHTML = items.map((item, ci) => `
        <button class="variant-option ${ci === 0 ? 'active' : ''} ${(item.variant.StockQuantity || 0) <= 0 ? 'out-of-stock' : ''}"
            data-idx="${item.idx}"
            ${(item.variant.StockQuantity || 0) <= 0 ? 'title="Hết hàng"' : ''}>
            ${escapeHtml(item.variant.Color || 'Mặc định')}
        </button>
    `).join('');
    // Re-attach click handler
    colorContainer.addEventListener('click', e => {
        const btn = e.target.closest('.variant-option');
        if (!btn || btn.classList.contains('out-of-stock')) return;
        colorContainer.querySelectorAll('.variant-option').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const idx = parseInt(btn.dataset.idx);
        selectVariant(idx);
    });
    // Select first available variant in this version
    const firstAvailable = items.find(item => (item.variant.StockQuantity || 0) > 0);
    if (firstAvailable) {
        selectVariant(firstAvailable.idx);
    } else if (items.length > 0) {
        selectVariant(items[0].idx);
    }
}

function selectVariant(idx) {
    const v = window._detailVariants[idx];
    if (!v) return;

    document.getElementById('detailPrice').textContent = formatPrice(v.SellingPrice);

    const stockInfo = document.getElementById('stockInfo');
    const stockText = document.getElementById('stockText');
    const btnAdd = document.getElementById('btnAddCart');
    const qtySel = document.getElementById('qtySelector');
    const qtyInput = document.getElementById('qtyInput');

    const contactBox = document.getElementById('contactPriceBox');
    const isContactPrice = !v.SellingPrice;

    if (isContactPrice) {
        stockInfo.style.display = 'none';
        btnAdd.disabled = true;
        btnAdd.innerHTML = '<i class="bi bi-telephone"></i> Giá liên hệ';
        qtySel.style.display = 'none';
        if (contactBox) contactBox.style.display = '';
    } else if (v.StockQuantity > 0) {
        stockInfo.style.display = '';
        stockInfo.className = 'stock-info in-stock';
        stockInfo.querySelector('i').className = 'bi bi-check-circle-fill';
        stockText.textContent = 'Còn ' + v.StockQuantity + ' sản phẩm';
        btnAdd.disabled = false;
        btnAdd.innerHTML = '<i class="bi bi-cart-plus"></i> Thêm vào giỏ hàng';
        qtySel.style.display = '';
        qtyInput.max = v.StockQuantity;
        qtyInput.value = 1;
        if (contactBox) contactBox.style.display = 'none';
    } else {
        stockInfo.style.display = '';
        stockInfo.className = 'stock-info out-of-stock';
        stockInfo.querySelector('i').className = 'bi bi-x-circle-fill';
        stockText.textContent = 'Hết hàng';
        btnAdd.disabled = true;
        btnAdd.innerHTML = '<i class="bi bi-cart-plus"></i> Hết hàng';
        qtySel.style.display = 'none';
        if (contactBox) contactBox.style.display = 'none';
    }

    // Switch gallery to variant image
    if (v.Image && window._galleryImages) {
        const imgIdx = window._galleryImages.indexOf(v.Image);
        if (imgIdx >= 0) {
            gallerySelect(imgIdx);
        } else {
            document.getElementById('detailMainImg').src = v.Image;
        }
    }
}

function changeQty(delta) {
    const input = document.getElementById('qtyInput');
    if (!input) return;
    let val = parseInt(input.value) || 1;
    val = Math.max(1, Math.min(val + delta, parseInt(input.max) || 99));
    input.value = val;
}

function clampQtyInput(input) {
    let val = parseInt(input.value);
    const max = parseInt(input.max) || 1;
    if (isNaN(val) || val < 1) input.value = 1;
    else if (val > max) input.value = max;
}

// ======================= IMAGE GALLERY =======================

function gallerySelect(idx) {
    if (!window._galleryImages || idx < 0 || idx >= window._galleryImages.length) return;
    window._galleryIndex = idx;
    document.getElementById('detailMainImg').src = window._galleryImages[idx];
    document.querySelectorAll('.gallery-thumb').forEach((t, i) => {
        t.classList.toggle('active', i === idx);
    });
}

function galleryPrev() {
    if (!window._galleryImages) return;
    const idx = (window._galleryIndex - 1 + window._galleryImages.length) % window._galleryImages.length;
    gallerySelect(idx);
}

function galleryNext() {
    if (!window._galleryImages) return;
    const idx = (window._galleryIndex + 1) % window._galleryImages.length;
    gallerySelect(idx);
}
