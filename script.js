document.addEventListener('DOMContentLoaded', function() {
    // Handle contact form submission
    const contactForm = document.getElementById('contact-form');
    if (contactForm) {
        contactForm.addEventListener('submit', async function(event) {
            event.preventDefault();

            const name = document.getElementById('name').value.trim();
            const email = document.getElementById('email').value.trim();
            const whatsapp = document.getElementById('whatsapp').value.trim();

            if (!name || !email || !whatsapp) {
                alert('Please fill in all fields.');
                return;
            }

            // Simple email validation
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                alert('Please enter a valid email address.');
                return;
            }

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

                alert('Thank you for contacting us, ' + name + '! Your message has been submitted.');
                contactForm.reset();
            } catch (error) {
                console.error('Error submitting contact form:', error);
                alert('Error submitting contact form. Please try again.');
            }
        });
    }

    // Fetch and display registered users on the registered-users.html page
    const userDataBody = document.getElementById('user-data');
    if (userDataBody) {
        fetchRegisteredUsers();
    }

    async function fetchRegisteredUsers() {
        try {
            const response = await fetch('/api/registered-users');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const users = await response.json();
            displayRegisteredUsers(users);
        } catch (error) {
            console.error('Error fetching registered users:', error);
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
});
