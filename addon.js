const { addonBuilder } = require("stremio-addon-sdk");
const ZamundaAPI = require('./zamunda');
require('dotenv').config();

// Use environment variables
const OMDB_API_KEY = process.env.OMDB_API_KEY;

// Initialize Zamunda API with credentials
const zamunda = new ZamundaAPI({
    username: process.env.ZAMUNDA_USERNAME,
    password: process.env.ZAMUNDA_PASSWORD
});

const manifest = {
    "id": "org.stremio.zamunda",
    "version": "1.2.0",
    "name": "Zamunda",
    "description": "Stream movies and series from Zamunda.net",
    "resources": ["stream"],
    "types": ["movie", "series"],
    "catalogs": [],
    "idPrefixes": ["tt"],
    "behaviorHints": {
        "adult": false
    }
};

// Simple in-memory OMDB cache to reduce duplicate requests
const omdbCache = new Map();
const OMDB_TTL_MS = 24 * 60 * 60 * 1000; // 24h

function getCachedOmdb(id) {
    const entry = omdbCache.get(id);
    if (!entry) return null;
    if (Date.now() - entry.t > OMDB_TTL_MS) {
        omdbCache.delete(id);
        return null;
    }
    return entry.v;
}

function setCachedOmdb(id, value) {
    omdbCache.set(id, { v: value, t: Date.now() });
}

const builder = new addonBuilder(manifest);

// Stream handler
builder.defineStreamHandler(async function(args) {
    let title = "Unknown Title";
    const imdbId = args.id.split(":")[0];
    const type = args.type; // 'movie' or 'series'
    
    // For series, extract season and episode from id (format: tt1234567:1:5 for season 1 episode 5)
    let season = null;
    let episode = null;
    if (type === 'series') {
        const parts = args.id.split(":");
        if (parts.length >= 3) {
            season = parseInt(parts[1], 10);
            episode = parseInt(parts[2], 10);
        }
    }

    try {
        // Get title from OMDB (with cache)
        let data = getCachedOmdb(imdbId);
        if (!data) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            
            try {
                const res = await fetch(`https://www.omdbapi.com/?i=${imdbId}&apikey=${OMDB_API_KEY}`, {
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
                data = await res.json();
                if (data && data.Response !== 'False') setCachedOmdb(imdbId, data);
            } catch (error) {
                clearTimeout(timeoutId);
                console.error('OMDB API request failed:', error.message);
                data = null;
            }
        }
        
        if (!data || !data.Title) {
            console.log(`No data found for ${imdbId}`);
            return { streams: [] };
        }
        
        // Ensure ZamundaAPI is initialized before use
        await zamunda.ensureInitialized();
        
        // Search for torrents on Zamunda based on type
        let torrents;
        if (type === 'series') {
            torrents = await zamunda.searchSeriesByTitle(data.Title, data.Year, season, episode);
        } else {
            torrents = await zamunda.searchByTitle(data.Title, data.Year);
        }
        
        if (torrents.length > 0) {
            const streams = await zamunda.formatTorrentsAsStreams(torrents, type, season, episode);
            return { streams };
        } else {
            console.log(`No torrents found for ${data.Title} (${imdbId})`);
            return { streams: [] };
        }
    } catch (error) {
        console.error("Error fetching data:", error);
        return { streams: [] };
    }
});

module.exports = builder.getInterface();
