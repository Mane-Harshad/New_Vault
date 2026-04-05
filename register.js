/* register.js */

async function initializeVault() {
    const user = document.getElementById('regUser').value;
    const pin = document.getElementById('regPin').value;

    // 1. Validation
    if (!user || pin.length !== 4) {
        alert("CRITICAL ERROR: Username and 4-digit PIN required.");
        return;
    }

    try {
        // 2. API Call to Flask
        const response = await fetch('http://127.0.0.1:5000/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: user,
                pin: pin
            })
        });

        const data = await response.json();

        if (response.ok) {
            // Success: Trigger the cool animation
            startInitializationSequence();
        } else {
            alert("REGISTRATION FAILED: " + (data.error || "User already exists"));
        }

    } catch (error) {
        console.error("Connection Error:", error);
        alert("SERVER OFFLINE: Check your Python terminal.");
    }
}

function startInitializationSequence() {
    const overlay = document.getElementById('initOverlay');
    overlay.style.display = 'flex';

    let progress = 0;
    const interval = setInterval(() => {
        progress += Math.floor(Math.random() * 15);
        if (progress > 100) progress = 100;
        
        document.getElementById('percent').innerText = progress + "%";

        if (progress === 100) {
            clearInterval(interval);
            setTimeout(() => {
                // After registration, send them to login
                window.location.href = "login.html";
            }, 1000);
        }
    }, 200);
}