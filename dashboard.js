/* static/js/dashboard.js - LIVE PRODUCTION VERSION */

const API_BASE = "http://127.0.0.1:5000/api";
let allBills = []; // Global store for search filtering

document.addEventListener('DOMContentLoaded', async () => {
    // 1. SYNC IDENTITY
    const savedUser = sessionStorage.getItem('current_user') || localStorage.getItem('vault_user') || 'GUEST';
    document.getElementById('userNameDisplay').innerText = savedUser;
    document.getElementById('userInitial').innerText = savedUser.charAt(0).toUpperCase();

    try {
        // 2. FETCH LIVE DATA
        const bRes = await fetch(`${API_BASE}/get-bills?username=${savedUser}`);
        allBills = await bRes.json(); // Store in global variable for search

        const cRes = await fetch(`${API_BASE}/get-claims?username=${savedUser}`);
        const claims = await cRes.json();

        // 3. INITIAL RENDER
        renderInsights(allBills, claims);
        renderCriticalExpiry(allBills);
        renderRecentClaim(claims);
        renderRecentDeposits(allBills);

    } catch (e) {
        console.error("Dashboard failed to sync with MySQL:", e);
    }

    // --- NAVIGATION & SEARCH LOGIC ---

    // Global Search Listener
    const searchInput = document.getElementById('globalSearch');
    if(searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const filtered = allBills.filter(b => 
                b.name.toLowerCase().includes(term) || 
                b.vendor.toLowerCase().includes(term) || 
                b.category.toLowerCase().includes(term)
            );
            renderRecentDeposits(filtered);
        });
    }

    // Header Button Actions
    const scanBtn = document.querySelector('.scan-btn');
    if(scanBtn) {
        scanBtn.onclick = () => window.location.href = "vault.html?mode=scan";
    }

    const addBtn = document.querySelector('.add-btn');
    if(addBtn) {
        addBtn.onclick = () => window.location.href = "vault.html";
    }
});

function renderInsights(bills, claims) {
    // 1. Calculate Total Spent
    const total = bills.reduce((sum, b) => sum + (parseFloat(b.price) || 0), 0);
    document.getElementById('statTotal').innerText = `₹${total.toLocaleString('en-IN')}`;

    // 2. Calculate Top Category by VALUE (not just count)
    if (bills.length > 0) {
        const catSpending = {};
        bills.forEach(b => {
            const price = parseFloat(b.price) || 0;
            catSpending[b.category] = (catSpending[b.category] || 0) + price;
        });
        
        // Find the category with the maximum total price
        const topCat = Object.keys(catSpending).reduce((a, b) => 
            catSpending[a] > catSpending[b] ? a : b
        );
        
        document.getElementById('statCategory').innerText = topCat;
    }

    const today = new Date();
    const activeCount = bills.filter(b => {
        const pDate = new Date(b.date);
        const months = parseInt(b.warranty) || 0;
        const expDate = new Date(pDate.setMonth(pDate.getMonth() + months));
        return expDate > today;
    }).length;
    document.getElementById('statCount').innerText = `${activeCount} Items`;
}

function renderCriticalExpiry(bills) {
    if (bills.length === 0) return;
    const today = new Date();
    let criticalBill = null;
    let minDays = Infinity;

    bills.forEach(b => {
        const pDate = new Date(b.date);
        const months = parseInt(b.warranty) || 0;
        const expDate = new Date(pDate.setMonth(pDate.getMonth() + months));
        const diffDays = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
        if (diffDays > 0 && diffDays < minDays) {
            minDays = diffDays;
            criticalBill = b;
        }
    });

    if (criticalBill) {
        document.getElementById('expName').innerText = criticalBill.name;
        document.getElementById('expDetail').innerText = `${criticalBill.vendor} • Category: ${criticalBill.category}`;
        document.getElementById('expDays').innerText = `${minDays} DAYS LEFT`;
        if (minDays < 7) document.querySelector('.expiry-banner').style.borderLeft = "5px solid #fa5252";
    }
}

function renderRecentClaim(claims) {
    const pendingClaim = claims.find(c => c.status === 'Pending') || claims[0];
    if (pendingClaim) {
        document.getElementById('claimName').innerText = pendingClaim.name;
        document.getElementById('claimStatus').innerText = pendingClaim.status;
        document.getElementById('claimMeta').innerText = `Claim ID: #CLM-${pendingClaim.cid} | Product ID: #${pendingClaim.itemId}`;
        const bar = document.querySelector('.status-bar-yellow');
        if (pendingClaim.status === 'Approved') bar.style.backgroundColor = '#4dabf7';
        if (pendingClaim.status === 'Resolved') bar.style.backgroundColor = '#12b886';
    } else {
        document.getElementById('claimName').innerText = "No active claims";
    }
}

function renderRecentDeposits(bills) {
    const container = document.getElementById('depositsContainer');
    container.innerHTML = ""; 
    const recent = bills.slice(-3).reverse();
    recent.forEach(bill => {
        container.innerHTML += `
            <div class="deposit-card">
                <strong>${bill.name}</strong>
                <p>${bill.vendor} • ₹${bill.price}</p>
                <span class="tag-verified">Verified</span>
            </div>
        `;
    });
    if (recent.length === 0) container.innerHTML = "<p style='color:#555; padding:20px;'>No assets found.</p>";
}