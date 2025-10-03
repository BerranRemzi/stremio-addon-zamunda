const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");
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
    version: "1.0.0",
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

builder.defineStreamHandler(async (args) => {
    let title = "Unknown Title";

    // args.id is usually "ttXXXXXXX:Movie Name"
    const imdbId = args.id.split(":")[0];

    try {
        // Get movie title from OMDB
        const res = await fetch(`https://www.omdbapi.com/?i=${imdbId}&apikey=${OMDB_API_KEY}`);
        const data = await res.json();
        if (data && data.Title) {
            title = `${data.Title} ${data.Year}`;
        }
        
        // Search for torrents on Zamunda
        const torrents = await zamunda.searchByTitle(title);
        if (torrents.length > 0) {
            console.log(`Found ${torrents.length} torrents for ${title} (${imdbId})`);
            //torrents.forEach(torrent => console.log(`Torrent link: ${torrent.url}`));
            
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

const express = require('express');
const createTorrentServer = require('./torrentServer');

// Create the main Express app
const app = express();

// Mount Stremio addon at /stremio
serveHTTP(builder.getInterface(), { port: 7000 });

// Mount torrent server at root
app.use('/torrent', createTorrentServer(zamunda));

// Start HTTP server
app.listen(7000, () => {
    console.log("Zamunda Stremio addon running at:");
    console.log("- Addon: http://127.0.0.1:7000/manifest.json");
    console.log("- Torrent browser: http://127.0.0.1:7000/torrent")
});
