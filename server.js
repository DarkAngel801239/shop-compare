require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // serves index.html, style.css, app.js

const PORT = process.env.PORT || 3000;
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const AMAZON_HOST = 'real-time-amazon-data.p.rapidapi.com';
const EBAY_HOST = 'real-time-ebay-data.p.rapidapi.com';

const AMAZON_AFFILIATE_TAG = process.env.AMAZON_AFFILIATE_TAG || '';

// Turns one Amazon product object into our common shape.
// If an affiliate tag is set, it's appended to the link so clicks earn commission.
function normalizeAmazonProduct(item) {
  let link = item.product_url || '#';
  if (AMAZON_AFFILIATE_TAG && link !== '#') {
    const separator = link.includes('?') ? '&' : '?';
    link = `${link}${separator}tag=${AMAZON_AFFILIATE_TAG}`;
  }

  return {
    title: item.product_title || 'Unknown product',
    image: item.product_photo || 'https://placehold.co/200x200?text=No+Image',
    price: item.product_price || 'Price unavailable',
    store: 'Amazon',
    rating: item.product_star_rating || null,
    link
  };
}

// Turns one eBay product object into our common shape.
// eBay's field names are a best guess based on this provider's other APIs —
// check the server logs after your first real search; if fields come back
// as "Unknown product" or missing prices, adjust the fallbacks below to match.
function normalizeEbayProduct(item) {
  return {
    title: item.product_title || item.title || item.item_title || 'Unknown product',
    image: item.product_photo || item.image || item.thumbnail || 'https://placehold.co/200x200?text=No+Image',
    price: item.product_price || item.price || item.current_price || 'Price unavailable',
    store: 'eBay',
    rating: item.product_rating || item.seller_rating || null,
    link: item.product_url || item.item_url || item.link || '#'
  };
}

async function fetchAmazon(query) {
  const url = `https://${AMAZON_HOST}/search?query=${encodeURIComponent(query)}&page=1&country=US&sort_by=RELEVANCE`;
  const response = await fetch(url, {
    headers: { 'X-RapidAPI-Key': RAPIDAPI_KEY, 'X-RapidAPI-Host': AMAZON_HOST }
  });
  if (!response.ok) {
    console.error('Amazon API error:', response.status, await response.text());
    return [];
  }
  const data = await response.json();
  const rawList = data?.data?.products || [];
  return rawList.map(normalizeAmazonProduct);
}

async function fetchEbay(query) {
  const url = `https://${EBAY_HOST}/search?query=${encodeURIComponent(query)}&country=US`;
  const response = await fetch(url, {
    headers: { 'X-RapidAPI-Key': RAPIDAPI_KEY, 'X-RapidAPI-Host': EBAY_HOST }
  });
  if (!response.ok) {
    console.error('eBay API error:', response.status, await response.text());
    return [];
  }
  const data = await response.json();
  console.log('Raw eBay response (check field names here if products look wrong):', JSON.stringify(data).slice(0, 1000));
  const rawList = data?.data?.products || data?.data || [];
  return rawList.map(normalizeEbayProduct);
}

// This is the endpoint our frontend calls: /api/search?q=headphones
// It queries Amazon and eBay in parallel and returns one merged list.
app.get('/api/search', async (req, res) => {
  const query = req.query.q;

  if (!query) {
    return res.status(400).json({ error: 'Missing search query. Use ?q=something' });
  }

  if (!RAPIDAPI_KEY || RAPIDAPI_KEY === 'paste_your_rapidapi_key_here') {
    return res.status(500).json({
      error: 'Server is missing a RapidAPI key. Add it to your .env file as RAPIDAPI_KEY.'
    });
  }

  try {
    // Promise.allSettled means if one store's API fails, we still return
    // results from the other instead of failing the whole search.
    const [amazonResult, ebayResult] = await Promise.allSettled([
      fetchAmazon(query),
      fetchEbay(query)
    ]);

    const amazonProducts = amazonResult.status === 'fulfilled' ? amazonResult.value : [];
    const ebayProducts = ebayResult.status === 'fulfilled' ? ebayResult.value : [];

    if (amazonResult.status === 'rejected') console.error('Amazon fetch failed:', amazonResult.reason);
    if (ebayResult.status === 'rejected') console.error('eBay fetch failed:', ebayResult.reason);

    const allProducts = [...amazonProducts, ...ebayProducts];

    res.json({ products: allProducts });

  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Something went wrong on the server', details: err.message });
  }
});

// Takes a list of products (sent from the frontend) and asks Gemini to
// pick the best value and explain why in plain language.
app.post('/api/recommend', async (req, res) => {
  const { products, query } = req.body;

  if (!products || !Array.isArray(products) || products.length === 0) {
    return res.status(400).json({ error: 'No products provided' });
  }

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'paste_your_gemini_key_here') {
    return res.status(500).json({
      error: 'Server is missing a Gemini API key. Add it to your .env file as GEMINI_API_KEY.'
    });
  }

  // Trim down to the fields Gemini actually needs — keeps the prompt small and cheap
  const productSummary = products.slice(0, 10).map((p, i) =>
    `${i + 1}. "${p.title}" — ${p.price} on ${p.store}${p.rating ? `, rated ${p.rating}★` : ''}`
  ).join('\n');

  const prompt = `A user searched for "${query}" on a shopping comparison site and got these results:

${productSummary}

In 2-3 short sentences, recommend which one is the best value and briefly say why (consider price, rating, and how well it matches the search term). Be direct and concise, no preamble.`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Gemini API error:', response.status, errText);
      return res.status(response.status).json({ error: 'AI recommendation failed', details: errText });
    }

    const data = await response.json();
    const recommendation = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No recommendation available.';

    res.json({ recommendation });

  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Something went wrong generating the recommendation', details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});