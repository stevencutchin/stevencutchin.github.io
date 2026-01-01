// Hamburger menu toggle functionality
document.addEventListener('DOMContentLoaded', function() {
  const menuToggle = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.nav--header');
  const navOverlay = document.querySelector('.nav-overlay');
  const navLinks = document.querySelectorAll('.list--nav a');

  if (menuToggle && nav) {
    // Toggle menu
    menuToggle.addEventListener('click', function() {
      menuToggle.classList.toggle('active');
      nav.classList.toggle('active');
      if (navOverlay) {
        navOverlay.classList.toggle('active');
      }
      document.body.style.overflow = nav.classList.contains('active') ? 'hidden' : '';
    });

    // Close menu when clicking overlay
    if (navOverlay) {
      navOverlay.addEventListener('click', function() {
        menuToggle.classList.remove('active');
        nav.classList.remove('active');
        navOverlay.classList.remove('active');
        document.body.style.overflow = '';
      });
    }

    // Close menu when clicking a link (mobile only)
    navLinks.forEach(function(link) {
      link.addEventListener('click', function() {
        if (window.innerWidth <= 768) {
          menuToggle.classList.remove('active');
          nav.classList.remove('active');
          if (navOverlay) {
            navOverlay.classList.remove('active');
          }
          document.body.style.overflow = '';
        }
      });
    });

    // Close menu on window resize if it becomes desktop view
    window.addEventListener('resize', function() {
      if (window.innerWidth > 768) {
        menuToggle.classList.remove('active');
        nav.classList.remove('active');
        if (navOverlay) {
          navOverlay.classList.remove('active');
        }
        document.body.style.overflow = '';
      }
    });
  }
});

