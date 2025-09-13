document.addEventListener('DOMContentLoaded', function() {
    // Handle contact form submission with enhanced validation and feedback
    const contactForm = document.getElementById('contact-form');
    if (contactForm) {
        contactForm.addEventListener('submit', async function(event) {
            event.preventDefault();

            const name = document.getElementById('name').value.trim();
            const email = document.getElementById('email').value.trim();
            const whatsapp = document.getElementById('whatsapp').value.trim();
            const submitButton = contactForm.querySelector('.form-submit');

            // Validation
            if (!name || !email || !whatsapp) {
                showAlert('Please fill in all fields.', 'error');
                return;
            }

            // Email validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                showAlert('Please enter a valid email address.', 'error');
                return;
            }

            // WhatsApp validation (assuming 10 digits)
            const whatsappRegex = /^\d{10,15}$/;
            if (!whatsappRegex.test(whatsapp.replace(/\D/g, ''))) {
                showAlert('Please enter a valid WhatsApp number (10-15 digits).', 'error');
                return;
            }

            // Disable submit button and show loading state
            const originalText = submitButton.textContent;
            submitButton.textContent = 'Submitting...';
            submitButton.disabled = true;

            try {
                const response = await fetch('/api/contact', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ name, email, whatsapp })
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                showAlert('Thank you for contacting us, ' + name + '! Your message has been submitted.', 'success');
                contactForm.reset();
            } catch (error) {
                console.error('Error submitting contact form:', error);
                showAlert('Error submitting contact form. Please try again.', 'error');
            } finally {
                // Re-enable submit button
                submitButton.textContent = originalText;
                submitButton.disabled = false;
            }
        });
    }

    // Fetch and display registered users on the registered-users.html page
    const userDataBody = document.getElementById('user-data');
    if (userDataBody) {
        fetchRegisteredUsers();
    }

    async function checkAdminStatus() {
        try {
            const response = await fetch('/api/admin/status');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            return data.loggedIn;
        } catch (error) {
            console.error('Error checking admin status:', error);
            return false;
        }
    }

    async function fetchRegisteredUsers() {
        const isLoggedIn = await checkAdminStatus();
        if (!isLoggedIn) {
            showAlert('You must be logged in to view registered users.', 'error');
            userDataBody.innerHTML = '<tr><td colspan="3">You must be logged in to view registered users.</td></tr>';
            return;
        }
        try {
            const response = await fetch('/api/registered-users');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const users = await response.json();
            displayRegisteredUsers(users);
        } catch (error) {
            console.error('Error fetching registered users:', error);
            showAlert('Error loading registered users.', 'error');
            userDataBody.innerHTML = '<tr><td colspan="3">Error loading registered users.</td></tr>';
        }
    }

    function displayRegisteredUsers(users) {
        userDataBody.innerHTML = ''; // Clear existing data
        if (users.length === 0) {
            userDataBody.innerHTML = '<tr><td colspan="3">No registered users yet.</td></tr>';
            return;
        }
        users.forEach(user => {
            const row = userDataBody.insertRow();
            row.insertCell().textContent = user.name;
            row.insertCell().textContent = user.email;
            row.insertCell().textContent = user.whatsapp;
        });
    }

    // Enhanced alert function
    function showAlert(message, type) {
        // Remove any existing alerts
        const existingAlert = document.querySelector('.custom-alert');
        if (existingAlert) {
            existingAlert.remove();
        }

        // Create alert element
        const alert = document.createElement('div');
        alert.className = `alert alert-${type} custom-alert`;
        alert.textContent = message;

        // Add close button
        const closeBtn = document.createElement('span');
        closeBtn.innerHTML = '&times;';
        closeBtn.style.float = 'right';
        closeBtn.style.cursor = 'pointer';
        closeBtn.style.fontSize = '1.5em';
        closeBtn.style.lineHeight = '0.5';
        closeBtn.onclick = () => alert.remove();
        alert.appendChild(closeBtn);

        // Add to page
        const container = document.querySelector('.container') || document.body;
        container.insertBefore(alert, container.firstChild);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (alert.parentNode) {
                alert.remove();
            }
        }, 5000);
    }
});
