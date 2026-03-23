import Fuse from 'fuse.js';

const $ = (sel) => document.querySelector(sel);
const categoryGrid = $('#category-grid');
const searchInput = $('#search');
const searchResults = $('#search-results');
const categoryDetail = $('#category-detail');
const categoriesSection = $('#categories');
const detailTitle = $('#detail-title');
const detailPackages = $('#detail-packages');
const backBtn = $('#back-btn');
const statusBar = $('#status-bar');

let fuse = null;
let allPackagesData = null;

// --- Boot ---
loadCategories();
loadStatus();

// --- Categories ---
async function loadCategories() {
  const res = await fetch('/api/categories');
  const data = await res.json();
  categoryGrid.innerHTML = data.categories
    .map(
      (c) => `
    <div class="cat-card" data-slug="${c.slug}">
      <h3>${c.name}</h3>
      <span class="count">${c.count} packages</span>
    </div>`,
    )
    .join('');

  searchInput.placeholder = `Search ${data.totalPackages} packages…`;

  categoryGrid.addEventListener('click', (e) => {
    const card = e.target.closest('.cat-card');
    if (card) showCategory(card.dataset.slug);
  });
}

// --- Category detail ---
const categoryCache = {};

async function showCategory(slug) {
  categoriesSection.classList.add('hidden');
  searchResults.classList.add('hidden');
  categoryDetail.classList.remove('hidden');
  detailPackages.innerHTML = '<div class="loading">Loading</div>';

  if (!categoryCache[slug]) {
    const res = await fetch(`/api/category/${slug}`);
    categoryCache[slug] = await res.json();
  }

  const cat = categoryCache[slug];
  detailTitle.textContent = cat.name;
  detailPackages.innerHTML = '';

  if (cat.curated.length) {
    detailPackages.innerHTML += renderSection('Curated', cat.curated, 'curated');
  }
  if (cat.discovered.length) {
    detailPackages.innerHTML += renderSection('Discovered', cat.discovered, 'discovered');
  }
}

function renderSection(title, packages, type) {
  const items = packages
    .map((p) => `<div class="pkg-item"><span class="badge badge-${type}">${type}</span> ${p}</div>`)
    .join('');
  return `<div class="pkg-section"><h4>${title} (${packages.length})</h4>${items}</div>`;
}

backBtn.addEventListener('click', () => {
  categoryDetail.classList.add('hidden');
  searchResults.classList.add('hidden');
  categoriesSection.classList.remove('hidden');
});

// --- Search ---
async function ensureSearchIndex() {
  if (fuse) return;
  if (!allPackagesData) {
    const res = await fetch('/api/packages');
    allPackagesData = await res.json();
  }
  fuse = new Fuse(allPackagesData.packages, {
    keys: ['name'],
    threshold: 0.4,
    distance: 100,
  });
}

let debounceTimer = null;

searchInput.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  const query = searchInput.value.trim();

  if (!query) {
    searchResults.classList.add('hidden');
    categoryDetail.classList.add('hidden');
    categoriesSection.classList.remove('hidden');
    return;
  }

  debounceTimer = setTimeout(async () => {
    await ensureSearchIndex();
    const results = fuse.search(query, { limit: 50 });
    categoryDetail.classList.add('hidden');
    categoriesSection.classList.add('hidden');
    searchResults.classList.remove('hidden');

    if (!results.length) {
      searchResults.innerHTML = '<div class="no-results">No packages found</div>';
      return;
    }

    searchResults.innerHTML = results
      .map((r) => {
        const pkg = r.item;
        const catBadge = pkg.category
          ? `<span class="badge badge-category">${pkg.category}</span>`
          : '';
        const typeBadge = pkg.type
          ? `<span class="badge badge-${pkg.type}">${pkg.type}</span>`
          : '';
        return `<div class="pkg-item">${typeBadge}${catBadge} ${pkg.name}</div>`;
      })
      .join('');
  }, 150);
});

// --- Status ---
async function loadStatus() {
  try {
    const res = await fetch('/api/status');
    if (!res.ok) return;
    const data = await res.json();
    statusBar.textContent = `${data.success} cached · ${data.failed} failed · ${data.total} total`;
  } catch {
    statusBar.textContent = 'offline-setup';
  }
}
