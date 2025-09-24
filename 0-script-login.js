const scriptURL = "https://script.google.com/macros/s/AKfycbwBLMe78h5a6XvhBolUZMe1VLot-MiAEmuAsDnZXtbLxMGkNsw4D7KQrVn7nS1yWCwi/exec";

document.getElementById("loginForm").addEventListener("submit", function(e) {
    e.preventDefault();

    const formData = new FormData(document.getElementById("loginForm"));
    formData.append('action', 'login'); // ✅ add login action

    const statusElement = document.getElementById("status");
    const submitButton = document.querySelector("button[type='submit']");
    const buttonText = document.getElementById("button-text");
    const username = document.getElementById("username").value;
    
    submitButton.disabled = true;
    buttonText.innerHTML = `<span class="loading-spinner"></span> Logging in...`;
    statusElement.textContent = "";
    statusElement.className = "";

    fetch(scriptURL, {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(result => {
        if (result.status === "success") {
            statusElement.className = "success";
            statusElement.textContent = "Login successful! Redirecting...";

            // Store user info in localStorage
            localStorage.setItem('maintenanceUser', username);
            localStorage.setItem('userFullName', result.name || username);
            localStorage.setItem('userPosition', result.position || 'Maintenance Staff');

            // Redirect with user information in URL parameters
            setTimeout(() => {
                window.location.href = `1-overview.html?username=${encodeURIComponent(username)}&name=${encodeURIComponent(result.name || username)}&position=${encodeURIComponent(result.position || 'Maintenance Staff')}`;
            }, 1000);
        } else {
            statusElement.className = "error";
            statusElement.textContent = result.message || "Invalid username or password";
        }
    })
    .catch(error => {
        statusElement.className = "error";
        statusElement.textContent = "Error connecting to server. Please try again.";
        console.error("Error:", error);
    })
    .finally(() => {
        submitButton.disabled = false;
        buttonText.textContent = "Login";
    });
});
