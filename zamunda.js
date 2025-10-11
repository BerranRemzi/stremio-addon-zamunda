const axios = require('axios');
const { parse } = require('node-html-parser');
const tough = require('tough-cookie');
const { wrapper } = require('axios-cookiejar-support');
const { TextDecoder } = require('util');
const TorrentFileManager = require('./torrentFileManager');
const parseTorrent = require('parse-torrent');
// Removed fs dependency - using in-memory caching instead

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
					timeout: 10000, // 10 second timeout
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
						timeout: 15000, // 15 second timeout for login
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
			
			console.log('Searching:', query);

			const response = await this.client.get(searchUrl, {
				timeout: 15000, // 15 second timeout
				headers: {
					'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
					'Accept-Charset': 'UTF-8'
				},
				responseType: 'arraybuffer'
			});

			// Decode the response with Windows-1251 (Cyrillic) encoding
			const decoder = new TextDecoder('windows-1251');
			const html = decoder.decode(response.data);
			
			// Parse HTML with error handling
			let root;
			try {
				root = parse(html);
			} catch (parseError) {
				console.error('HTML parsing failed, using regex fallback:', parseError.message);
				// Fallback to regex parsing if HTML parser fails
				return this.parseWithRegex(html, query);
			}
			const movies = [];

			// First collect movie titles and IDs
			const titleCells = root.querySelectorAll('td.colheadd');
			titleCells.forEach((elem) => {
				const link = elem.querySelector('a[href*="/banan?id="]');
				if (link) {
					const title = link.text.trim();
					const href = link.getAttribute('href');
					
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
				}
			});

			// Then find and add torrent links
			const torrentLinks = root.querySelectorAll('a[href*="/download.php/"], a[href*=".torrent"]');
			torrentLinks.forEach((elem, i) => {
				if (i < movies.length) {
					const torrentLink = elem.getAttribute('href');
					if (torrentLink) {
						movies[i].torrentUrl = torrentLink.startsWith('http') ? 
							torrentLink : `${this.config.baseUrl}${torrentLink}`;
					}
				}
			});

			// Find and add seeders count
			const seederCells = root.querySelectorAll('td.tddownloaded center font a');
			seederCells.forEach((elem, i) => {
				if (i < movies.length) {
					const seedersElement = elem.querySelector('b');
					if (seedersElement) {
						const seeders = seedersElement.text.trim();
						if (seeders) {
							movies[i].seeders = parseInt(seeders, 10) || 0;
						}
					}
				}
			});

			//console.log(`Found ${movies.length} movies`);
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
				timeout: 10000, // 10 second timeout
				headers: {
					'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
				}
			});

			const root = parse(response.data);
			
			// Look for any anchor tag with href containing download.php and .torrent
			const links = root.querySelectorAll('a');
			let torrentLink = null;
			
			for (const link of links) {
				const href = link.getAttribute('href');
				if (href && 
					(href.includes('download.php') || 
					 href.includes('.torrent') ||
					 href.match(/\/download\.php\/\d+\//))) {
					torrentLink = href;
					break;
				}
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

	// Fallback regex parsing method
	parseWithRegex(html, query) {
		const movies = [];
		try {
			// Simple regex patterns to extract movie data
			const titleRegex = /<a[^>]*href="[^"]*\/banan\?id=(\d+)"[^>]*>([^<]+)<\/a>/gi;
			const torrentRegex = /<a[^>]*href="([^"]*(?:download\.php|\.torrent)[^"]*)"[^>]*>/gi;
			
			let match;
			while ((match = titleRegex.exec(html)) !== null) {
				movies.push({
					id: match[1],
					title: match[2].trim(),
					torrentUrl: null,
					seeders: 0
				});
			}
			
			// Try to match torrent links with movies
			let torrentMatch;
			let movieIndex = 0;
			while ((torrentMatch = torrentRegex.exec(html)) !== null && movieIndex < movies.length) {
				const torrentUrl = torrentMatch[1];
				if (torrentUrl) {
					movies[movieIndex].torrentUrl = torrentUrl.startsWith('http') ? 
						torrentUrl : `${this.config.baseUrl}${torrentUrl}`;
					movieIndex++;
				}
			}
			
			console.log(`Regex fallback found ${movies.length} movies`);
			return movies;
		} catch (error) {
			console.error('Regex parsing also failed:', error.message);
			return [];
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
						size: 'Unknown',
						seeders: movie.seeders,
						leechers: 'Unknown'
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
			// Check if we already have this torrent file in cache
			const cachedBuffer = await this.torrentManager.getLocalPath(torrentUrl);
			if (cachedBuffer) {
				return cachedBuffer;
			}

			// Download the torrent file with timeout
			const response = await this.client.get(torrentUrl, {
				responseType: 'arraybuffer',
				timeout: 10000, // 10 second timeout
				headers: {
					'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
				}
			});

			// Save the torrent file to in-memory cache
			return await this.torrentManager.saveTorrentFile(torrentUrl, response.data);
		} catch (error) {
			console.error('Error downloading torrent file:', error);
			// Return null instead of throwing to allow graceful degradation
			return null;
		}
	}

	// Format torrents as Stremio streams (bounded parallelism)
	async formatTorrentsAsStreams(torrents) {
		const limit = (concurrency) => {
			let active = 0; const queue = [];
			const next = () => {
				if (active >= concurrency || queue.length === 0) return;
				active++;
				const { fn, resolve, reject } = queue.shift();
				fn().then(resolve, reject).finally(() => { active--; next(); });
			};
			return (fn) => new Promise((resolve, reject) => { queue.push({ fn, resolve, reject }); process.nextTick(next); });
		};

		const withLimit = limit(3);

		const tasks = torrents.map((torrent) => withLimit(async () => {
			try {
				// Prefer resolution from URL (torrent name)
				const resMatch = (torrent.url || '').match(/\b(480p|720p|1080p|2160p|4K)\b/i);
				const resolution = resMatch ? resMatch[1] : 'Unknown';

				// Try to get cached torrent buffer, but don't fail if we can't
				let torrentBuffer = await this.torrentManager.getLocalPath(torrent.url);
				if (!torrentBuffer) {
					torrentBuffer = await this.downloadTorrentFile(torrent.url);
				}

				// If we have a torrent buffer, try to parse it
				if (torrentBuffer) {
					try {
						const parsedTorrent = parseTorrent(torrentBuffer);
						const sizeGb = parsedTorrent.length ? `${(parsedTorrent.length / (1024*1024*1024)).toFixed(2)} GB` : 'Unknown';

						return {
							name: `zamunda\n${resolution}`,
							title: `${torrent.title}👤${torrent.seeders || 'Unknown'} 💾 ${sizeGb}`,
							infoHash: parsedTorrent.infoHash,
							type: 'stream'
						};
					} catch (parseError) {
						console.error(`Error parsing torrent buffer: ${parseError.message}`);
					}
				}

				// Fallback: return basic stream info without parsing
				return {
					name: `zamunda\n${resolution}`,
					title: `${torrent.title}👤${torrent.seeders || 'Unknown'}`,
					url: torrent.url,
					type: 'movie'
				};
			} catch (error) {
				console.error(`Error processing torrent: ${error.message}`);
				const resMatch = (torrent.title || '').match(/\b(720p|1080p|2160p|4K)\b/i);
				const resolution = resMatch ? resMatch[1] : 'Unknown';
				return {
					name: `zamunda\n${resolution}`,
					title: torrent.title,
					url: torrent.url,
					type: 'movie'
				};
			}
		}));

		const results = await Promise.all(tasks);
		return results;
	}
}

module.exports = ZamundaAPI;

