const axios = require('axios');
const tough = require('tough-cookie');
const { TextDecoder } = require('util');
const TorrentFileManager = require('./torrentFileManager');
const ZamundaMovieParser = require('./zamunda-movie-parser');
const ZamundaSeriesParser = require('./zamunda-series-parser');
// Removed fs dependency - using in-memory caching instead

class ZamundaAPI {
	constructor(config) {
		this.config = {
			username: config.username,
			password: config.password,
			baseUrl: 'https://zamunda.net'
		};
		
		// Initialize async components
		this.cookieJar = new tough.CookieJar();
		this.client = null; // Will be initialized in init()
		this.isLoggedIn = false;
		this.loginPromise = null;
		this.torrentManager = new TorrentFileManager();
		this.movieParser = new ZamundaMovieParser(this.config.baseUrl);
		this.seriesParser = new ZamundaSeriesParser(this.config.baseUrl);
		this.initialized = false;
	}

	// Initialize the axios client with cookie support using dynamic import
	async init() {
		if (this.initialized) return;
		
		try {
			const { wrapper } = await import('axios-cookiejar-support');
			this.client = wrapper(axios.create({ jar: this.cookieJar }));
			this.initialized = true;
		} catch (error) {
			throw new Error(`Failed to initialize ZamundaAPI: ${error.message}`);
		}
	}

	// Helper method to ensure API is initialized
	async ensureInitialized() {
		if (!this.initialized) {
			await this.init();
		}
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
				await this.ensureInitialized();

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
		await this.ensureInitialized();
		if (!this.isLoggedIn) {
			await this.login();
		}
		return this.isLoggedIn;
	}

	// Search method for movies
	async search(query) {
		try {
			await this.ensureLoggedIn();

			const searchUrl = `${this.config.baseUrl}/catalogs/movies?letter=&t=movie&search=${encodeURIComponent(query).replace(/%20/g, '+')}&field=name&comb=yes`;
			

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
				
				// Use the movie parser to extract movie data
				return this.movieParser.parseMovies(html, query);
		} catch (error) {
			console.error('Error searching Zamunda:', error.message);
			return [];
		}
	}

	// Search method for series
	async searchSeries(query) {
		try {
			await this.ensureLoggedIn();

			const searchUrl = `${this.config.baseUrl}/catalogs/series?letter=&t=series&search=${encodeURIComponent(query).replace(/%20/g, '+')}&field=name&comb=yes`;
			

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
				
				// Use the series parser to extract series data
				return this.seriesParser.parseSeries(html, query);
		} catch (error) {
			console.error('Error searching Zamunda series:', error.message);
			return [];
		}
	}



	/**
	 * Search for movies by title and optionally by year
	 * @param {string} title - Movie title to search for
	 * @param {number|string} year - Optional year to filter results (e.g., 2012 or "2012")
	 * @returns {Array} Array of torrent objects matching the search criteria
	 */
	async searchByTitle(title, year = null) {
		try {
			if (!title || typeof title !== 'string') {
				console.warn('Invalid title provided to searchByTitle');
				return [];
			}

			// Print the searched movie
			const searchDisplay = year ? `${title} (${year})` : title;
			console.log(`🔍 Searching for movie: ${searchDisplay}`);
			
			// Normalize the search title (replace hyphens, dots, colons with spaces)
			const normalizedTitle = this.normalizeSearchTitle(title);
			
			// Perform the search
			const searchQuery = year ? `${normalizedTitle} ${year}` : normalizedTitle;
			const results = await this.search(searchQuery);
			
			if (results.length === 0) {
				console.log(`❌ No movies found for: ${searchDisplay}`);
				return [];
			}


			// Filter results based on title and year matching
			const filteredResults = this.filterMoviesByTitleAndYear(results, normalizedTitle, year);
			
			if (filteredResults.length === 0) {
				console.log(`❌ No matching movies found for: ${searchDisplay}`);
				return [];
			}

			console.log(`✅ Found ${filteredResults.length} matching movies for: ${searchDisplay}`);
			
			// Convert filtered results to torrents
			return this.movieParser.convertMoviesToTorrents(filteredResults);
		} catch (error) {
			throw new Error(`Error searching by title: ${error.message}`);
			return [];
		}
	}

	/**
	 * Search for series by title and optionally by year
	 * @param {string} title - Series title to search for
	 * @param {number|string} year - Optional year to filter results
	 * @param {number} season - Optional season number
	 * @param {number} episode - Optional episode number
	 * @returns {Array} Array of torrent objects matching the search criteria
	 */
	async searchSeriesByTitle(title, year = null, season = null, episode = null) {
		try {
			if (!title || typeof title !== 'string') {
				console.warn('Invalid title provided to searchSeriesByTitle');
				return [];
			}

			// Print the searched series
			let searchDisplay = year ? `${title} (${year})` : title;
			if (season !== null) {
				searchDisplay += ` S${String(season).padStart(2, '0')}`;
				if (episode !== null) {
					searchDisplay += `E${String(episode).padStart(2, '0')}`;
				}
			}
			console.log(`🔍 Searching for series: ${searchDisplay}`);
			
			// Normalize the search title
			const normalizedTitle = this.normalizeSearchTitle(title);
			
			// Build search query with season/episode if provided
			let searchQuery = normalizedTitle;
			if (year) {
				searchQuery += ` ${year}`;
			}
			if (season !== null) {
				searchQuery += ` S${String(season).padStart(2, '0')}`;
			}
			
			// Perform the search
			const results = await this.searchSeries(searchQuery);
			
			if (results.length === 0) {
				console.log(`❌ No series found for: ${searchDisplay}`);
				return [];
			}

			// Filter results based on title matching
			const filteredResults = this.filterSeriesByTitle(results, normalizedTitle, season, episode);
			
			if (filteredResults.length === 0) {
				console.log(`❌ No matching series found for: ${searchDisplay}`);
				return [];
			}

			console.log(`✅ Found ${filteredResults.length} matching series for: ${searchDisplay}`);
			
			// Convert filtered results to torrents
			return this.seriesParser.convertSeriesToTorrents(filteredResults);
		} catch (error) {
			console.error(`Error searching series by title: ${error.message}`);
			return [];
		}
	}

	/**
	 * Normalize search title by replacing hyphens, dots, and colons with spaces
	 * @param {string} title - Search title to normalize
	 * @returns {string} Normalized search title
	 */
	normalizeSearchTitle(title) {
		if (!title) return '';
		return title
			.trim()
			.replace(/[-\.:]/g, ' ') // Replace hyphens, dots, and colons with spaces
			.replace(/\s+/g, ' ') // Replace multiple spaces with single space
			.trim();
	}

	/**
	 * Filter movie results based on title containment and year matching
	 * @param {Array} movies - Array of movie objects from search results
	 * @param {string} searchTitle - Original search title
	 * @param {number|string|null} searchYear - Optional year to match
	 * @returns {Array} Filtered array of movies
	 */
	filterMoviesByTitleAndYear(movies, searchTitle, searchYear = null) {
		if (!movies || movies.length === 0) return [];

		const searchYearNum = searchYear ? parseInt(searchYear, 10) : null;

		return movies.filter(movie => {
			// Check if the search title is contained in the movie title (case-insensitive)
			const titleContained = movie.title.toLowerCase().includes(searchTitle.toLowerCase());
			
			// Check year match if year is provided
			let yearMatch = true;
			if (searchYearNum && !isNaN(searchYearNum)) {
				yearMatch = this.extractYearFromTitle(movie.title) === searchYearNum;
			}
			
			return titleContained && yearMatch;
		});
	}

	/**
	 * Filter series results based on title and season/episode
	 * @param {Array} series - Array of series objects from search results
	 * @param {string} searchTitle - Original search title
	 * @param {number|null} season - Optional season to match
	 * @param {number|null} episode - Optional episode to match
	 * @returns {Array} Filtered array of series
	 */
	filterSeriesByTitle(series, searchTitle, season = null, episode = null) {
		if (!series || series.length === 0) return [];

		return series.filter(s => {
			// Check if the search title is contained in the series title (case-insensitive)
			const titleContained = s.title.toLowerCase().includes(searchTitle.toLowerCase());
			
			if (!titleContained) return false;

			// If season/episode filtering is not needed, include all matching titles
			if (season === null && episode === null) {
				return true;
			}

			// Extract season/episode info from the series title
			const seasonEpisode = this.seriesParser.extractSeasonEpisode(s.title);
			
			// Match season if provided
			if (season !== null) {
				// Include season packs for the requested season
				if (seasonEpisode.isPack && seasonEpisode.season === season) {
					return true;
				}
				
				// Include specific episodes
				if (seasonEpisode.season === season) {
					// If episode is specified, match it or include packs
					if (episode !== null) {
						return seasonEpisode.episode === episode || seasonEpisode.isPack;
					}
					return true;
				}
				
				return false;
			}
			
			return true;
		});
	}


	/**
	 * Extract year from movie title
	 * @param {string} title - Movie title that may contain year
	 * @returns {number|null} Extracted year or null if not found
	 */
	extractYearFromTitle(title) {
		if (!title) return null;
		
		// Look for 4-digit year pattern (1900-2099)
		const yearMatch = title.match(/\b(19|20)\d{2}\b/);
		return yearMatch ? parseInt(yearMatch[0], 10) : null;
	}

	// Download and cache a torrent file
	async downloadTorrentFile(torrentUrl) {
		try {
			await this.ensureInitialized();
			
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
			throw new Error(`Error downloading torrent file: ${error.message}`);
			// Return null instead of throwing to allow graceful degradation
			return null;
		}
	}

	// Format torrents as Stremio streams (bounded parallelism)
	async formatTorrentsAsStreams(torrents, type = 'movie', season = null, episode = null) {
		// Create a function to get torrent buffer for the parser
		const getTorrentBuffer = async (torrentUrl) => {
			// Try to get cached torrent buffer first
			let torrentBuffer = await this.torrentManager.getLocalPath(torrentUrl);
			if (!torrentBuffer) {
				torrentBuffer = await this.downloadTorrentFile(torrentUrl);
			}
			return torrentBuffer;
		};

		// Use the appropriate parser based on type
		if (type === 'series') {
			return await this.seriesParser.formatTorrentsAsStreams(torrents, getTorrentBuffer, season, episode);
		} else {
			return await this.movieParser.formatTorrentsAsStreams(torrents, getTorrentBuffer);
		}
	}
}

module.exports = ZamundaAPI;

