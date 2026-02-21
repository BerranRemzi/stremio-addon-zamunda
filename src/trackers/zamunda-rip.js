const axios = require('axios');
const { parse } = require('node-html-parser');
const ZamundaRipParser = require('../parsers/zamunda-rip-parser');
const { extractResolution } = require('../utils/resolutionExtractor');

class ZamundaRIPAPI {
	constructor(config) {
		const envLimitRaw = process.env.ZAMUNDA_RIP_LIMIT;
		const parsedEnvLimit = Number.parseInt(envLimitRaw, 10);
		const defaultLimit = Number.isFinite(parsedEnvLimit) ? parsedEnvLimit : 50;

		const configLimit = config && config.limit;
		const finalLimit = Number.isFinite(configLimit) ? configLimit : defaultLimit;

		this.config = {
			baseUrl: 'https://zamunda.rip',
			apiEndpoint: 'https://zamunda.rip/api/torznab/api',
			limit: finalLimit
		};

		// Track one-time initialization state to match other tracker interfaces
		this.initialized = false;
		
		// Initialize parser
		this.movieParser = new ZamundaRipParser(this.config.baseUrl);
	}

	/**
	 * Ensure the tracker is initialized.
	 * For Zamunda.rip this is a lightweight, idempotent no-op that simply
	 * marks the instance as initialized so it matches the expected tracker interface.
	 */
	async ensureInitialized() {
		if (this.initialized) {
			return;
		}

		// No authentication or remote setup is required for Zamunda.rip.
		// This hook exists to keep the tracker interface consistent.
		this.initialized = true;
	}
	// Search method using Torznab API
	async search(query) {
		try {
			const response = await axios.get(this.config.apiEndpoint, {
				params: {
					t: 'search',
					q: query,
					limit: this.config.limit
				},
				timeout: 30000,
				headers: {
					'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
				}
			});

			// Parse the Torznab XML response
			const results = this.parseTorznabResponse(response.data);
			return results;
		} catch (error) {
			console.error('❌ Error searching Zamunda.rip API:', error.message);
			return [];
		}
	}

	// Parse Torznab XML response
	parseTorznabResponse(xmlData) {
		try {
			const root = parse(xmlData);
			const items = root.querySelectorAll('item');
			const movies = [];

			items.forEach((item) => {
				try {
					const titleEl = item.querySelector('title');
					const linkEl = item.querySelector('link');
					const enclosureEl = item.querySelector('enclosure');
					const guidEl = item.querySelector('guid');
					
					const title = titleEl?.text || '';
					let link = linkEl?.text || '';
					
					if (!title) return;

					// Use magnet link from enclosure if available
					if (enclosureEl) {
						const magnetLink = enclosureEl.getAttribute('url');
						if (magnetLink && magnetLink.startsWith('magnet:')) {
							link = magnetLink;
						}
					}

					// Movie id (guid) and year extraction
					let movieId = guidEl?.text || null;
					let year = null;
					const yearMatch = title.match(/(19|20)\d{2}(?!p)/);
					if (yearMatch) year = yearMatch[0];

					// Extract size from enclosure
					const size = enclosureEl?.getAttribute('length') || null;

					movies.push({
						id: movieId,
						title: title,
						year: year,
						torrentUrl: link,
						size: size
					});
				} catch (e) {
					console.debug('Skipped item due to parse error:', e.message);
				}
			});

			console.log(`📊 [Zamunda.rip] Parsed ${movies.length} movies from API`);
			return movies;
		} catch (error) {
			console.error('Error parsing Torznab response:', error.message);
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
			console.log(`🔍 [Zamunda.rip] Searching for: ${searchDisplay}`);
			
			// Perform the search
			const results = await this.search(title);
			
			if (results.length === 0) {
				console.log(`❌ [Zamunda.rip] No movies found for: ${searchDisplay}`);
				return [];
			}

			// Filter results based on title and year matching
			const filteredResults = this.filterMoviesByTitleAndYear(results, title, year);
			
			if (filteredResults.length === 0) {
				console.log(`❌ [Zamunda.rip] No matching movies found for: ${searchDisplay}`);
				return [];
			}

			console.log(`✅ [Zamunda.rip] Found ${filteredResults.length} matching movies for: ${searchDisplay}`);
			
			// Convert filtered results to torrents
			return this.movieParser.convertMoviesToTorrents(filteredResults);
		} catch (error) {
			console.error('Error in searchByTitle:', error.message);
			return [];
		}
	}

	normalizeSearchTitle(title) {
		if (!title) return '';
		return title
			.trim()
			.toLowerCase()
			.replace(/[-\.:\s]+/g, ' ')
			.trim();
	}

	filterMoviesByTitleAndYear(movies, searchTitle, year = null) {
		return movies.filter((movie) => {
			const normalizedMovieTitle = this.normalizeSearchTitle(movie.title);
			const normalizedSearchTitle = this.normalizeSearchTitle(searchTitle);
			const titleMatch = normalizedMovieTitle.includes(normalizedSearchTitle) || normalizedSearchTitle.includes(normalizedMovieTitle);
			
			if (!titleMatch) return false;
			
			if (year) {
				// If year is provided, check if the movie year is close to the search year
				const movieYear = parseInt(movie.year);
				const searchYear = parseInt(year);
				// Allow 1 year difference for flexibility
				return !isNaN(movieYear) && Math.abs(movieYear - searchYear) <= 1;
			}
			
			return true;
		});
	}

	// Format torrents as Stremio streams using proper Stream Object format
	async formatTorrentsAsStreams(torrents) {
		const streams = [];
		
		for (const torrent of torrents) {
			try {
				// Extract resolution from torrent title
				const resolution = extractResolution(torrent.title);

				// If it's a magnet link, extract infoHash and create Stremio stream
				if (torrent.url && torrent.url.startsWith('magnet:')) {
					const stream = this.createStreamFromMagnet(torrent.url, torrent.title);
					if (stream) {
						streams.push(stream);
						continue;
					}
				}

				// Fallback: if not magnet or extraction failed, try to return original URL
				if (torrent.url) {
					streams.push({
						name: `zamunda.rip\n${resolution}`,
						title: torrent.title,
						url: torrent.url,
						type: 'movie'
					});
				}
			} catch (error) {
				console.error(`Error formatting torrent: ${error.message}`);
			}
		}

		return streams;
	}

	/**
	 * Extract infoHash from magnet link and create Stremio stream
	 * Magnet format: magnet:?xt=urn:btih:XXXXX where XXXXX is the infohash
	 * @param {string} magnetLink - The magnet link
	 * @param {string} title - Movie title
	 * @returns {object|null} Stream object with infoHash or null on failure
	 */
	createStreamFromMagnet(magnetLink, title) {
		try {
			// Extract infoHash directly from magnet link
			const infoHashMatch = magnetLink.match(/urn:btih:([a-zA-Z0-9]+)/i);
			if (!infoHashMatch || !infoHashMatch[1]) {
				console.warn(`❌ [Zamunda.rip] Could not extract infoHash from: ${magnetLink.substring(0, 50)}...`);
				return null;
			}

			const infoHash = infoHashMatch[1].toLowerCase();
			const resolution = extractResolution(title);

			// Create proper Stremio Stream Object using infoHash
			const stream = {
				name: `zamunda.rip\n${resolution}`,
				title: title,
				infoHash: infoHash,
				fileIdx: 0,  // Largest video file by default
				type: 'movie'
			};

			console.log(`✅ [Zamunda.rip] Created stream with infoHash: ${infoHash.substring(0, 12)}...`);
			
			return stream;
		} catch (error) {
			console.error(`❌ [Zamunda.rip] Failed to create stream from magnet: ${error.message}`);
			return null;
		}
	}
}
module.exports = ZamundaRIPAPI;