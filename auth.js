/* static/js/auth.js */

let enteredPin = "";
const MAX_PIN_LENGTH = 4;

function pressKey(n) {
    if (enteredPin.length < MAX_PIN_LENGTH) {
        enteredPin += n;
        updatePinUI();
    }
}

function updatePinUI() {
    const dots = document.getElementById('pinDisplay');
    dots.innerText = "*".repeat(enteredPin.length).padEnd(MAX_PIN_LENGTH, "-");
}

function clearPin() {
    enteredPin = "";
    updatePinUI();
}

/**
 * DATABASE VERIFICATION LOGIC
 */
async function verifyAccess() {
    const username = document.getElementById('loginUser').value.trim();

    if (!username || enteredPin.length !== 4) {
        alert("Enter a valid username and 4-digit PIN");
        return;
    }

    try {
        const response = await fetch('http://127.0.0.1:5000/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, pin: enteredPin })
        });

        const data = await response.json();

        if (response.ok) {
            // Success: Turn LED Green
            const led = document.getElementById('statusLed');
            led.style.background = "#00FF41";
            led.style.boxShadow = "0 0 15px #00FF41";
            
            // Store current user in session for the dashboard
            sessionStorage.setItem('current_user', username);
            
            executeConvergence();
        } else {
            // Error: Shake Screen
            const screen = document.querySelector('.vault-screen');
            screen.classList.add('shake-error');
            setTimeout(() => {
                screen.classList.remove('shake-error');
                clearPin();
            }, 500);
        }
    } catch (error) {
        console.error("Login Error:", error);
        alert("SERVER OFFLINE");
    }
}

/**
 * Transition Animations
 */
function executeConvergence() {
    const locker = document.getElementById('mainLocker');
    const overlay = document.getElementById('vaultOverlay');

    locker.style.opacity = "0";
    locker.style.transform = "scale(0.8) translateY(20px)";
    
    setTimeout(() => {
        locker.style.display = "none";
        overlay.style.display = "flex";
        renderBeams();
    }, 800);
}

function renderBeams() {
    const overlay = document.getElementById('vaultOverlay');
    const corners = [{x:0,y:0},{x:100,y:0},{x:0,y:100},{x:100,y:100}];

    corners.forEach((pos, i) => {
        const beam = document.createElement('div');
        beam.className = 'beam';
        beam.style.left = pos.x + '%';
        beam.style.top = pos.y + '%';
        overlay.appendChild(beam);

        void beam.offsetWidth;

        setTimeout(() => {
            beam.style.opacity = '1';
            beam.style.left = '50%';
            beam.style.top = '50%';
            beam.style.transform = 'translate(-50%, -50%) scale(0)';
        }, 100 + (i * 150));
    });

    setTimeout(() => {
        const logo = document.getElementById('finalLogo');
        const msg = document.getElementById('accessMsg');
        logo.style.opacity = "1";
        logo.style.transform = "scale(1)";
        
        setTimeout(() => { msg.style.opacity = "1"; }, 500);
        setTimeout(() => { window.location.href = "dashboard.html"; }, 3000);
    }, 1500);
}