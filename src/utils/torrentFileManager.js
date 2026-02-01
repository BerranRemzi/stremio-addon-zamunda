const crypto = require('crypto');

class TorrentFileManager {
    constructor() {
        // Use in-memory cache for Vercel serverless functions
        this.cache = new Map();
        this.maxCacheSize = 50; // Limit cache size to prevent memory issues
        this.cacheStats = {
            hits: 0,
            misses: 0,
            evictions: 0
        };
    }

    // Generate a unique key for the torrent URL
    _getCacheKey(torrentUrl) {
        return crypto.createHash('md5').update(torrentUrl).digest('hex');
    }

    // Get cached torrent buffer for a torrent URL
    async getLocalPath(torrentUrl) {
        const cacheKey = this._getCacheKey(torrentUrl);
        const cached = this.cache.get(cacheKey);
        
        if (cached) {
            this.cacheStats.hits++;
            return cached.buffer;
        }
        
        this.cacheStats.misses++;
        return null;
    }

    // Save a torrent file to cache
    async saveTorrentFile(torrentUrl, torrentBuffer) {
        const cacheKey = this._getCacheKey(torrentUrl);
        
        // Check if cache is full and evict oldest entries if needed
        if (this.cache.size >= this.maxCacheSize) {
            this._evictOldestEntries();
        }
        
        try {
            this.cache.set(cacheKey, {
                buffer: torrentBuffer,
                timestamp: Date.now(),
                url: torrentUrl
            });
            
            return torrentBuffer; // Return buffer instead of file path
        } catch (error) {
            console.error('Error saving torrent file to cache:', error);
            throw error;
        }
    }

    // Get cached torrent buffer for a torrent URL (alias for compatibility)
    async getLocalFileUrl(torrentUrl) {
        const buffer = await this.getLocalPath(torrentUrl);
        return buffer;
    }

    // List all cached torrent files
    async listCachedTorrents() {
        const torrents = [];
        
        for (const [key, data] of this.cache.entries()) {
            torrents.push({
                filename: `${key}.torrent`,
                size: data.buffer.length,
                created: new Date(data.timestamp),
                url: data.url,
                cacheKey: key
            });
        }
        
        return torrents.sort((a, b) => b.created - a.created); // Sort by newest first
    }

    // Evict oldest cache entries when cache is full
    _evictOldestEntries() {
        const entries = Array.from(this.cache.entries());
        entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
        
        // Remove oldest 25% of entries
        const toRemove = Math.floor(this.maxCacheSize * 0.25);
        for (let i = 0; i < toRemove && i < entries.length; i++) {
            this.cache.delete(entries[i][0]);
            this.cacheStats.evictions++;
        }
    }

    // Get cache statistics
    getCacheStats() {
        return {
            ...this.cacheStats,
            size: this.cache.size,
            maxSize: this.maxCacheSize,
            hitRate: this.cacheStats.hits / (this.cacheStats.hits + this.cacheStats.misses) || 0
        };
    }

    // Clear all cached data
    clearCache() {
        this.cache.clear();
        this.cacheStats = { hits: 0, misses: 0, evictions: 0 };
        console.log('Cache cleared');
    }
}

module.exports = TorrentFileManager;