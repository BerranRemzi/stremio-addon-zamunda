# Stremio Zamunda Addon

A Stremio addon that provides streaming access to torrents from Zamunda.net.

## Features

- 🔍 Search movies by IMDB ID
- 🎬 Stream torrents directly in Stremio
- 💾 In-memory torrent caching for better performance
- 🚀 Deployed on Vercel serverless functions
- 🔐 Secure login with Zamunda.net

## Setup

1. Clone this repository
2. Install dependencies: `npm install`
3. Set up environment variables:
   ```
   ZAMUNDA_USERNAME=your_username
   ZAMUNDA_PASSWORD=your_password
   OMDB_API_KEY=your_omdb_api_key
   ```
4. Deploy to Vercel: `vercel --prod`

## Usage

Add the addon URL to Stremio:
```
https://your-vercel-app.vercel.app/manifest.json
```

## Files

- `addon.js` - Main Stremio addon interface
- `zamunda.js` - Zamunda.net API integration
- `torrentFileManager.js` - In-memory torrent caching
- `serverless.js` - Vercel serverless function handler

## License

MIT