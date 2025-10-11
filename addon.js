const { addonBuilder } = require("stremio-addon-sdk");
const fetch = require("node-fetch");
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
    id: "net.zamunda.stremio",
    version: "0.1.0",
    name: "Zamunda Stremio Addon",
    description: "Stream torrents from Zamunda.net",
    types: ["movie"],
    catalogs: [],
    resources: ["stream"],
    behaviorHints: {
        adult: false,
    }
};

const builder = new addonBuilder(manifest);

// Simple in-memory OMDB cache to reduce duplicate requests during browsing
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

builder.defineStreamHandler(async (args) => {
    let title = "Unknown Title";

    // args.id is usually "ttXXXXXXX:Movie Name"
    const imdbId = args.id.split(":")[0];

    try {
        // Get movie title from OMDB (with cache)
        let data = getCachedOmdb(imdbId);
        if (!data) {
            const res = await fetch(`https://www.omdbapi.com/?i=${imdbId}&apikey=${OMDB_API_KEY}`);
            data = await res.json();
            if (data && data.Response !== 'False') setCachedOmdb(imdbId, data);
        }
        if (data && data.Title) {
            title = `${data.Title} ${data.Year}`;
        }
        
        // Search for torrents on Zamunda
        const torrents = await zamunda.searchByTitle(title);
        if (torrents.length > 0) {
            console.log(`Found ${torrents.length} torrents for ${title} (${imdbId})`);
            
            // Format streams with local torrent files
            const streams = await zamunda.formatTorrentsAsStreams(torrents);
            return { streams };
        } else {
            console.log(`No torrents found for ${title} (${imdbId})`);
            return { streams: [] };
        }
    } catch (error) {
        console.error("Error fetching data:", error);
        return { streams: [] };
    }
});

module.exports = builder.getInterface()