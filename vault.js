/* vault.js */
let vaultItems = []; 
let categories = ["All", "Electronics", "Amazon", "Furniture"];

document.addEventListener('DOMContentLoaded', () => {
    const savedUser = sessionStorage.getItem('current_user') || 'Harry';
    if(document.getElementById('userNameDisplay')) document.getElementById('userNameDisplay').innerText = savedUser;
    if(document.getElementById('userInitial')) document.getElementById('userInitial').innerText = savedUser.charAt(0).toUpperCase();

    // 1. HANDLE REDIRECT SCAN MODE
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('mode') === 'scan') {
        setTimeout(() => triggerFileSelect(), 500);
    }

    // 2. VAULT-SPECIFIC SEARCH
    const vaultSearch = document.getElementById('vaultSearch');
    if(vaultSearch) {
        vaultSearch.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const filtered = vaultItems.filter(item => 
                item.name.toLowerCase().includes(term) || 
                item.vendor.toLowerCase().includes(term)
            );
            renderVaultSearch(filtered);
        });
    }

    loadVaultFromDB(savedUser); 
    document.getElementById('billInput').addEventListener('change', handleFileUpload);
});

// NEW: SORTING LOGIC
function sortVault(criteria) {
    let sortedItems = [...vaultItems];

    switch (criteria) {
        case 'newest':
            sortedItems.sort((a, b) => new Date(b.date) - new Date(a.date));
            break;
        case 'oldest':
            sortedItems.sort((a, b) => new Date(a.date) - new Date(b.date));
            break;
        case 'priceHigh':
            sortedItems.sort((a, b) => (parseFloat(b.price) || 0) - (parseFloat(a.price) || 0));
            break;
        case 'priceLow':
            sortedItems.sort((a, b) => (parseFloat(a.price) || 0) - (parseFloat(b.price) || 0));
            break;
    }
    renderVaultSearch(sortedItems);
}

// Updated helper function to show Price instead of Status
function renderVaultSearch(items) {
    const table = document.getElementById('vaultTableBody');
    if (!table) return;
    table.innerHTML = "";

    if (items.length === 0) {
        table.innerHTML = "<tr><td colspan='5' style='text-align:center; color:#888;'>No matching assets.</td></tr>";
        return;
    }

    items.forEach(item => {
        table.insertAdjacentHTML('beforeend', `
            <tr onclick="openDrawer(${item.id})" style="cursor:pointer">
                <td>${item.name}</td>
                <td>${item.vendor}</td>
                <td>${item.date}</td>
                <td style="font-weight:bold; color:white;">₹${(parseFloat(item.price) || 0).toLocaleString('en-IN')}</td>
                <td><button style="color:#FF922B; background:none; border:none; font-weight:bold;">View</button></td>
            </tr>`);
    });
}

async function loadVaultFromDB(username) {
    try {
        const response = await fetch(`http://127.0.0.1:5000/api/get-bills?username=${username}`);
        if (!response.ok) throw new Error("DB Fetch Failed");
        vaultItems = await response.json();
        
        vaultItems.forEach(item => {
            if (item.category && !categories.includes(item.category)) {
                categories.push(item.category);
            }
        });

        renderFilterChips(); 
        renderVault('All'); 
    } catch (error) { console.error(error); }
}

function renderFilterChips() {
    const chipRow = document.querySelector('.filter-row');
    if (!chipRow) return;
    chipRow.innerHTML = "";
    categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = (cat === 'All') ? "chip active" : "chip";
        btn.innerHTML = `${cat === 'All' ? "All Assets" : cat} ${cat !== 'All' ? `<span class="del-cat" onclick="deleteCategory('${cat}', event)">×</span>` : ''}`;
        btn.onclick = function() { filterVault(cat, this); };
        chipRow.appendChild(btn);
    });
}

function renderVault(filter) {
    const grid = document.getElementById('recentGrid');
    const table = document.getElementById('vaultTableBody');
    if (!grid || !table) return;

    grid.innerHTML = ""; table.innerHTML = "";
    let filtered = filter === 'All' ? vaultItems : vaultItems.filter(i => i.category === filter);

    if (filtered.length === 0) {
        table.innerHTML = "<tr><td colspan='5' style='text-align:center; color:#888;'>No assets found.</td></tr>";
        return;
    }

    const newestFirst = [...filtered].reverse();
    newestFirst.slice(0, 3).forEach(item => {
        grid.insertAdjacentHTML('beforeend', `
            <div class="folder-card" onclick="openDrawer(${item.id})">
                <div class="folder-tab-top"></div>
                <div class="folder-sleeve-main">
                    <div class="preview-box"><img src="${item.img || ''}"></div>
                </div>
                <p style="margin-top:10px; font-weight:600; color:#fff;">${item.name}</p>
            </div>`);
    });

    renderVaultSearch(filtered); 
}

async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        document.getElementById('ocrTempImg').src = event.target.result;
        document.getElementById('ocrModal').style.display = 'flex';
    };
    reader.readAsDataURL(file);
    const formData = new FormData();
    formData.append('file', file);
    try {
        const response = await fetch('http://127.0.0.1:5000/api/scan', { method: 'POST', body: formData });
        const result = await response.json();
        if (response.ok && result.parsed) {
            const p = result.parsed;
            document.getElementById('ocr_vendor').value = p.vendor || "";
            document.getElementById('ocr_name').value = p.name || "";
            document.getElementById('ocr_price').value = p.price || "0.00";
            document.getElementById('ocr_date').value = p.date || "";
        }
    } catch (error) { 
        console.error("Scan Error:", error);
    }
}

async function finalizeUpload() {
    const username = sessionStorage.getItem('current_user') || 'Harry';
    const payload = {
        username: username,
        name: document.getElementById('ocr_name').value,
        vendor: document.getElementById('ocr_vendor').value,
        date: document.getElementById('ocr_date').value,
        warranty: document.getElementById('ocr_warranty').value + "m",
        price: parseFloat(document.getElementById('ocr_price').value) || 0.0,
        category: document.getElementById('ocr_category_select').value,
        img: document.getElementById('ocrTempImg').src 
    };

    if (payload.category === "NEW") {
        payload.category = document.getElementById('new_category_input').value.trim();
        if (!categories.includes(payload.category)) { categories.push(payload.category); renderFilterChips(); }
    }

    try {
        const response = await fetch('http://127.0.0.1:5000/api/save-bill', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        if (response.ok) { await loadVaultFromDB(username); closeOCR(); }
    } catch (error) { alert("Save Failed"); }
}

function openDrawer(id) {
    const item = vaultItems.find(i => i.id === id);
    if(!item) return;
    const drawer = document.getElementById('overviewDrawer');
    drawer.innerHTML = `
        <div class="drawer-header"><h3>Bill Overview</h3><button onclick="closeDrawer()" class="close-drawer-btn">×</button></div>
        <div class="drawer-body">
            <div class="preview-folder-visual"><div class="visual-tab"></div><div class="visual-sleeve"><img src="${item.img || ''}"></div></div>
            <div class="meta-details">
                <div class="meta-item"><label>PRODUCT</label><strong>${item.name}</strong></div>
                <div class="meta-item"><label>VENDOR</label><strong>${item.vendor}</strong></div>
                <div class="meta-grid" style="display:grid; grid-template-columns:1fr 1fr; gap:15px;">
                    <div class="meta-item"><label>DATE</label><p style="color:#fff;">${item.date}</p></div>
                    <div class="meta-item"><label>WARRANTY</label><p style="color:#fff;">${item.warranty}</p></div>
                </div>
            </div>
            <div class="drawer-footer">
                <button class="btn-action-outline" onclick="downloadPDF(${item.id})">DOWNLOAD PDF</button>
                <button class="btn-action-danger" onclick="deleteItem(${item.id})">DELETE ASSET</button>
            </div>
        </div>`;
    drawer.classList.add('active');
}

// NEW: PDF DOWNLOAD FUNCTION
async function downloadPDF(id) {
    const item = vaultItems.find(i => i.id === id);
    if (!item) return;

    const element = document.createElement('div');
    element.innerHTML = `
        <div style="padding: 40px; font-family: 'Inter', sans-serif; color: #000; background: #fff;">
            <h1 style="color: #FF922B; border-bottom: 2px solid #eee; padding-bottom: 10px;">VAULTIFY ASSET RECEIPT</h1>
            <div style="margin-top: 20px; display: flex; justify-content: space-between;">
                <div>
                    <p><strong>Product:</strong> ${item.name}</p>
                    <p><strong>Vendor:</strong> ${item.vendor}</p>
                    <p><strong>Category:</strong> ${item.category}</p>
                </div>
                <div style="text-align: right;">
                    <p><strong>Purchase Date:</strong> ${item.date}</p>
                    <p><strong>Warranty:</strong> ${item.warranty}</p>
                    <p style="font-size: 1.2rem; color: #FF922B;"><strong>Amount: ₹${item.price.toLocaleString('en-IN')}</strong></p>
                </div>
            </div>
            <div style="margin-top: 30px; text-align: center;">
                <p style="font-size: 0.8rem; color: #666;">Original Receipt Image Below</p>
                <img src="${item.img}" style="max-width: 100%; border: 1px solid #ddd; border-radius: 8px; margin-top: 10px;">
            </div>
            <footer style="margin-top: 50px; border-top: 1px solid #eee; padding-top: 20px; font-size: 0.7rem; color: #999; text-align: center;">
                Generated via Vaultify Secure Ledger System | ${new Date().toLocaleDateString()}
            </footer>
        </div>
    `;

    const opt = {
        margin:       0.5,
        filename:     `Vaultify_${item.name.replace(/\s+/g, '_')}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2 },
        jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
    };

    try {
        const btn = event.target;
        const originalText = btn.innerText;
        btn.innerText = "GENERATING...";
        await html2pdf().set(opt).from(element).save();
        btn.innerText = originalText;
    } catch (error) {
        console.error("PDF Export Error:", error);
        alert("Could not generate PDF.");
    }
}

async function deleteItem(id) {
    if(!confirm("Permanently delete?")) return;
    try {
        const response = await fetch(`http://127.0.0.1:5000/api/delete-bill/${id}`, { method: 'DELETE' });
        if (response.ok) {
            vaultItems = vaultItems.filter(i => i.id !== id);
            renderVault('All');
            closeDrawer();
        }
    } catch (e) { alert("Delete Failed"); }
}

function triggerFileSelect() { document.getElementById('billInput').click(); }
function closeOCR() { document.getElementById('ocrModal').style.display = 'none'; }
function checkNewCategory(val) { document.getElementById('new_category_input').style.display = (val === 'NEW') ? 'block' : 'none'; }
function filterVault(cat, btn) {
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    renderVault(cat);
}
function closeDrawer() { document.getElementById('overviewDrawer').classList.remove('active'); }