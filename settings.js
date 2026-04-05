/* settings.js - Backend Integrated */

const API_BASE = "http://127.0.0.1:5000/api";

document.addEventListener('DOMContentLoaded', () => {
    initSettings();
});

async function initSettings() {
    const currentSessionUser = sessionStorage.getItem('current_user') || 'HARRY';
    
    try {
        // 1. Fetch live data from DB
        const response = await fetch(`${API_BASE}/get-user?username=${currentSessionUser}`);
        const userData = await response.json();

        // 2. Sync UI Elements
        document.getElementById('userNameDisplay').innerText = userData.username;
        document.getElementById('newNameInput').value = userData.username;
        
        // 3. Theme State (Settings like theme are fine in localStorage as they are device-specific)
        const savedTheme = localStorage.getItem('vault_theme') || 'dark';
        document.getElementById('themeToggle').checked = (savedTheme === 'light');
        if(savedTheme === 'light') document.body.classList.add('light-mode');

        // 4. Render Avatars
        updateAvatarPreviews(userData.avatar, userData.username);

    } catch (e) {
        console.error("Failed to load settings from DB", e);
    }

    // 5. File Upload Listener
    document.getElementById('avatarUpload').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = async (event) => {
                const imgBase64 = event.target.result;
                await saveToDatabase({ avatar: imgBase64 });
            };
            reader.readAsDataURL(file);
        }
    });
}

function updateAvatarPreviews(imgData, name) {
    const sidebarAv = document.getElementById('sidebarAvatar');
    const settingsAv = document.getElementById('settingsAvatar');
    
    if (imgData && imgData !== "null") {
        const imgTag = `<img src="${imgData}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
        sidebarAv.innerHTML = imgTag;
        settingsAv.innerHTML = imgTag;
        sidebarAv.style.background = "transparent";
        settingsAv.style.background = "transparent";
    } else {
        const initial = name.charAt(0).toUpperCase();
        sidebarAv.innerText = initial;
        settingsAv.innerText = initial;
        sidebarAv.style.background = "#FF922B";
        settingsAv.style.background = "#FF922B";
    }
}

async function saveProfileChanges() {
    const newName = document.getElementById('newNameInput').value;
    await saveToDatabase({ newUsername: newName });
}

async function removeAvatar() {
    if(confirm("Remove profile photo?")) {
        await saveToDatabase({ avatar: null });
    }
}

// Helper to communicate with Flask
async function saveToDatabase(payload) {
    const oldUsername = sessionStorage.getItem('current_user');
    payload.oldUsername = oldUsername;

    try {
        const response = await fetch(`${API_BASE}/update-profile`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            const resData = await response.json();
            if (payload.newUsername) sessionStorage.setItem('current_user', resData.newUsername);
            location.reload(); 
        }
    } catch (e) {
        alert("Update failed. Check backend connection.");
    }
}

function toggleTheme() {
    const isLight = document.getElementById('themeToggle').checked;
    if (isLight) {
        document.body.classList.add('light-mode');
        document.documentElement.classList.add('light-mode'); // Added for global scope
        localStorage.setItem('vault_theme', 'light');
    } else {
        document.body.classList.remove('light-mode');
        document.documentElement.classList.remove('light-mode');
        localStorage.setItem('vault_theme', 'dark');
    }
}

function handleLogout() {
    if (confirm("Logout of Vaultify?")) {
        sessionStorage.clear();
        window.location.href = "index.html";
    }
}