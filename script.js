// Enhanced frontend JavaScript with better error handling and performance optimizations
document.addEventListener('DOMContentLoaded', function() {

    // Enhanced alert system
    function showAlert(message, type = 'info') {
        // Remove existing alerts
        const existingAlerts = document.querySelectorAll('.custom-alert');
        existingAlerts.forEach(alert => alert.remove());

        // Create alert element
        const alert = document.createElement('div');
        alert.className = `custom-alert alert-${type}`;
        alert.innerHTML = `
            <div class="alert-content">
                <span class="alert-icon">${getAlertIcon(type)}</span>
                <span class="alert-message">${message}</span>
                <button class="alert-close" onclick="this.parentElement.parentElement.remove()">&times;</button>
            </div>
        `;

        // Add to page
        document.body.appendChild(alert);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (alert.parentNode) {
                alert.remove();
            }
        }, 5000);

        // Add animation
        setTimeout(() => alert.classList.add('show'), 100);
    }

    function getAlertIcon(type) {
        const icons = {
            success: '✓',
            error: '✗',
            warning: '⚠',
            info: 'ℹ'
        };
        return icons[type] || icons.info;
    }

    // Make showAlert available globally
    window.showAlert = showAlert;

    // Side panel functionality - skip if on admin page with custom handling
    const menuToggle = document.getElementById('menu-toggle');
    const sidePanel = document.getElementById('side-panel');

    // Check if this is admin page with custom handling
    const isAdminPage = window.adminPageLoaded || window.location.pathname.includes('admin.html');
    
    function showPanel() {
        if (sidePanel) sidePanel.classList.add('open');
    }

    function hidePanel() {
        if (sidePanel) sidePanel.classList.remove('open');
    }

    if (menuToggle && !isAdminPage) {
        menuToggle.addEventListener('mouseenter', showPanel);
        menuToggle.addEventListener('click', showPanel);
    } else if (menuToggle && isAdminPage) {
        // For admin page, only use click (not hover) to avoid conflicts
        menuToggle.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            if (sidePanel.classList.contains('open')) {
                hidePanel();
            } else {
                showPanel();
            }
        });
    }

    if (sidePanel) {
        sidePanel.addEventListener('mouseleave', hidePanel);
    }

    // Close side panel when clicking outside
    document.addEventListener('click', function(event) {
        if (sidePanel && menuToggle) {
            const isClickInsidePanel = sidePanel.contains(event.target);
            const isClickOnMenuToggle = menuToggle.contains(event.target);

            if (!isClickInsidePanel && !isClickOnMenuToggle && sidePanel.classList.contains('open')) {
                hidePanel();
            }
        }
    });

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

            const name = document.getElementById('contact-name')?.value.trim() || document.getElementById('name')?.value.trim() || '';
            const email = document.getElementById('contact-email')?.value.trim() || document.getElementById('email')?.value.trim() || '';
            const whatsapp = document.getElementById('contact-whatsapp')?.value.trim() || document.getElementById('whatsapp')?.value.trim() || '';
            const submitButton = contactForm.querySelector('.form-submit') || contactForm.querySelector('button[type="submit"]');

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
            const originalText = submitButton ? submitButton.textContent : 'Submit';
            if (submitButton) {
                submitButton.textContent = 'Submitting...';
                submitButton.disabled = true;
            }
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
                if (submitButton) {
                    submitButton.textContent = originalText;
                    submitButton.disabled = false;
                }
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
            
            // Only update admin link visibility if we have specific admin links (not side panel)
            const adminLink = document.getElementById('admin-link');
            if (adminLink) {
                adminLink.style.display = data.loggedIn ? 'block' : 'none';
            }
            
            // ALWAYS keep side panel admin link visible for easy access
            // Don't hide it based on login status
            const adminLinkSide = document.getElementById('admin-link-side');
            if (adminLinkSide) {
                adminLinkSide.style.display = 'block'; // Always visible
            }
            
            return data.loggedIn;
        } catch (error) {
            console.error('Error checking admin status:', error);
            if (error.name === 'AbortError') {
                showAlert('Request timeout. Please try again.', 'error');
            }
            
            // Only hide specific admin links, not side panel
            const adminLink = document.getElementById('admin-link');
            if (adminLink) {
                adminLink.style.display = 'none';
            }
            
            // Keep side panel admin link visible even on error
            const adminLinkSide = document.getElementById('admin-link-side');
            if (adminLinkSide) {
                adminLinkSide.style.display = 'block'; // Always visible
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

    // API Functions for fetching data
    async function fetchPlayers(limit = null) {
        try {
            const url = limit ? `/api/players?limit=${limit}` : '/api/players';
            const response = await fetch(url);
            if (!response.ok) throw new Error('Failed to fetch players');
            return await response.json();
        } catch (error) {
            console.error('Error fetching players:', error);
            return [];
        }
    }

    async function fetchManagers(limit = null) {
        try {
            const url = limit ? `/api/managers?limit=${limit}` : '/api/managers';
            const response = await fetch(url);
            if (!response.ok) throw new Error('Failed to fetch managers');
            return await response.json();
        } catch (error) {
            console.error('Error fetching managers:', error);
            return [];
        }
    }

    async function fetchTrophies(limit = null) {
        try {
            const url = limit ? `/api/trophies?limit=${limit}` : '/api/trophies';
            const response = await fetch(url);
            if (!response.ok) throw new Error('Failed to fetch trophies');
            return await response.json();
        } catch (error) {
            console.error('Error fetching trophies:', error);
            return [];
        }
    }

    // Display functions for cards
    function displayPlayers(players, containerId, isHomePage = true) {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (players.length === 0) {
            container.innerHTML = '<p class="text-center">No players found.</p>';
            return;
        }

        container.innerHTML = '';
        players.forEach(player => {
            const card = document.createElement('div');
            card.className = 'player-card';
            
            // Generate stars HTML
            let starsHTML = '';
            for (let i = 0; i < player.stars; i++) {
                starsHTML += '<span class="star filled">★</span>';
            }
            for (let i = player.stars; i < 5; i++) {
                starsHTML += '<span class="star">★</span>';
            }
            
            // Format joined date
            const joinedDate = new Date(player.joined_date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
            
            card.innerHTML = `
                <div class="player-card-inner">
                    <div class="player-card-front" style="background-image: url('${player.imageUrl || '/uploads/default-player.jpg'}')">
                    </div>
                    <div class="player-card-back">
                        <div class="card-back-content">
                            <h3 class="card-back-name">${player.name}</h3>
                            <div class="card-back-stats">
                                <div class="stat-item">
                                    <span class="stat-label">Jersey Number:</span>
                                    <span class="stat-value">${player.jerseyNumber || '?'}</span>
                                </div>
                                <div class="stat-item">
                                    <span class="stat-label">Rating:</span>
                                    <span class="stat-value">${starsHTML}</span>
                                </div>
                                <div class="stat-item">
                                    <span class="stat-label">Joined:</span>
                                    <span class="stat-value">${joinedDate}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            container.appendChild(card);
        });
    }

    function displayManagers(managers, containerId, isHomePage = true) {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (managers.length === 0) {
            container.innerHTML = '<p class="text-center">No managers found.</p>';
            return;
        }

        container.innerHTML = '';
        managers.forEach(manager => {
            const card = document.createElement('div');
            card.className = 'manager-card';
            
            card.innerHTML = `
                <div class="manager-card-inner">
                    <div class="manager-card-front" style="background-image: url('${manager.imageUrl || '/uploads/default-manager.jpg'}')">
                    </div>
                    <div class="manager-card-back">
                        <div class="card-back-content">
                            <h3 class="card-back-name">${manager.name}</h3>
                            <p class="card-back-details">${manager.role}</p>
                        </div>
                    </div>
                </div>
            `;
            container.appendChild(card);
        });
    }

    function displayTrophies(trophies, containerId, isHomePage = true) {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (trophies.length === 0) {
            container.innerHTML = '<p class="text-center">No trophies found.</p>';
            return;
        }

        container.innerHTML = '';
        trophies.forEach(trophy => {
            const card = document.createElement('div');
            card.className = 'trophy-card';
            
            card.innerHTML = `
                <div class="trophy-card-inner">
                    <div class="trophy-card-front" style="background-image: url('${trophy.imageUrl || '/uploads/default-trophy.jpg'}')">
                    </div>
                    <div class="trophy-card-back">
                        <div class="card-back-content">
                            <h3 class="card-back-name">${trophy.name}</h3>
                            <p class="card-back-details">Awarded in ${trophy.year}</p>
                        </div>
                    </div>
                </div>
            `;
            container.appendChild(card);
        });
    }

    // Note: checkAdminStatus() is called on demand, not automatically
    // This prevents hiding the admin link unnecessarily
    
    // Export functions to global scope for use in inline scripts
    window.fetchPlayers = fetchPlayers;
    window.fetchManagers = fetchManagers;
    window.fetchTrophies = fetchTrophies;
    window.displayPlayers = displayPlayers;
    window.displayManagers = displayManagers;
    window.displayTrophies = displayTrophies;
    window.checkAdminStatus = checkAdminStatus;
});
