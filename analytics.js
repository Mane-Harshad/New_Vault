/* analytics.js - FULL BACKEND SYNC */

document.addEventListener('DOMContentLoaded', async () => {
    // 1. SYNC USER IDENTITY
    const savedUser = sessionStorage.getItem('current_user') || 'HARRY';
    document.getElementById('userNameDisplay').innerText = savedUser;
    const initialEl = document.getElementById('userInitial');
    if(initialEl) initialEl.innerText = savedUser.charAt(0).toUpperCase();
    
    try {
        // 2. FETCH REAL DATA FROM BACKEND
        const vRes = await fetch(`http://127.0.0.1:5000/api/get-bills?username=${savedUser}`);
        const vaultItems = await vRes.json();

        const cRes = await fetch(`http://127.0.0.1:5000/api/get-claims?username=${savedUser}`);
        const claims = await cRes.json();

        // 3. RUN ANALYTICS ENGINE
        calculateMetrics(vaultItems, claims);
        initSpendingTrend(vaultItems);
        initVendorPie(vaultItems);
        initWarrantyBar(vaultItems);
        initCategoryExpense(vaultItems);

    } catch (e) {
        console.error("Analytics Sync Failed:", e);
    }
});

function calculateMetrics(items, claims) {
    // Real Total Spent
    const total = items.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);
    document.getElementById('statTotalSpent').innerText = `₹${total.toLocaleString('en-IN')}`;

    // Real Top Category
    if (items.length > 0) {
        const catCounts = {};
        items.forEach(i => catCounts[i.category] = (catCounts[i.category] || 0) + 1);
        const topCat = Object.keys(catCounts).reduce((a, b) => catCounts[a] > catCounts[b] ? a : b);
        document.getElementById('statTopCategory').innerText = topCat;
    }

    // Real Active Warranties
    const today = new Date();
    const active = items.filter(item => {
        const pDate = new Date(item.date);
        const months = parseInt(item.warranty) || 0;
        const exp = new Date(pDate.setMonth(pDate.getMonth() + months));
        return exp > today;
    }).length;
    document.getElementById('statActiveWarranty').innerText = active;

    // Real Open Claims (Pending/Approved/Rejected but not Resolved)
    const openClaimsCount = claims.filter(c => c.status !== 'Resolved').length;
    document.getElementById('statOpenClaims').innerText = openClaimsCount;
}

function initSpendingTrend(items) {
    // Group spending by month
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthlyData = new Array(12).fill(0);

    items.forEach(item => {
        const d = new Date(item.date);
        if(!isNaN(d)) monthlyData[d.getMonth()] += (parseFloat(item.price) || 0);
    });

    const ctx = document.getElementById('monthlyTrendChart').getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: months,
            datasets: [{
                label: 'Monthly Spending',
                data: monthlyData,
                borderColor: '#FF922B',
                backgroundColor: 'rgba(255, 146, 43, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: { 
            responsive: true, 
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, grid: { color: '#222' } } }
        }
    });
}

function initVendorPie(items) {
    const vendorMap = {};
    items.forEach(i => vendorMap[i.vendor] = (vendorMap[i.vendor] || 0) + (parseFloat(i.price) || 0));

    const ctx = document.getElementById('vendorPieChart').getContext('2d');
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(vendorMap),
            datasets: [{
                data: Object.values(vendorMap),
                backgroundColor: ['#FF922B', '#4dabf7', '#12b886', '#fab005', '#fa5252'],
                borderWidth: 0
            }]
        },
        options: { plugins: { legend: { position: 'bottom', labels: { color: '#888' } } } }
    });
}

function initWarrantyBar(items) {
    const today = new Date();
    let active = 0, expired = 0;

    items.forEach(item => {
        const pDate = new Date(item.date);
        const exp = new Date(pDate.setMonth(pDate.getMonth() + (parseInt(item.warranty) || 0)));
        exp > today ? active++ : expired++;
    });

    const ctx = document.getElementById('warrantyBarChart').getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Active', 'Expired'],
            datasets: [{
                data: [active, expired],
                backgroundColor: ['#12b886', '#fa5252'],
                borderRadius: 5
            }]
        },
        options: { plugins: { legend: { display: false } } }
    });
}

function initCategoryExpense(items) {
    const catMap = {};
    items.forEach(i => catMap[i.category] = (catMap[i.category] || 0) + (parseFloat(i.price) || 0));

    const ctx = document.getElementById('categoryBarChart').getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        options: { 
            indexAxis: 'y', 
            plugins: { legend: { display: false } },
            scales: { x: { beginAtZero: true, grid: { color: '#222' } } }
        },
        data: {
            labels: Object.keys(catMap),
            datasets: [{
                data: Object.values(catMap),
                backgroundColor: '#FF922B'
            }]
        }
    });
}