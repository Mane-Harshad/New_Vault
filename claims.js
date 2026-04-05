/* claims.js - FULL FEATURE SYNC */
let vaultItems = [];
let claims = [];
const API_BASE = "http://127.0.0.1:5000/api";

document.addEventListener('DOMContentLoaded', () => {
    const savedUser = sessionStorage.getItem('current_user') || 'Harry';
    initClaimsModule(savedUser);
});

async function initClaimsModule(username) {
    // Identity Sync
    document.getElementById('userNameDisplay').innerText = username;
    const initialElement = document.getElementById('userInitial');
    if (initialElement) initialElement.innerText = username[0].toUpperCase();

    try {
        // Fetch real items from Vault
        const vRes = await fetch(`${API_BASE}/get-bills?username=${username}`);
        vaultItems = await vRes.json();

        // Fetch real claims from DB
        const cRes = await fetch(`${API_BASE}/get-claims?username=${username}`);
        claims = await cRes.json();

        refreshClaimsUI();
    } catch (e) { 
        console.error("Sync Error:", e); 
    }
}

function refreshClaimsUI() {
    renderExpiryRadar();
    renderClaimsList();
    renderReminders();
    
    const select = document.getElementById('claimItemSelect');
    if(select) {
        select.innerHTML = vaultItems.map(i => `<option value="${i.id}">${i.name}</option>`).join('');
    }
}

// FEATURE 3: COLOR-BASED EXPIRY TRACKER
function renderExpiryRadar() {
    const radar = document.getElementById('expiryRadar');
    if (!radar) return;
    radar.innerHTML = "";

    vaultItems.forEach(item => {
        const pDate = new Date(item.date);
        const months = parseInt(item.warranty) || 0;
        const eDate = new Date(pDate.setMonth(pDate.getMonth() + months));
        const diff = Math.ceil((eDate - new Date()) / 86400000);

        let colorClass = "status-green"; // > 30 days
        if (diff <= 7) colorClass = "status-red";
        else if (diff <= 30) colorClass = "status-orange";

        radar.innerHTML += `
            <div class="expiry-card ${colorClass}">
                <strong>${item.name}</strong>
                <p>Expiry: ${eDate.toLocaleDateString()}</p>
                <div class="days-pill">${diff <= 0 ? 'EXPIRED' : diff + ' Days Left'}</div>
            </div>`;
    });
}

// FEATURE 1: CLAIM INITIATION
window.openClaimInitiator = () => document.getElementById('initiateModal').style.display = 'flex';
window.closeModal = (id) => document.getElementById(id).style.display = 'none';

window.submitClaim = async () => {
    const id = document.getElementById('claimItemSelect').value;
    const desc = document.getElementById('issueDesc').value;
    if(!desc) return alert("Please add an issue description.");

    try {
        const response = await fetch(`${API_BASE}/submit-claim`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ itemId: parseInt(id), desc: desc })
        });

        if (response.ok) {
            document.getElementById('issueDesc').value = "";
            closeModal('initiateModal');
            initClaimsModule(sessionStorage.getItem('current_user'));
        } else {
            const err = await response.json();
            alert(err.error || "Submission failed.");
        }
    } catch (e) { alert("Submission failed."); }
};

// FEATURE 2 & 4: STATUS MANAGEMENT & DOC UPLOADS
function renderClaimsList() {
    const list = document.getElementById('activeClaimsList');
    if (!list) return;
    
    list.innerHTML = claims.length ? "" : "<p style='color:#555;'>No active claims board.</p>";

    claims.forEach(c => {
        // Log the CID to the console so you can verify it's a number
        console.log("Rendering Claim row for CID:", c.cid);

        list.innerHTML += `
            <div class="claim-row" onclick="openWorkspace(${c.cid})" style="cursor:pointer;">
                <div class="dot ${c.status.toLowerCase()}"></div>
                <div class="claim-info">
                    <strong>${c.name}</strong>
                    <span>Stage: ${c.status}</span>
                </div>
            </div>`;
    });
}

window.openWorkspace = (cid) => {
    const c = claims.find(cl => cl.cid === cid);
    if (!c) return;
    const drawer = document.getElementById('workspaceDrawer');

    // Split history log by newline for the timeline
    const historyRows = c.history ? c.history.trim().split('\n') : [];

    document.getElementById('drawerUI').innerHTML = `
        <div class="drawer-header"><h3>Manage Claim #${c.cid}</h3><button onclick="closeDrawer()" class="close-x">×</button></div>
        <div class="drawer-body">
            <div class="work-meta">
                <label>PRODUCT</label><strong>${c.name}</strong>
                <label style="display:block; margin-top:15px;">ISSUE DESCRIPTION</label>
                <div class="desc-display">${c.desc}</div>
            </div>

            <div class="work-action">
                <label>Update Claim Status</label>
                <select class="status-select" onchange="updateClaimStatus(${c.cid}, this.value)">
                    <option value="Pending" ${c.status==='Pending'?'selected':''}>Pending</option>
                    <option value="Approved" ${c.status==='Approved'?'selected':''}>Approved</option>
                    <option value="Rejected" ${c.status==='Rejected'?'selected':''}>Rejected</option>
                    <option value="Resolved" ${c.status==='Resolved'?'selected':''}>Resolved</option>
                </select>
            </div>

            <div class="work-action">
                <label>Upload Revised Docs (Receipts/Vendor Responses)</label>
                <input type="file" id="docIn" onchange="uploadClaimDoc(${c.cid}, this)">
                <div class="doc-preview-area" id="docTray">
                    ${c.docs ? `<div class="doc-card"><img src="${c.docs}"><p>Latest Document</p></div>` : '<p style="font-size:12px; color:#666;">No docs uploaded yet.</p>'}
                </div>
            </div>

            <div class="timeline">
                <label>STATUS HISTORY</label>
                ${historyRows.map(h => {
                    const [status, time] = h.split('|');
                    return `<div class="time-row"><span>${time || ''}</span><b>${status}</b></div>`;
                }).join('')}
            </div>
            
            <button class="btn-del" style="margin-top:20px; background:#ff4b4b; color:white; border:none; padding:10px; border-radius:5px; cursor:pointer;" onclick="deleteClaim(${c.cid})">Delete Claim</button>
        </div>`;
    drawer.classList.add('active');
};

// API CALL: UPDATE STATUS (Feature 2)
window.updateClaimStatus = async (cid, newStatus) => {
    try {
        const response = await fetch(`${API_BASE}/update-claim-status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cid: cid, status: newStatus })
        });
        if (response.ok) {
            await initClaimsModule(sessionStorage.getItem('current_user'));
            // Re-open workspace to show updated history immediately
            openWorkspace(cid); 
        }
    } catch (e) { alert("Status update failed."); }
};

// API CALL: UPLOAD DOC (Feature 4)
window.uploadClaimDoc = (cid, input) => {
    const file = input.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const response = await fetch(`${API_BASE}/upload-claim-doc`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cid: cid, doc: e.target.result })
            });
            if (response.ok) {
                await initClaimsModule(sessionStorage.getItem('current_user'));
                // Refresh workspace to show the uploaded image
                openWorkspace(cid);
            }
        } catch (err) { alert("Doc upload failed."); }
    };
    reader.readAsDataURL(file);
};

// FEATURE 3: FOLLOW-UP REMINDERS
function renderReminders() {
    const container = document.getElementById('reminderContainer');
    if (!container) return;
    container.innerHTML = "";
    
    // Warranty Expiry Reminders (Urgent: < 30 days)
    vaultItems.forEach(i => {
        const pDate = new Date(i.date);
        const exp = new Date(pDate.setMonth(pDate.getMonth() + (parseInt(i.warranty) || 0)));
        const days = Math.ceil((exp - new Date()) / 86400000);
        if(days > 0 && days <= 30) {
            container.innerHTML += `<div class="rem-card urgent"><strong>Expiry Warning</strong><p>${i.name} in ${days} days!</p></div>`;
        }
    });

    // Pending Claims Follow-up
    claims.filter(c => c.status === 'Pending').forEach(c => {
        container.innerHTML += `<div class="rem-card"><strong>Claim Follow-up</strong><p>Pending: #${c.cid} (${c.name})</p></div>`;
    });
}

window.deleteClaim = async (cid) => {
    if(!confirm("Permanently delete this claim?")) return;
    try {
        const response = await fetch(`${API_BASE}/delete-claim/${cid}`, { method: 'DELETE' });
        if (response.ok) {
            closeDrawer();
            initClaimsModule(sessionStorage.getItem('current_user'));
        }
    } catch (e) { alert("Delete failed."); }
};

window.closeDrawer = () => document.getElementById('workspaceDrawer').classList.remove('active');