// ===== SushiCost - Maliyet Hesaplama Sistemi =====
// Tüm veriler data.json dosyasına kaydedilir (localStorage kullanılmaz)

(function() {
'use strict';

// ===== DATA STORE =====
let data = { ingredients: [], categories: [], products: [] };
let tempProductIngredients = [];
let deleteCallback = null;

// ===== INIT =====
async function init() {
    await loadData();
    setupNavigation();
    setupIngredientForm();
    setupCategoryForm();
    setupProductForm();
    setupSearch();
    setupModal();
    setupImportExport();
    setupMobile();
    renderAll();
}

// ===== STORAGE (JSON dosyasına okuma/yazma) =====
async function loadData() {
    try {
        const resp = await fetch('/api/data');
        if (resp.ok) {
            data = await resp.json();
        }
    } catch(e) {
        console.error('Veri yükleme hatası:', e);
    }
}

async function saveData() {
    try {
        await fetch('/api/data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    } catch(e) {
        console.error('Veri kaydetme hatası:', e);
        showToast('Veri kaydedilemedi!', 'error');
    }
}

function generateId() { return Date.now().toString(36) + Math.random().toString(36).substr(2, 5); }

// ===== NAVIGATION =====
function setupNavigation() {
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            document.getElementById('page-' + btn.dataset.page).classList.add('active');
            if (btn.dataset.page === 'dashboard') renderDashboard();
            if (btn.dataset.page === 'products') { populateCategorySelects(); populateIngredientSelects(); }
            // Close mobile sidebar
            document.getElementById('sidebar').classList.remove('open');
        });
    });
}

// ===== MOBILE =====
function setupMobile() {
    document.getElementById('hamburger').addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('open');
    });
    document.getElementById('main-content').addEventListener('click', () => {
        document.getElementById('sidebar').classList.remove('open');
    });
}

// ===== TOAST =====
function showToast(msg, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// ===== MODAL =====
function setupModal() {
    const overlay = document.getElementById('modal-overlay');
    document.getElementById('modal-close').addEventListener('click', () => overlay.classList.remove('active'));
    document.getElementById('modal-cancel-btn').addEventListener('click', () => overlay.classList.remove('active'));
    document.getElementById('modal-confirm-btn').addEventListener('click', () => {
        overlay.classList.remove('active');
        if (deleteCallback) { deleteCallback(); deleteCallback = null; }
    });
}
function showConfirm(title, msg, cb) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-msg').textContent = msg;
    deleteCallback = cb;
    document.getElementById('modal-overlay').classList.add('active');
}

// ===== INGREDIENT MANAGEMENT =====
function setupIngredientForm() {
    const form = document.getElementById('ing-form');
    const unitSel = document.getElementById('ing-unit');
    const priceLabel = document.getElementById('ing-price-label');

    unitSel.addEventListener('change', () => {
        const u = unitSel.value;
        priceLabel.textContent = u === 'adet' ? 'Fiyat (₺/adet)' : u === 'lt' ? 'Fiyat (₺/lt)' : 'Fiyat (₺/kg)';
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const editId = document.getElementById('ing-edit-id').value;
        const name = document.getElementById('ing-name').value.trim();
        const unit = unitSel.value;
        const price = parseFloat(document.getElementById('ing-price').value);
        if (!name || isNaN(price) || price < 0) { showToast('Lütfen tüm alanları doldurun.', 'error'); return; }

        if (editId) {
            const ing = data.ingredients.find(i => i.id === editId);
            if (ing) { ing.name = name; ing.unit = unit; ing.price = price; }
            showToast('Malzeme güncellendi!');
            cancelIngredientEdit();
        } else {
            data.ingredients.push({ id: generateId(), name, unit, price });
            showToast('Malzeme eklendi!');
        }
        await saveData(); form.reset(); renderIngredients(); renderDashboard();
        recalculateAllProducts();
    });

    document.getElementById('ing-cancel').addEventListener('click', cancelIngredientEdit);
}

function cancelIngredientEdit() {
    document.getElementById('ing-edit-id').value = '';
    document.getElementById('ing-form').reset();
    document.getElementById('ing-ft-icon').textContent = '➕';
    document.getElementById('ing-ft-text').textContent = 'Yeni Malzeme Ekle';
    document.getElementById('ing-cancel').style.display = 'none';
    document.getElementById('ing-submit').innerHTML = '💾 Kaydet';
}

function editIngredient(id) {
    const ing = data.ingredients.find(i => i.id === id);
    if (!ing) return;
    document.getElementById('ing-edit-id').value = id;
    document.getElementById('ing-name').value = ing.name;
    document.getElementById('ing-unit').value = ing.unit;
    document.getElementById('ing-price').value = ing.price;
    document.getElementById('ing-ft-icon').textContent = '✏️';
    document.getElementById('ing-ft-text').textContent = 'Malzeme Düzenle';
    document.getElementById('ing-cancel').style.display = 'inline-flex';
    document.getElementById('ing-submit').innerHTML = '💾 Güncelle';
    document.getElementById('ing-unit').dispatchEvent(new Event('change'));
    document.getElementById('ing-name').focus();
}

function deleteIngredient(id) {
    const ing = data.ingredients.find(i => i.id === id);
    showConfirm('Malzeme Sil', `"${ing.name}" malzemesini silmek istediğinize emin misiniz?`, async () => {
        data.ingredients = data.ingredients.filter(i => i.id !== id);
        await saveData(); renderIngredients(); renderDashboard();
        showToast('Malzeme silindi.');
    });
}

function renderIngredients(filter = '') {
    const body = document.getElementById('ing-body');
    let items = data.ingredients;
    if (filter) items = items.filter(i => i.name.toLowerCase().includes(filter.toLowerCase()));

    if (!items.length) {
        body.innerHTML = '<tr class="empty-row"><td colspan="5">Malzeme bulunamadı.</td></tr>';
        return;
    }
    body.innerHTML = items.map(i => {
        const smallPrice = i.unit === 'adet' ? '-' : '₺' + (i.price / 1000).toFixed(4);
        const unitLabel = i.unit === 'kg' ? 'Kilogram' : i.unit === 'lt' ? 'Litre' : 'Adet';
        const bigLabel = i.unit === 'adet' ? '₺' + i.price.toFixed(2) + '/adet' : '₺' + i.price.toFixed(2) + '/' + i.unit;
        return `<tr>
            <td><strong>${esc(i.name)}</strong></td>
            <td>${unitLabel}</td>
            <td>${bigLabel}</td>
            <td>${smallPrice}</td>
            <td><div class="table-actions">
                <button class="btn-icon btn-edit" onclick="window.SC.editIng('${i.id}')" title="Düzenle">✏️</button>
                <button class="btn-icon btn-delete" onclick="window.SC.deleteIng('${i.id}')" title="Sil">🗑️</button>
            </div></td></tr>`;
    }).join('');
}

// ===== CATEGORY MANAGEMENT =====
function setupCategoryForm() {
    const form = document.getElementById('cat-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const editId = document.getElementById('cat-edit-id').value;
        const name = document.getElementById('cat-name').value.trim();
        const emoji = document.getElementById('cat-emoji').value.trim() || '📋';
        if (!name) { showToast('Kategori adı gerekli!', 'error'); return; }

        if (editId) {
            const cat = data.categories.find(c => c.id === editId);
            if (cat) { cat.name = name; cat.emoji = emoji; }
            showToast('Kategori güncellendi!');
            cancelCategoryEdit();
        } else {
            data.categories.push({ id: generateId(), name, emoji });
            showToast('Kategori eklendi!');
        }
        await saveData(); form.reset(); renderCategories(); populateCategorySelects(); renderDashboard();
    });
    document.getElementById('cat-cancel').addEventListener('click', cancelCategoryEdit);
}

function cancelCategoryEdit() {
    document.getElementById('cat-edit-id').value = '';
    document.getElementById('cat-form').reset();
    document.getElementById('cat-ft-icon').textContent = '➕';
    document.getElementById('cat-ft-text').textContent = 'Yeni Kategori Ekle';
    document.getElementById('cat-cancel').style.display = 'none';
}

function editCategory(id) {
    const cat = data.categories.find(c => c.id === id);
    if (!cat) return;
    document.getElementById('cat-edit-id').value = id;
    document.getElementById('cat-name').value = cat.name;
    document.getElementById('cat-emoji').value = cat.emoji;
    document.getElementById('cat-ft-icon').textContent = '✏️';
    document.getElementById('cat-ft-text').textContent = 'Kategori Düzenle';
    document.getElementById('cat-cancel').style.display = 'inline-flex';
    document.getElementById('cat-name').focus();
}

function deleteCategory(id) {
    const cat = data.categories.find(c => c.id === id);
    const prodCount = data.products.filter(p => p.categoryId === id).length;
    const warn = prodCount > 0 ? ` Bu kategoride ${prodCount} ürün var!` : '';
    showConfirm('Kategori Sil', `"${cat.name}" kategorisini silmek istediğinize emin misiniz?${warn}`, async () => {
        data.categories = data.categories.filter(c => c.id !== id);
        await saveData(); renderCategories(); populateCategorySelects(); renderDashboard();
        showToast('Kategori silindi.');
    });
}

function renderCategories() {
    const grid = document.getElementById('cat-grid');
    if (!data.categories.length) {
        grid.innerHTML = '<div class="empty-state"><span class="empty-icon">📁</span><p>Henüz kategori eklenmedi.</p></div>';
        return;
    }
    grid.innerHTML = data.categories.map(c => {
        const cnt = data.products.filter(p => p.categoryId === c.id).length;
        return `<div class="cat-card">
            <div class="cat-emoji">${c.emoji}</div>
            <div class="cat-info"><h4>${esc(c.name)}</h4><span>${cnt} ürün</span></div>
            <div class="cat-actions">
                <button class="btn-icon btn-edit" onclick="window.SC.editCat('${c.id}')" title="Düzenle">✏️</button>
                <button class="btn-icon btn-delete" onclick="window.SC.deleteCat('${c.id}')" title="Sil">🗑️</button>
            </div></div>`;
    }).join('');
}

// ===== PRODUCT MANAGEMENT =====
function setupProductForm() {
    document.getElementById('btn-add-prod-ing').addEventListener('click', addProductIngredient);

    // Auto-update unit options when ingredient is selected
    document.getElementById('prod-ing-sel').addEventListener('change', () => {
        const ingId = document.getElementById('prod-ing-sel').value;
        const ing = data.ingredients.find(i => i.id === ingId);
        const unitSel = document.getElementById('prod-ing-unit');
        if (ing) {
            if (ing.unit === 'kg') { unitSel.innerHTML = '<option value="gr">gr</option><option value="kg">kg</option>'; }
            else if (ing.unit === 'lt') { unitSel.innerHTML = '<option value="ml">ml</option><option value="lt">lt</option>'; }
            else { unitSel.innerHTML = '<option value="adet">adet</option>'; }
        }
    });

    // Update profit display when selling price changes
    document.getElementById('prod-sell-price').addEventListener('input', updateProfitDisplay);

    document.getElementById('prod-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const editId = document.getElementById('prod-edit-id').value;
        const name = document.getElementById('prod-name').value.trim();
        const catId = document.getElementById('prod-cat').value;
        if (!name) { showToast('Ürün adı gerekli!', 'error'); return; }
        if (!catId) { showToast('Kategori seçin!', 'error'); return; }
        if (!tempProductIngredients.length) { showToast('En az bir malzeme ekleyin!', 'error'); return; }

        const totalCost = calcTotalCost(tempProductIngredients);
        const sellingPrice = parseFloat(document.getElementById('prod-sell-price').value) || 0;

        if (editId) {
            const prod = data.products.find(p => p.id === editId);
            if (prod) { prod.name = name; prod.categoryId = catId; prod.ingredients = [...tempProductIngredients]; prod.totalCost = totalCost; prod.sellingPrice = sellingPrice; }
            showToast('Ürün güncellendi!');
            cancelProductEdit();
        } else {
            data.products.push({ id: generateId(), name, categoryId: catId, ingredients: [...tempProductIngredients], totalCost, sellingPrice });
            showToast('Ürün oluşturuldu!');
        }
        await saveData();
        document.getElementById('prod-form').reset();
        tempProductIngredients = [];
        renderProductIngredients();
        renderProducts();
        renderDashboard();
    });

    document.getElementById('prod-cancel').addEventListener('click', cancelProductEdit);
}

function addProductIngredient() {
    const ingId = document.getElementById('prod-ing-sel').value;
    const amount = parseFloat(document.getElementById('prod-ing-amt').value);
    const unit = document.getElementById('prod-ing-unit').value;

    if (!ingId) { showToast('Malzeme seçin!', 'error'); return; }
    if (!amount || amount <= 0) { showToast('Geçerli bir miktar girin!', 'error'); return; }

    const ing = data.ingredients.find(i => i.id === ingId);
    if (!ing) return;

    // Check if already added
    const existing = tempProductIngredients.find(ti => ti.ingredientId === ingId);
    if (existing) {
        existing.amount = amount;
        existing.unit = unit;
    } else {
        tempProductIngredients.push({ ingredientId: ingId, amount, unit });
    }

    document.getElementById('prod-ing-amt').value = '';
    renderProductIngredients();
}

function removeProductIngredient(idx) {
    tempProductIngredients.splice(idx, 1);
    renderProductIngredients();
}

function calcIngredientCost(ingData, amount, unit) {
    // ingData: { unit: 'kg'|'lt'|'adet', price: number (per kg/lt/adet) }
    // amount: number, unit: 'gr'|'kg'|'ml'|'lt'|'adet'
    if (ingData.unit === 'adet') return ingData.price * amount;
    if (ingData.unit === 'kg') {
        if (unit === 'gr') return (ingData.price / 1000) * amount;
        if (unit === 'kg') return ingData.price * amount;
    }
    if (ingData.unit === 'lt') {
        if (unit === 'ml') return (ingData.price / 1000) * amount;
        if (unit === 'lt') return ingData.price * amount;
    }
    return 0;
}

function calcTotalCost(items) {
    return items.reduce((sum, ti) => {
        const ing = data.ingredients.find(i => i.id === ti.ingredientId);
        if (!ing) return sum;
        return sum + calcIngredientCost(ing, ti.amount, ti.unit);
    }, 0);
}

function renderProductIngredients() {
    const list = document.getElementById('prod-ing-list');
    if (!tempProductIngredients.length) {
        list.innerHTML = '<div class="empty-ing">Henüz malzeme eklenmedi</div>';
        document.getElementById('prod-total-cost').textContent = '₺0.00';
        return;
    }

    let total = 0;
    list.innerHTML = tempProductIngredients.map((ti, idx) => {
        const ing = data.ingredients.find(i => i.id === ti.ingredientId);
        if (!ing) return '';
        const cost = calcIngredientCost(ing, ti.amount, ti.unit);
        total += cost;
        return `<div class="ing-item">
            <div class="ing-item-info">
                <span class="ing-item-name">${esc(ing.name)}</span>
                <span class="ing-item-amount">${ti.amount} ${ti.unit}</span>
            </div>
            <span class="ing-item-cost">₺${cost.toFixed(2)}</span>
            <button class="ing-item-remove" onclick="window.SC.removePI(${idx})">✕</button>
        </div>`;
    }).join('');

    document.getElementById('prod-total-cost').textContent = '₺' + total.toFixed(2);
    updateProfitDisplay();
}

function updateProfitDisplay() {
    const totalCost = calcTotalCost(tempProductIngredients);
    const sellPrice = parseFloat(document.getElementById('prod-sell-price').value) || 0;
    const profit = sellPrice - totalCost;
    const margin = sellPrice > 0 ? (profit / sellPrice) * 100 : 0;
    const cls = profit >= 0 ? 'profit-positive' : 'profit-negative';
    document.getElementById('prod-sell-display').textContent = '₺' + sellPrice.toFixed(2);
    document.getElementById('prod-profit').textContent = '₺' + profit.toFixed(2);
    document.getElementById('prod-profit').className = 'cost-value profit-value ' + cls;
    document.getElementById('prod-margin').textContent = '%' + margin.toFixed(1);
    document.getElementById('prod-margin').className = 'cost-value profit-value ' + cls;
}

function cancelProductEdit() {
    document.getElementById('prod-edit-id').value = '';
    document.getElementById('prod-form').reset();
    tempProductIngredients = [];
    renderProductIngredients();
    document.getElementById('prod-ft-icon').textContent = '➕';
    document.getElementById('prod-ft-text').textContent = 'Yeni Ürün Oluştur';
    document.getElementById('prod-cancel').style.display = 'none';
}

function editProduct(id) {
    const prod = data.products.find(p => p.id === id);
    if (!prod) return;
    populateCategorySelects();
    populateIngredientSelects();
    document.getElementById('prod-edit-id').value = id;
    document.getElementById('prod-name').value = prod.name;
    document.getElementById('prod-cat').value = prod.categoryId;
    document.getElementById('prod-sell-price').value = prod.sellingPrice || '';
    tempProductIngredients = prod.ingredients.map(i => ({...i}));
    renderProductIngredients();
    document.getElementById('prod-ft-icon').textContent = '✏️';
    document.getElementById('prod-ft-text').textContent = 'Ürün Düzenle';
    document.getElementById('prod-cancel').style.display = 'inline-flex';
    document.getElementById('prod-name').focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function deleteProduct(id) {
    const prod = data.products.find(p => p.id === id);
    showConfirm('Ürün Sil', `"${prod.name}" ürününü silmek istediğinize emin misiniz?`, async () => {
        data.products = data.products.filter(p => p.id !== id);
        await saveData(); renderProducts(); renderDashboard();
        showToast('Ürün silindi.');
    });
}

async function recalculateAllProducts() {
    data.products.forEach(p => { p.totalCost = calcTotalCost(p.ingredients); });
    await saveData(); renderProducts(); renderDashboard();
}

function renderProducts(filter = '', catFilter = '') {
    const grid = document.getElementById('prod-grid');
    let items = data.products;
    if (filter) items = items.filter(p => p.name.toLowerCase().includes(filter.toLowerCase()));
    if (catFilter) items = items.filter(p => p.categoryId === catFilter);

    if (!items.length) {
        grid.innerHTML = '<div class="empty-state"><span class="empty-icon">🍱</span><p>Ürün bulunamadı.</p></div>';
        return;
    }

    grid.innerHTML = items.map(p => {
        const cat = data.categories.find(c => c.id === p.categoryId);
        const catName = cat ? cat.emoji + ' ' + cat.name : 'Kategorisiz';
        const ingHtml = p.ingredients.map(ti => {
            const ing = data.ingredients.find(i => i.id === ti.ingredientId);
            if (!ing) return '';
            const cost = calcIngredientCost(ing, ti.amount, ti.unit);
            return `<div class="prod-card-ing"><span>${esc(ing.name)} (${ti.amount}${ti.unit})</span><span>₺${cost.toFixed(2)}</span></div>`;
        }).join('');

        const profit = (p.sellingPrice || 0) - p.totalCost;
        const profitClass = profit >= 0 ? 'profit-pos' : 'profit-neg';
        const profitSection = p.sellingPrice ? `
            <div class="prod-card-profit"><span>Satış: ₺${p.sellingPrice.toFixed(2)}</span><span class="${profitClass}">Kâr: ₺${profit.toFixed(2)}</span></div>` : '';

        return `<div class="prod-card">
            <div class="prod-card-header">
                <div class="prod-card-title"><h4>${esc(p.name)}</h4><span class="prod-card-cat">${catName}</span></div>
                <div class="prod-card-cost"><span class="prod-card-cost-label">Maliyet</span><span class="prod-card-cost-value">₺${p.totalCost.toFixed(2)}</span></div>
            </div>
            <div class="prod-card-body">${ingHtml || '<p style="color:var(--text-muted);font-size:0.82rem;">Malzeme yok</p>'}</div>
            ${profitSection}
            <div class="prod-card-footer">
                <button class="btn-icon btn-edit" onclick="window.SC.editProd('${p.id}')" title="Düzenle">✏️</button>
                <button class="btn-icon btn-delete" onclick="window.SC.deleteProd('${p.id}')" title="Sil">🗑️</button>
            </div></div>`;
    }).join('');
}

// ===== POPULATE SELECTS =====
function populateCategorySelects() {
    const opts = '<option value="">Seçin</option>' + data.categories.map(c => `<option value="${c.id}">${c.emoji} ${esc(c.name)}</option>`).join('');
    document.getElementById('prod-cat').innerHTML = opts;
    const filterOpts = '<option value="">Tüm Kategoriler</option>' + data.categories.map(c => `<option value="${c.id}">${c.emoji} ${esc(c.name)}</option>`).join('');
    document.getElementById('prod-filter-cat').innerHTML = filterOpts;
}

function populateIngredientSelects() {
    const opts = '<option value="">Seçin</option>' + data.ingredients.map(i => `<option value="${i.id}">${esc(i.name)} (₺${i.price.toFixed(2)}/${i.unit})</option>`).join('');
    document.getElementById('prod-ing-sel').innerHTML = opts;
}

// ===== SEARCH =====
function setupSearch() {
    document.getElementById('ing-search').addEventListener('input', (e) => renderIngredients(e.target.value));
    document.getElementById('prod-search').addEventListener('input', (e) => renderProducts(e.target.value, document.getElementById('prod-filter-cat').value));
    document.getElementById('prod-filter-cat').addEventListener('change', (e) => renderProducts(document.getElementById('prod-search').value, e.target.value));
}

// ===== DASHBOARD =====
function renderDashboard() {
    document.getElementById('stat-ingredients').textContent = data.ingredients.length;
    document.getElementById('stat-categories').textContent = data.categories.length;
    document.getElementById('stat-products').textContent = data.products.length;

    const avg = data.products.length ? data.products.reduce((s, p) => s + p.totalCost, 0) / data.products.length : 0;
    document.getElementById('stat-avg').textContent = '₺' + avg.toFixed(2);

    // Products table
    const pb = document.getElementById('dash-products-body');
    if (!data.products.length) {
        pb.innerHTML = '<tr class="empty-row"><td colspan="4">Henüz ürün eklenmedi.</td></tr>';
    } else {
        const sorted = [...data.products].sort((a, b) => b.totalCost - a.totalCost);
        pb.innerHTML = sorted.map(p => {
            const cat = data.categories.find(c => c.id === p.categoryId);
            return `<tr><td><strong>${esc(p.name)}</strong></td><td>${cat ? cat.emoji + ' ' + esc(cat.name) : '-'}</td><td>${p.ingredients.length}</td><td><strong style="color:var(--success)">₺${p.totalCost.toFixed(2)}</strong></td></tr>`;
        }).join('');
    }

    // Top ingredients
    const ib = document.getElementById('dash-ing-body');
    if (!data.ingredients.length) {
        ib.innerHTML = '<tr class="empty-row"><td colspan="4">Henüz malzeme eklenmedi.</td></tr>';
    } else {
        const sorted = [...data.ingredients].sort((a, b) => b.price - a.price).slice(0, 10);
        ib.innerHTML = sorted.map(i => {
            const unitLabel = i.unit === 'kg' ? 'Kilogram' : i.unit === 'lt' ? 'Litre' : 'Adet';
            const bigPrice = '₺' + i.price.toFixed(2) + '/' + i.unit;
            const smallPrice = i.unit === 'adet' ? '-' : '₺' + (i.price / 1000).toFixed(4);
            return `<tr><td><strong>${esc(i.name)}</strong></td><td>${unitLabel}</td><td>${bigPrice}</td><td>${smallPrice}</td></tr>`;
        }).join('');
    }
}

// ===== IMPORT / EXPORT =====
function setupImportExport() {
    document.getElementById('btn-export').addEventListener('click', () => {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'sushicost_backup_' + new Date().toISOString().slice(0,10) + '.json';
        a.click(); URL.revokeObjectURL(url);
        showToast('Veriler dışa aktarıldı!');
    });

    document.getElementById('btn-import').addEventListener('click', () => document.getElementById('import-file').click());
    document.getElementById('import-file').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (ev) => {
            try {
                const imported = JSON.parse(ev.target.result);
                if (imported.ingredients && imported.categories && imported.products) {
                    data = imported;
                    await saveData(); renderAll();
                    showToast('Veriler başarıyla içe aktarıldı!');
                } else { showToast('Geçersiz dosya formatı!', 'error'); }
            } catch(err) { showToast('Dosya okunamadı!', 'error'); }
        };
        reader.readAsText(file);
        e.target.value = '';
    });
}

// ===== RENDER ALL =====
function renderAll() {
    renderIngredients();
    renderCategories();
    populateCategorySelects();
    populateIngredientSelects();
    renderProducts();
    renderDashboard();
}

// ===== UTILITY =====
function esc(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ===== EXPOSE GLOBAL HANDLERS =====
window.SC = {
    editIng: editIngredient,
    deleteIng: deleteIngredient,
    editCat: editCategory,
    deleteCat: deleteCategory,
    editProd: editProduct,
    deleteProd: deleteProduct,
    removePI: removeProductIngredient
};

// ===== START =====
document.addEventListener('DOMContentLoaded', init);

})();
