const { addonBuilder } = require("stremio-addon-sdk");
const magnet = require("magnet-uri");
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
    "version": "1.0.0",

    "name": "Zamunda Addon",
    "description": "Sample addon providing streams of zamunda.net torrents",

    // set what type of resources we will return
    "resources": [
        "stream"
    ],

    "types": ["movie", "series"], // your add-on will be preferred for those content types

    "catalogs": [],

    // prefix of item IDs (ie: "tt0032138")
    "idPrefixes": [ "tt" ]

};

const dataset = {
    // fileIdx is the index of the file within the torrent ; if not passed, the largest file will be selected
    "tt0032138": { name: "The Wizard of Oz", type: "movie", infoHash: "24c8802e2624e17d46cd555f364debd949f2c81e", fileIdx: 0 },
    "tt0017136": { name: "Metropolis", type: "movie", infoHash: "dca926c0328bb54d209d82dc8a2f391617b47d7a", fileIdx: 1 },

    // night of the living dead, example from magnet
    "tt0063350": fromMagnet("Night of the Living Dead", "movie", "magnet:?xt=urn:btih:A7CFBB7840A8B67FD735AC73A373302D14A7CDC9&dn=night+of+the+living+dead+1968+remastered+bdrip+1080p+ita+eng+x265+nahom&tr=udp%3A%2F%2Ftracker.publicbt.com%2Fannounce&tr=udp%3A%2F%2Fglotorrents.pw%3A6969%2Fannounce&tr=udp%3A%2F%2Ftracker.openbittorrent.com%3A80%2Fannounce"),
    "tt0051744": { name: "House on Haunted Hill", type: "movie", infoHash: "9f86563ce2ed86bbfedd5d3e9f4e55aedd660960" },

    "tt1254207": { name: "Big Buck Bunny", type: "movie", url: "http://clips.vorwaerts-gmbh.de/big_buck_bunny.mp4" }, // HTTP stream
    "tt0031051": { name: "The Arizona Kid", type: "movie", ytId: "m3BKVSpP80s" }, // YouTube stream

    "tt0137523": { name: "Fight Club", type: "movie", externalUrl: "https://www.netflix.com/watch/26004747" }, // redirects to Netflix

    "tt1748166:1:1": { name: "Pioneer One", type: "series", infoHash: "07a9de9750158471c3302e4e95edb1107f980fa6" }, // torrent for season 1, episode 1
};

// utility function to add from magnet
function fromMagnet(name, type, uri) {
    const parsed = magnet.decode(uri);
    const infoHash = parsed.infoHash.toLowerCase();
    const tags = [];
    if (uri.match(/720p/i)) tags.push("720p");
    if (uri.match(/1080p/i)) tags.push("1080p");
    return {
        name: name,
        type: type,
        infoHash: infoHash,
        sources: (parsed.announce || []).map(function(x) { return "tracker:"+x }).concat(["dht:"+infoHash]),
        tag: tags,
        title: tags[0], // show quality in the UI
    }
}

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

const builder = new addonBuilder(manifest);

// Streams handler
builder.defineStreamHandler(async function(args) {
let title = "Unknown Title";

    // args.id is usually "ttXXXXXXX:Movie Name"
    const imdbId = args.id.split(":")[0];

    try {
        // Get movie title from OMDB (with cache)
        let data = getCachedOmdb(imdbId);
        if (!data) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
            
            try {
                const res = await fetch(`https://www.omdbapi.com/?i=${imdbId}&apikey=${OMDB_API_KEY}`, {
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
                data = await res.json();
                if (data && data.Response !== 'False') setCachedOmdb(imdbId, data);
            } catch (error) {
                clearTimeout(timeoutId);
                if (error.name === 'AbortError') {
                    console.error('OMDB API request timed out');
                } else {
                    console.error('OMDB API request failed:', error.message);
                }
                data = null;
            }
        }
        if (data && data.Title) {
            title = `${data.Title} ${data.Year}`;
        }
        
        // Ensure ZamundaAPI is initialized before use
        await zamunda.ensureInitialized();
        
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
    return Promise.resolve({ streams: [] });
})

const METAHUB_URL = "https://images.metahub.space"

const generateMetaPreview = function(value, key) {
    // To provide basic meta for our movies for the catalog
    // we'll fetch the poster from Stremio's MetaHub
    // see https://github.com/Stremio/stremio-addon-sdk/blob/master/docs/api/responses/meta.md#meta-preview-object
    const imdbId = key.split(":")[0]
    return {
        id: imdbId,
        type: value.type,
        name: value.name,
        poster: METAHUB_URL+"/poster/medium/"+imdbId+"/img",
    }
}


module.exports = builder.getInterface()
