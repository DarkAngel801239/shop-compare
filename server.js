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
const RAPIDAPI_HOST = 'real-time-amazon-data.p.rapidapi.com';

// This is the endpoint our frontend calls: /api/search?q=headphones
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
    const url = `https://${RAPIDAPI_HOST}/search?query=${encodeURIComponent(query)}&page=1&country=US&sort_by=RELEVANCE`;

    const apiResponse = await fetch(url, {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': RAPIDAPI_KEY,
        'X-RapidAPI-Host': RAPIDAPI_HOST
      }
    });

    if (!apiResponse.ok) {
      const errText = await apiResponse.text();
      console.error('RapidAPI error:', apiResponse.status, errText);
      return res.status(apiResponse.status).json({ error: 'Product search API failed', details: errText });
    }

    const data = await apiResponse.json();

    // We send the raw data back to the frontend for now.
    // Once you see the real shape of this response (check your browser console),
    // we can clean/simplify it here before sending it on.
    res.json(data);

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