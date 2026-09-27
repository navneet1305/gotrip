/**
 * Navigation Bar Mobile Drawer Toggle Handler
 * Unifies mobile menu toggle across all pages
 */
document.addEventListener('DOMContentLoaded', function() {
    const menuToggle = document.getElementById('mobile-menu') || document.querySelector('.menu-toggle');
    const menu = document.querySelector('.menu');

    if (menuToggle && menu) {
        menuToggle.addEventListener('click', function(e) {
            e.stopPropagation();
            menuToggle.classList.toggle('is-active');
            menu.classList.toggle('active');
        });

        // Close menu when clicking anywhere outside
        document.addEventListener('click', function(e) {
            if (menu.classList.contains('active') && !menu.contains(e.target) && !menuToggle.contains(e.target)) {
                menuToggle.classList.remove('is-active');
                menu.classList.remove('active');
            }
        });

        // Close drawer when navigating to an anchor link on the same page
        menu.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', function() {
                menuToggle.classList.remove('is-active');
                menu.classList.remove('active');
            });
        });
    }
});
