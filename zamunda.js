const axios = require('axios');
const cheerio = require('cheerio');
const tough = require('tough-cookie');
const { wrapper } = require('axios-cookiejar-support');
const { TextDecoder } = require('util');
const TorrentFileManager = require('./torrentFileManager');
const parseTorrent = require('parse-torrent');
const fs = require('fs');

class ZamundaAPI {
    constructor(config) {
        this.config = {
            username: config.username,
            password: config.password,
            baseUrl: 'https://zamunda.net'
        };
        
        // Create axios instance with cookie support
        this.cookieJar = new tough.CookieJar();
        this.client = wrapper(axios.create({ jar: this.cookieJar }));
        this.isLoggedIn = false;
        this.loginPromise = null;
        this.torrentManager = new TorrentFileManager();
    }

    // Login method
    async login() {
        if (this.isLoggedIn) {
            return true;
        }

        // Prevent multiple simultaneous login attempts
        if (this.loginPromise) {
            return this.loginPromise;
        }

        this.loginPromise = (async () => {
            try {
                console.log('Attempting to login to Zamunda...');

                // First, get the login page to get any CSRF tokens if needed
                await this.client.get(`${this.config.baseUrl}/takelogin.php`, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                });

                // Perform login
                const loginResponse = await this.client.post(
                    `${this.config.baseUrl}/takelogin.php`,
                    new URLSearchParams({
                        username: this.config.username,
                        password: this.config.password,
                        returnto: '/'
                    }),
                    {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                            'Content-Type': 'application/x-www-form-urlencoded',
                            'Referer': `${this.config.baseUrl}/login.php`
                        },
                        maxRedirects: 5
                    }
                );

                // Check if login was successful
                const cookies = await this.cookieJar.getCookies(this.config.baseUrl);
                const hasSessionCookie = cookies.some(c => 
                    c.key.toLowerCase().includes('session') || 
                    c.key.toLowerCase().includes('uid') ||
                    c.key.toLowerCase().includes('pass')
                );

                if (hasSessionCookie) {
                    this.isLoggedIn = true;
                    console.log('✓ Successfully logged in to Zamunda');
                    return true;
                } else {
                    console.error('✗ Login failed - no session cookie found');
                    console.log('Response status:', loginResponse.status);
                    return false;
                }
            } catch (error) {
                console.error('✗ Login error:', error.message);
                return false;
            } finally {
                this.loginPromise = null;
            }
        })();

        return this.loginPromise;
    }

// Login function
    // Helper method to ensure we're logged in before making requests
    async ensureLoggedIn() {
        if (!this.isLoggedIn) {
            await this.login();
        }
        return this.isLoggedIn;
    }

    // Search method
    async search(query) {
        try {
            await this.ensureLoggedIn();

            const searchUrl = `${this.config.baseUrl}/catalogs/movies?letter=&t=movie&search=${encodeURIComponent(query).replace(/%20/g, '+')}&field=name&comb=yes`;
            
            console.log('Searching:', searchUrl);

            const response = await this.client.get(searchUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept-Charset': 'UTF-8'
                },
                responseType: 'arraybuffer'
            });

            // Decode the response with Windows-1251 (Cyrillic) encoding
            const decoder = new TextDecoder('windows-1251');
            const html = decoder.decode(response.data);
            const $ = cheerio.load(html, { decodeEntities: false });
            const movies = [];

            // First collect movie titles and IDs
            $('td.colheadd').each((i, elem) => {
                const link = $(elem).find('a[href*="/banan?id="]');
                const title = link.text().trim();
                const href = link.attr('href');
                
                if (title && href) {
                    const match = href.match(/id=(\d+)/);
                    const movieId = match ? match[1] : null;
                    
                    if (movieId) {
                        movies.push({
                            id: movieId,
                            title: title,
                            torrentUrl: null
                        });
                    }
                }
            });

            // Then find and add torrent links
            $('a[href*="/download.php/"], a[href*=".torrent"]').each((i, elem) => {
                if (i < movies.length) {
                    const torrentLink = $(elem).attr('href');
                    if (torrentLink) {
                        movies[i].torrentUrl = torrentLink.startsWith('http') ? 
                            torrentLink : `${this.config.baseUrl}${torrentLink}`;
                    }
                }
            });

            console.log(`Found ${movies.length} movies`);
            return movies;
        } catch (error) {
            console.error('Error searching Zamunda:', error.message);
            return [];
        }
    }

    // Get torrent URL from details page
    async getTorrentUrl(detailsUrl) {
        try {
            await this.ensureLoggedIn();

            const response = await this.client.get(detailsUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            const $ = cheerio.load(response.data);
            
            // Look for any anchor tag with href containing download.php and .torrent
            const links = $('a').filter((i, el) => {
                const href = $(el).attr('href');
                return href && 
                       (href.includes('download.php') || 
                        href.includes('.torrent') ||
                        href.match(/\/download\.php\/\d+\//));
            });

            let torrentLink = null;
            
            if (links.length > 0) {
                torrentLink = links.first().attr('href');
            }
            
            if (torrentLink) {
                // Clean up the URL (remove any style attributes that might be in the href)
                torrentLink = torrentLink.split("'")[0];
                const fullUrl = torrentLink.startsWith('http') ? torrentLink : `${this.config.baseUrl}${torrentLink}`;
                console.log('Found torrent URL:', fullUrl);
                return fullUrl;
            }
            
            console.log('No torrent link found on page');
            return null;
        } catch (error) {
            console.error('Error getting torrent URL:', error.message);
            return null;
        }
    }

    // Method to search by IMDB ID
    async searchByTitle(movieTitle) {
        try {
            // Search using the IMDB ID
            const results = await this.search(movieTitle);
            
            // Filter results that might match the IMDB ID (you might want to improve this matching)
            const matches = results;

            if (matches.length > 0) {
                // Convert matches directly to torrents
                const torrents = matches
                    .map(movie => ({
                        title: `${movie.title}\n`,
                        url: movie.torrentUrl,
                        size: 'Unknown', // You could add size parsing if available
                        seeders: 'Unknown', // You could add seeders parsing if available
                        leechers: 'Unknown' // You could add leechers parsing if available
                    }));
                return torrents;
            }
            return [];
        } catch (error) {
            console.error('Error searching by IMDB ID:', error);
            return [];
        }
    }

    // Download and cache a torrent file
    async downloadTorrentFile(torrentUrl) {
        try {
            // Check if we already have this torrent file
            const localPath = await this.torrentManager.getLocalPath(torrentUrl);
            if (localPath) {
                return localPath;
            }

            // Download the torrent file
            const response = await this.client.get(torrentUrl, {
                responseType: 'arraybuffer',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            // Save the torrent file
            return await this.torrentManager.saveTorrentFile(torrentUrl, response.data);
        } catch (error) {
            console.error('Error downloading torrent file:', error);
            throw error;
        }
    }

    // Format torrents as Stremio streams
    async formatTorrentsAsStreams(torrents) {
        const streams = [];  // Array to store all formatted streams
        
        for (const torrent of torrents) {
            try {
                // Step 1: Check for cached torrent file
                let finalUrl = await this.torrentManager.getLocalFileUrl(torrent.url);
                let localPath;
                
                // Step 2: Get or download the torrent file
                if (!finalUrl) {
                    // If not cached, download it
                    localPath = await this.downloadTorrentFile(torrent.url);
                    finalUrl = `file://${localPath}`;
                } else {
                    // If cached, get path from URL
                    localPath = finalUrl.replace('file://', '');
                }
                console.log('Using torrent file at:', localPath);
                // Step 3: Parse the torrent file
                const torrentData = fs.readFileSync(localPath);
                const parsedTorrent = parseTorrent(torrentData);
                //"👤${movie.seeders || 'Unknown'} 💾 ${movie.size || 'Unknown'}"
                torrent.seeders = parsedTorrent.seeders;
                torrent.size = `${(parsedTorrent.length / (1024*1024*1024)).toFixed(2)} GB`;
                
                // Step 4: Create Stremio stream object
                streams.push({
                    name: 'zamunda',
                    title: torrent.title+`👤${torrent.seeders || 'Unknown'} 💾 ${torrent.size || 'Unknown'}`,
                    infoHash: parsedTorrent.infoHash,
                    type: 'stream'
                });
            } catch (error) {
                // Step 5: Fallback handling
                console.error(`Error processing torrent: ${error.message}`);
                streams.push({
                    name: 'zamunda',
                    title: torrent.title,
                    url: torrent.url,
                    type: 'movie'
                });
            }
        }
        
        return streams;
    }
}

module.exports = ZamundaAPI;

