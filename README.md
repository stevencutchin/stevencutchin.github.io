# Website for Steven Cutchin

A simple static HTML website for Steven Cutchin, professor at Boise State University.

## Structure

This is a static HTML website that can be edited directly. No build process is required.

- `index.html` - Home page
- `luminary.html` - Luminary project page
- `research.html` - Research information
- `students.html` - Current and former students
- `links.html` - External links
- `search.html` - Search page
- `404.html` - 404 error page
- `assets/` - CSS, images, logos, and other static assets
  - `styles.css` - Main stylesheet
  - `images/` - Image files
  - `logos/` - Logo files

## Editing the Site

Simply edit the HTML files directly using any text editor or Cursor. The site uses:

- **HTML5** for structure
- **CSS3** for styling (in `assets/styles.css`)
- **SVG icons** embedded in each page
- **Responsive design** that works on mobile and desktop

## Viewing Locally

The site uses **relative paths**, so you can view it in two ways:

### Option 1: Open directly in browser (easiest)
Simply double-click any HTML file (e.g., `index.html`) to open it in your browser. All assets and links will work correctly.

### Option 2: Use a local HTTP server
You can also view the site using a simple HTTP server:

**Python 3:**
```bash
python3 -m http.server 8000
```

**Python 2:**
```bash
python -m SimpleHTTPServer 8000
```

**Node.js (with http-server):**
```bash
npx http-server -p 8000
```

**PHP:**
```bash
php -S localhost:8000
```

Then open `http://localhost:8000` in your browser.

## Deploying to GitHub Pages

Simply push your changes to the repository. GitHub Pages will automatically serve the HTML files.

## Adding SVG Content

You can add SVG content directly in HTML files:

```html
<!-- Inline SVG -->
<svg width="100" height="100">
  <circle cx="50" cy="50" r="40" fill="blue"/>
</svg>

<!-- Or reference an SVG file -->
<img src="/assets/images/my-image.svg" alt="Description">
```

## Notes

- The old Jekyll files (`_config.yml`, `_layouts/`, `_includes/`, `_posts/`, `_sass/`, etc.) are still in the repository but are no longer used. You can remove them if desired.
- The site is designed to be simple and maintainable - just edit HTML and CSS directly.
