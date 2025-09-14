// Enhanced frontend JavaScript with better error handling and performance optimizations
document.addEventListener('DOMContentLoaded', function() {

    // Enhanced loading overlay with better UX
    function showLoading(message = 'Loading...') {
        let overlay = document.getElementById('loading-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'loading-overlay';
            overlay.className = 'loading-overlay';
            overlay.innerHTML = `
                <div class="loading-content">
                    <div class="loading-spinner large"></div>
                    <p>${message}</p>
                </div>
            `;
            document.body.appendChild(overlay);
        }
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden'; // Prevent scrolling
    }

    // Hide loading overlay
    function hideLoading() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.classList.remove('active');
        }
        document.body.style.overflow = ''; // Restore scrolling
    }

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
            showLoading('Submitting your message...');

            try {
                const response = await fetch('/api/contact', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ name, email, whatsapp }),
                    timeout: 10000 // 10 second timeout
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
                }

                const result = await response.json();
                showAlert('Thank you for contacting us, ' + name + '! Your message has been submitted.', 'success');
                contactForm.reset();
            } catch (error) {
                console.error('Error submitting contact form:', error);
                if (error.name === 'AbortError' || error.name === 'TypeError') {
                    showAlert('Network error. Please check your connection and try again.', 'error');
                } else {
                    showAlert('Error submitting contact form: ' + error.message, 'error');
                }
            } finally {
                // Re-enable submit button
                submitButton.textContent = originalText;
                submitButton.disabled = false;
                hideLoading();
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
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
            
            const response = await fetch('/api/admin/status', {
                credentials: 'include',
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            return data.loggedIn;
        } catch (error) {
            console.error('Error checking admin status:', error);
            if (error.name === 'AbortError') {
                showAlert('Request timeout. Please try again.', 'error');
            }
            return false;
        }
    }

    async function fetchRegisteredUsers() {
        showLoading('Loading registered users...');
        const isLoggedIn = await checkAdminStatus();
        if (!isLoggedIn) {
            hideLoading();
            showAlert('You must be logged in to view registered users.', 'error');
            userDataBody.innerHTML = '<tr><td colspan="3">You must be logged in to view registered users.</td></tr>';
            return;
        }
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
            
            const response = await fetch('/api/registered-users', {
                credentials: 'include',
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }
            const users = await response.json();
            displayRegisteredUsers(users);
        } catch (error) {
            console.error('Error fetching registered users:', error);
            if (error.name === 'AbortError') {
                showAlert('Request timeout. Please try again.', 'error');
            } else {
                showAlert('Error loading registered users: ' + error.message, 'error');
            }
            userDataBody.innerHTML = '<tr><td colspan="3">Error loading registered users.</td></tr>';
        } finally {
            hideLoading();
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

    // Enhanced alert function with better styling and accessibility
    function showAlert(message, type) {
        // Remove any existing alerts
        const existingAlert = document.querySelector('.custom-alert');
        if (existingAlert) {
            existingAlert.remove();
        }

        // Create alert element
        const alert = document.createElement('div');
        alert.className = `alert alert-${type} custom-alert`;
        alert.setAttribute('role', 'alert');
        alert.setAttribute('aria-live', 'polite');
        alert.textContent = message;

        // Add close button
        const closeBtn = document.createElement('span');
        closeBtn.innerHTML = '&times;';
        closeBtn.style.float = 'right';
        closeBtn.style.cursor = 'pointer';
        closeBtn.style.fontSize = '1.5em';
        closeBtn.style.lineHeight = '0.5';
        closeBtn.style.fontWeight = 'bold';
        closeBtn.setAttribute('aria-label', 'Close alert');
        closeBtn.setAttribute('tabindex', '0');
        closeBtn.onclick = () => alert.remove();
        closeBtn.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                alert.remove();
            }
        });
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

        // Focus the alert for accessibility
        alert.focus();
    }
});
