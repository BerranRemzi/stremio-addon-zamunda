const { parse } = require('node-html-parser');
const parseTorrent = require('parse-torrent');
const { extractResolution } = require('../utils/resolutionExtractor');

class ArenaBGMovieParser {
	constructor(baseUrl = 'https://arenabg.com') {
		this.baseUrl = baseUrl;
	}

	/**
	 * Normalize movie title by replacing hyphens and dots with spaces
	 * @param {string} title - Raw title from HTML
	 * @returns {string} Normalized title
	 */
	normalizeMovieTitle(title) {
		if (!title) return '';
		return title
			.trim()
			.replace(/[-\.:]/g, ' ') // Replace hyphens, dots, and colons with spaces
			.replace(/\s+/g, ' ') // Replace multiple spaces with single space
			.trim();
	}

	/**
	 * Parse HTML content to extract movie data from ArenaBG
	 * @param {string} html - HTML content to parse
	 * @param {string} query - Search query for fallback parsing
	 * @returns {Array} Array of movie objects
	 */
	parseMovies(html, query = '') {
		try {
			// Parse HTML with error handling
			let root;
			try {
				root = parse(html);
			} catch (parseError) {
				console.error('HTML parsing failed, using regex fallback:', parseError.message);
				return this.parseWithRegex(html, query);
			}

			const movies = [];

			// ArenaBG structure: find all movie rows in the table
			const movieRows = root.querySelectorAll('table.table-torrents tbody tr');
			
			movieRows.forEach((row) => {
				try {
					// Get the title link - it's in the td.filename
					const filenameCell = row.querySelector('td.filename');
					if (!filenameCell) return;
					
					const titleLink = filenameCell.querySelector('a.title, a[href*="/bg/torrents/"]');
					if (!titleLink) return;
					
					const title = this.normalizeMovieTitle(titleLink.text);
					const href = titleLink.getAttribute('href');
					
					if (!title || !href) return;
					
					// Extract the encoded ID from the URL
					// URL format: /bg/torrents/[encoded_id]/
					const idMatch = href.match(/\/bg\/torrents\/([^\/]+)/);
					const movieId = idMatch ? idMatch[1] : null;
					
					if (!movieId) return;
					
					// Get seeders
					const seedersCell = row.querySelector('td.seeders');
					const seeders = seedersCell ? parseInt(seedersCell.text.trim(), 10) || 0 : 0;
					
					// Get leechers
					const leechersCell = row.querySelector('td.leechers');
					const leechers = leechersCell ? parseInt(leechersCell.text.trim(), 10) || 0 : 0;
					
					// Get size
					const sizeCells = row.querySelectorAll('td');
					let size = 'Unknown';
					// Size is typically in the third td from the end (before seeders and leechers)
					if (sizeCells.length >= 3) {
						const sizeText = sizeCells[sizeCells.length - 3].text.trim();
						if (sizeText.match(/\d+(\.\d+)?\s*(GB|MB|TB)/i)) {
							size = sizeText;
						}
					}
					
					// Check for Bulgarian audio icon (.fa-volume-up with "Българско Озвучение" or "Bulgarian Audio" title)
					let hasBulgarianAudio = false;
					const volumeIcon = filenameCell.querySelector('.fa-volume-up');
					if (volumeIcon) {
						const title = volumeIcon.getAttribute('data-original-title') || volumeIcon.getAttribute('title') || volumeIcon.getAttribute('alt');
						const titleLower = title ? title.toLowerCase() : '';
						if (titleLower.includes('българско озвучение') || titleLower.includes('bulgarian audio')) {
							hasBulgarianAudio = true;
						}
					}
					
					// Check for Bulgarian subtitles icon (flag-icon-bg means Bulgarian subtitles)
					const hasBulgarianSubtitles = filenameCell.querySelector('.flag-icon-bg') !== null;
					
					// Store the detail page URL - we'll need to visit this to get the download key
					// If href is absolute, extract the path; if relative, use it directly
					let detailPath = href;
					if (href.startsWith('http')) {
						// Extract path from full URL
						const urlMatch = href.match(/https?:\/\/[^\/]+(\/.*)/);
						detailPath = urlMatch ? urlMatch[1] : href;
					}
					// Remove trailing slash if present
					detailPath = detailPath.replace(/\/$/, '');
					const detailUrl = `${this.baseUrl}${detailPath}`;
					
					movies.push({
						id: movieId,
						title: title,
						detailUrl: detailUrl,  // Store detail page URL instead of direct download
						torrentUrl: null,  // Will be populated when we fetch the detail page
						seeders: seeders,
						leechers: leechers,
						size: size,
						hasBulgarianAudio: hasBulgarianAudio,  // Detected from icon or will be detected from title text
						hasBulgarianSubtitles: hasBulgarianSubtitles
					});
				} catch (rowError) {
					console.error('Error parsing movie row:', rowError.message);
				}
			});

			console.log(`[ArenaBG] Parsed ${movies.length} movies from HTML`);
			
			// Detect Bulgarian audio/subtitles flags from title text
			this.detectFlags(root, movies);
			
			return movies;
		} catch (error) {
			console.error('Error parsing ArenaBG movies:', error.message);
			return [];
		}
	}

	/**
	 * Detect flags (Bulgarian audio, subtitles, etc.) for movies
	 * @param {Object} root - Parsed HTML root element
	 * @param {Array} movies - Array of movie objects to update
	 */
	detectFlags(root, movies) {
		try {
			// Look for common Bulgarian indicators in titles or flags
			movies.forEach(movie => {
				const titleLower = movie.title.toLowerCase();
				
				// Check for Bulgarian audio indicators in title (only if not already detected from icon)
				if (!movie.hasBulgarianAudio && 
					(titleLower.includes('bg audio') || 
					titleLower.includes('bgaudio') || 
					titleLower.includes('bg+enaudio') ||
					titleLower.includes('bulgarian audio') ||
					titleLower.includes('българско озвучение') ||
					titleLower.includes('дубляж'))) {
					movie.hasBulgarianAudio = true;
					movie.flags = movie.flags || [];
					movie.flags.push('bg_audio');
				}
				
				// Check for Bulgarian subtitles
				if (titleLower.includes('bg sub') || 
					titleLower.includes('bgsub') || 
					titleLower.includes('bulgarian sub') ||
					titleLower.includes('субтитри')) {
					movie.hasBulgarianSubtitles = true;
					movie.flags = movie.flags || [];
					movie.flags.push('bg_subtitles');
				}
				
				// Check for 3D
				if (titleLower.includes('3d')) {
					movie.is3D = true;
					movie.flags = movie.flags || [];
					movie.flags.push('3d');
				}
			});
		} catch (error) {
			console.error('Error detecting flags:', error.message);
		}
	}

	/**
	 * Parse movie sizes from HTML
	 * @param {Object} root - Parsed HTML root element
	 * @param {Array} movies - Array of movie objects to update
	 */
	parseMovieSizes(root, movies) {
		try {
			const htmlString = root.toString();
			
			// Common size patterns in torrent trackers
			const sizePattern = /([\d.]+\s*(?:GB|MB|TB|GiB|MiB|TiB))/gi;
			const sizes = [];
			let sizeMatch;
			
			while ((sizeMatch = sizePattern.exec(htmlString)) !== null) {
				sizes.push(sizeMatch[1]);
			}
			
			// Match sizes with movies by order (assume they appear in the same order)
			sizes.forEach((size, index) => {
				if (index < movies.length) {
					movies[index].size = size;
				}
			});
		} catch (error) {
			console.error('Error parsing movie sizes:', error.message);
		}
	}

	/**
	 * Parse seeders using multiple approaches for robustness
	 * @param {Object} root - Parsed HTML root element
	 * @param {Array} movies - Array of movie objects
	 * @param {string} html - Raw HTML string
	 */
	parseSeeders(root, movies, html) {
		try {
			// Try to find seeder/leecher information using common patterns
			const seederPattern = /<td[^>]*>(\d+)<\/td>\s*<td[^>]*>(\d+)<\/td>/g;
			let match;
			let movieIndex = 0;
			
			while ((match = seederPattern.exec(html)) !== null && movieIndex < movies.length) {
				// First number is typically seeders, second is leechers
				movies[movieIndex].seeders = parseInt(match[1], 10) || 0;
				movies[movieIndex].leechers = parseInt(match[2], 10) || 0;
				movieIndex++;
			}

			// Fallback: look for bold numbers which often indicate seeders
			if (movies.some(movie => movie.seeders === undefined || movie.seeders === 0)) {
				const boldPattern = /<b[^>]*>(\d+)<\/b>/g;
				let boldMatch;
				let index = 0;
				
				while ((boldMatch = boldPattern.exec(html)) !== null && index < movies.length) {
					if (movies[index].seeders === undefined || movies[index].seeders === 0) {
						movies[index].seeders = parseInt(boldMatch[1], 10) || 0;
					}
					index++;
				}
			}

			// Set default values for any remaining undefined seeders
			movies.forEach(movie => {
				if (movie.seeders === undefined) {
					movie.seeders = 0;
				}
				if (movie.leechers === undefined) {
					movie.leechers = 0;
				}
			});

		} catch (error) {
			console.error('Error parsing seeders:', error.message);
			movies.forEach(movie => {
				if (movie.seeders === undefined) movie.seeders = 0;
				if (movie.leechers === undefined) movie.leechers = 0;
			});
		}
	}

	/**
	 * Fallback regex parsing method when HTML parsing fails
	 * @param {string} html - HTML content to parse
	 * @param {string} query - Search query
	 * @returns {Array} Array of movie objects
	 */
	parseWithRegex(html, query) {
		const movies = [];
		try {
			// ArenaBG specific patterns
			// Match: <a href="https://arenabg.com/bg/torrents/[ID]/" ...>Title</a>
			const titleRegex = /<a[^>]*href=["']https:\/\/arenabg\.com\/bg\/torrents\/([^\/'"]+)\/["'][^>]*class=["']title["'][^>]*>([^<]+)<\/a>/gi;
			
			let match;
			while ((match = titleRegex.exec(html)) !== null) {
				const movieId = match[1];
				const title = this.normalizeMovieTitle(match[2]);
				
				// Extract seeders - look for td.seeders after the title
				const afterTitle = html.substring(match.index);
				const seederMatch = afterTitle.match(/<td[^>]*class=["'][^"']*seeders[^"']*["'][^>]*>(\d+)<\/td>/i);
				const seeders = seederMatch ? parseInt(seederMatch[1], 10) || 0 : 0;
				
				const torrentUrl = `${this.baseUrl}/bg/torrents/${movieId}/download`;
				
				movies.push({
					id: movieId,
					title: title,
					torrentUrl: torrentUrl,
					seeders: seeders,
					leechers: 0
				});
			}
			
			console.log(`[ArenaBG] Regex fallback found ${movies.length} movies`);
			return movies;
		} catch (error) {
			console.error('Regex parsing also failed:', error.message);
			return [];
		}
	}

	/**
	 * Extract download key from torrent detail page
	 * @param {string} html - HTML content of the detail page
	 * @returns {string|null} Download key or null if not found
	 */
	extractDownloadKey(html) {
		try {
			// Look for download link pattern: /bg/torrents/download/?key=...
			const downloadMatch = html.match(/\/bg\/torrents\/download\/\?key=([^"'&]+)/);
			if (downloadMatch) {
				return downloadMatch[1];
			}
			
			// Alternative pattern with different quotes
			const altMatch = html.match(/torrents\/download\/\?key=([^"'&\s]+)/);
			if (altMatch) {
				return altMatch[1];
			}
			
			return null;
		} catch (error) {
			console.error('Error extracting download key:', error.message);
			return null;
		}
	}

	/**
	 * Convert movie objects to torrent format
	 * @param {Array} movies - Array of movie objects
	 * @returns {Array} Array of torrent objects
	 */
	convertMoviesToTorrents(movies) {
		return movies.map(movie => ({
			title: `${movie.title}\n`,
			url: movie.torrentUrl,  // This will be populated after fetching detail pages
			detailUrl: movie.detailUrl,  // Keep detail URL for fetching download key
			size: movie.size || 'Unknown',
			seeders: movie.seeders,
			leechers: movie.leechers || 'Unknown',
			hasBulgarianAudio: movie.hasBulgarianAudio || false
		}));
	}

	// Note: extractResolution is now imported from shared utility

	/**
	 * Parse torrent buffer to extract metadata
	 * @param {Buffer} torrentBuffer - Torrent file buffer
	 * @returns {Object} Parsed torrent metadata
	 */
	parseTorrentMetadata(torrentBuffer) {
		try {
			const parsedTorrent = parseTorrent(torrentBuffer);
			const sizeGb = parsedTorrent.length ? 
				`${(parsedTorrent.length / (1024*1024*1024)).toFixed(2)} GB` : 
				'Unknown';

			return {
				infoHash: parsedTorrent.infoHash,
				size: sizeGb,
				length: parsedTorrent.length
			};
		} catch (parseError) {
			console.error(`Error parsing torrent buffer: ${parseError.message}`);
			return null;
		}
	}

	/**
	 * Format torrents as Stremio streams with bounded parallelism
	 * @param {Array} torrents - Array of torrent objects
	 * @param {Function} getTorrentBuffer - Function to get torrent buffer
	 * @returns {Promise<Array>} Array of formatted stream objects
	 */
	async formatTorrentsAsStreams(torrents, getTorrentBuffer) {
		const limit = (concurrency) => {
			let active = 0; 
			const queue = [];
			const next = () => {
				if (active >= concurrency || queue.length === 0) return;
				active++;
				const { fn, resolve, reject } = queue.shift();
				fn().then(resolve, reject).finally(() => { active--; next(); });
			};
			return (fn) => new Promise((resolve, reject) => { 
				queue.push({ fn, resolve, reject }); 
				process.nextTick(next); 
			});
		};

		const withLimit = limit(3);

		const tasks = torrents.map((torrent) => withLimit(async () => {
			try {
				// Extract resolution from title (contains quality info like "1080p", "720p", etc.)
					const resolution = extractResolution(torrent.title);
				let torrentBuffer = null;
				if (getTorrentBuffer) {
					torrentBuffer = await getTorrentBuffer(torrent.url);
				}

				// If we have a torrent buffer, try to parse it
				if (torrentBuffer) {
					const metadata = this.parseTorrentMetadata(torrentBuffer);
					if (metadata) {
						return {
							name: `arenabg\n${resolution}`,
							title: `${torrent.title}${torrent.hasBulgarianAudio ? ' 🇧🇬' : ''} 👤${torrent.seeders ?? 'Unknown'} 💾 ${metadata.size}`,
							infoHash: metadata.infoHash,
							type: 'stream'
						};
					}
				}

				// Fallback: return basic stream info without parsing
				return {
					name: `arenabg\n${resolution}`,
					title: `${torrent.title}${torrent.hasBulgarianAudio ? ' 🇧🇬' : ''} 👤${torrent.seeders ?? 'Unknown'}`,
					url: torrent.url,
					type: 'movie'
				};
			} catch (error) {
				console.error(`Error processing torrent: ${error.message}`);
					const resolution = extractResolution(torrent.title);
				return {
					name: `arenabg\r\n${resolution}`,
					title: `${torrent.title}\r\n${torrent.hasBulgarianAudio ? ' 🇧🇬' : ''}`,
					url: torrent.url,
					type: 'movie'
				};
			}
		}));

		const results = await Promise.all(tasks);
		return results;
	}
}

module.exports = ArenaBGMovieParser;
