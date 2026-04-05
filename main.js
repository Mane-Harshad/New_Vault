/* main.js */
(function() {
    // 1. INSTANT THEME CHECK (Remains the same - LocalStorage is best for this)
    const savedTheme = localStorage.getItem('vault_theme') || 'dark';
    if (savedTheme === 'light') {
        document.documentElement.classList.add('light-mode');
    }
})();

// 2. IDENTITY CHECK (Updated for Database/Session Sync)
document.addEventListener('DOMContentLoaded', () => {
    // 2. Ensure Body also has the class (for CSS targeting)
    const savedTheme = localStorage.getItem('vault_theme') || 'dark';
    if (savedTheme === 'light') {
        document.body.classList.add('light-mode');
    }
    // Prioritize the Current Logged-in User from Session
    const savedUser = sessionStorage.getItem('current_user') || localStorage.getItem('vault_user') || 'HARRY';
    const savedAvatar = localStorage.getItem('vault_avatar_img');
    
    const nameDisplay = document.getElementById('userNameDisplay');
    const avatarDisplay = document.getElementById('sidebarAvatar');

    if (nameDisplay) nameDisplay.innerText = savedUser;

    if (avatarDisplay) {
        if (savedAvatar) {
            avatarDisplay.innerHTML = `<img src="${savedAvatar}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
            avatarDisplay.style.background = "transparent";
        } else {
            // Use the dynamic user name for the initial
            avatarDisplay.innerText = savedUser.charAt(0).toUpperCase();
            avatarDisplay.style.background = "#FF922B";
        }
    }
});