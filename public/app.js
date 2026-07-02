const form = document.getElementById('search-form');
const input = document.getElementById('search-input');
const statusEl = document.getElementById('status');
const resultsEl = document.getElementById('results');
const aiEl = document.getElementById('ai-recommendation');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const query = input.value.trim();
  if (!query) return;

  resultsEl.innerHTML = '';
  aiEl.innerHTML = '';
  statusEl.textContent = `Searching for "${query}"...`;

  try {
    const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    const data = await response.json();

    if (!response.ok) {
      statusEl.textContent = `Error: ${data.error || 'Something went wrong'}`;
      return;
    }

    // IMPORTANT: This logs the raw API response so you can see its real shape.
    // Open your browser console (F12 or right-click > Inspect > Console) to view it.
    console.log('Raw API response:', data);

    const products = extractProducts(data);

    if (products.length === 0) {
      statusEl.textContent = `No results found for "${query}". Check the console — the API response shape might differ from what we expect.`;
      return;
    }

    statusEl.textContent = `Found ${products.length} results for "${query}"`;
    renderProducts(products);
    fetchRecommendation(query, products);

  } catch (err) {
    console.error(err);
    statusEl.textContent = 'Network error — is the server running?';
  }
});

async function fetchRecommendation(query, products) {
  aiEl.innerHTML = `<div class="ai-box ai-loading">🤖 Thinking about the best value...</div>`;

  try {
    const response = await fetch('/api/recommend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, products })
    });

    const data = await response.json();

    if (!response.ok) {
      aiEl.innerHTML = `<div class="ai-box ai-error">Couldn't generate a recommendation: ${escapeHtml(data.error || 'unknown error')}</div>`;
      return;
    }

    aiEl.innerHTML = `<div class="ai-box"><strong>🤖 AI Pick:</strong> ${escapeHtml(data.recommendation)}</div>`;

  } catch (err) {
    console.error(err);
    aiEl.innerHTML = `<div class="ai-box ai-error">Couldn't reach the AI recommendation service.</div>`;
  }
}

// Maps the Real-Time Amazon Data API's response shape into what our UI needs.
// Its products live at data.data.products, each with fields like
// product_title, product_price, product_photo, product_url, product_star_rating.
function extractProducts(data) {
  const rawList = data?.data?.products || [];

  return rawList.map(item => ({
    title: item.product_title || 'Unknown product',
    image: item.product_photo || 'https://placehold.co/200x200?text=No+Image',
    price: item.product_price || 'Price unavailable',
    store: 'Amazon',
    rating: item.product_star_rating || null,
    link: item.product_url || '#'
  })).filter(p => p.title !== 'Unknown product');
}

function renderProducts(products) {
  resultsEl.innerHTML = products.map(p => `
    <div class="product-card">
      <img src="${p.image}" alt="${escapeHtml(p.title)}" onerror="this.src='https://placehold.co/200x200?text=No+Image'">
      <h3>${escapeHtml(p.title)}</h3>
      <div class="price">${typeof p.price === 'number' ? '$' + p.price : p.price}</div>
      <div class="store">${escapeHtml(p.store)}${p.rating ? ' · ⭐ ' + p.rating : ''}</div>
      <a href="${p.link}" target="_blank" rel="noopener noreferrer">View Deal</a>
    </div>
  `).join('');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}