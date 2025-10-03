const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class TorrentFileManager {
    constructor() {
        this.cacheDir = path.join(__dirname, 'torrent-cache');
        this.ensure();
    }

    async ensure() {
        try {
            await fs.mkdir(this.cacheDir, { recursive: true });
        } catch (error) {
            console.error('Error creating cache directory:', error);
        }
    }

    // Generate a unique filename for the torrent URL
    _getFilename(torrentUrl) {
        const hash = crypto.createHash('md5').update(torrentUrl).digest('hex');
        return `${hash}.torrent`;
    }

    // Get the local path for a torrent file
    async getLocalPath(torrentUrl) {
        const filename = this._getFilename(torrentUrl);
        const filePath = path.join(this.cacheDir, filename);
        
        try {
            await fs.access(filePath);
            return filePath;
        } catch {
            return null;
        }
    }

    // Save a torrent file to cache
    async saveTorrentFile(torrentUrl, torrentBuffer) {
        const filename = this._getFilename(torrentUrl);
        const filePath = path.join(this.cacheDir, filename);
        
        try {
            await fs.writeFile(filePath, torrentBuffer);
            return filePath;
        } catch (error) {
            console.error('Error saving torrent file:', error);
            throw error;
        }
    }

    // Get local file path for a torrent URL
    async getLocalFileUrl(torrentUrl) {
        const localPath = await this.getLocalPath(torrentUrl);
        console.log('Local path for torrent URL:', localPath);
        return localPath;
    }

    // List all cached torrent files
    async listCachedTorrents() {
        try {
            const files = await fs.readdir(this.cacheDir);
            const torrents = [];
            
            for (const file of files) {
                if (file.endsWith('.torrent')) {
                    const filePath = path.join(this.cacheDir, file);
                    const stats = await fs.stat(filePath);
                    
                    torrents.push({
                        filename: file,
                        size: stats.size,
                        created: stats.ctime,
                        path: filePath
                    });
                }
            }
            
            return torrents.sort((a, b) => b.created - a.created); // Sort by newest first
        } catch (error) {
            console.error('Error listing cached torrents:', error);
            return [];
        }
    }

    // Get the cache directory path
    getCacheDir() {
        return this.cacheDir;
    }
}

module.exports = TorrentFileManager;