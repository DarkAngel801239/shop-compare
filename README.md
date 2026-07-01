# ShopCompare

An AI-assisted product comparison tool — search once, see prices across multiple stores.

## How it works
- `public/` — the frontend (what users see): search bar + results grid
- `server.js` — a small backend that securely calls the RapidAPI "Real-Time Product Search" API
  and passes results to the frontend (keeps your API key hidden from users)
- `.env` — holds your private API key (never upload this file to GitHub — it's already in `.gitignore`)

## Setup (do this once)

1. **Install Node.js** if you don't have it: https://nodejs.org (LTS version)

2. **Install dependencies** — open a terminal in this folder and run:
   ```
   npm install
   ```

3. **Get a free API key**:
   - Go to https://rapidapi.com and sign up
   - Search for "Real-Time Amazon Data"
   - Subscribe to the Free/Basic plan
   - Copy your API key from the API's page

4. **Add your key** — open `.env` and replace `paste_your_rapidapi_key_here` with your real key
   - ⚠️ Never share this key or paste it anywhere public (chat, GitHub, screenshots). If a key
     is ever exposed, regenerate it immediately from your RapidAPI account dashboard.

**Note:** This version searches **Amazon only** (this particular API doesn't cover other stores).
True multi-store comparison is a Stage 2 step — see "Next steps" below.

## Run it locally

```
npm start
```

Then open **http://localhost:3000** in your browser and try searching for a product.

## Debugging tip
Open your browser's Developer Console (F12 → Console tab) after a search. We log the raw
API response there — since APIs sometimes return fields under slightly different names than
expected, check the console output and adjust the `extractProducts()` function in
`public/app.js` if products aren't displaying correctly.

## Deploying

- **Frontend + Backend together**: Deploy the whole project to **Render** or **Railway** (both
  have free tiers). GitHub Pages alone won't work here because it can't run the Node.js server
  or hide your API key.
- Push this project to a GitHub repo first, then connect that repo to Render/Railway — they'll
  auto-deploy from it. You'll add your `RAPIDAPI_KEY` as an environment variable in their
  dashboard (not in a committed `.env` file).

## Next steps / ideas
- **Add a second store** — sign up for another API (e.g. an eBay or Walmart data API on RapidAPI),
  add a second fetch in `server.js`, and merge both result lists before sending to the frontend.
  This is how we go from "Amazon search" to genuine multi-store comparison.
- Add a Claude API call that summarizes the results ("best value pick" recommendation)
- Add affiliate link tagging once you're approved for Amazon Associates / Flipkart Affiliate
- Add price history tracking (store daily prices in a small database)
- Add filters (sort by price, rating, store)
