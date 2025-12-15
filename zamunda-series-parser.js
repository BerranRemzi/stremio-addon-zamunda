const { parse } = require('node-html-parser');
const parseTorrent = require('parse-torrent');

class ZamundaSeriesParser {
	constructor(baseUrl = 'https://zamunda.net') {
		this.baseUrl = baseUrl;
	}

	/**
	 * Normalize series title by replacing hyphens and dots with spaces
	 * @param {string} title - Raw title from HTML
	 * @returns {string} Normalized title
	 */
	normalizeSeriesTitle(title) {
		if (!title) return '';
		return title
			.trim()
			.replace(/[-\.:]/g, ' ') // Replace hyphens, dots, and colons with spaces
			.replace(/\s+/g, ' ') // Replace multiple spaces with single space
			.trim();
	}

	/**
	 * Parse HTML content to extract series data
	 * @param {string} html - HTML content to parse
	 * @param {string} query - Search query for fallback parsing
	 * @returns {Array} Array of series objects
	 */
	parseSeries(html, query = '') {
		try {
			// Parse HTML with error handling
			let root;
			try {
				root = parse(html);
			} catch (parseError) {
				console.error('HTML parsing failed, using regex fallback:', parseError.message);
				// Fallback to regex parsing if HTML parser fails
				return this.parseWithRegex(html, query);
			}

			const series = [];

			// First collect series titles and IDs
			const titleCells = root.querySelectorAll('td.colheadd');
			titleCells.forEach((elem) => {
				const link = elem.querySelector('a[href*="/banan?id="]');
				if (link) {
					const title = this.normalizeSeriesTitle(link.text);
					const href = link.getAttribute('href');
					
					if (title && href) {
						const match = href.match(/id=(\d+)/);
						const seriesId = match ? match[1] : null;
						
						if (seriesId) {
							series.push({
								id: seriesId,
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
				if (i < series.length) {
					const torrentLink = elem.getAttribute('href');
					if (torrentLink) {
						series[i].torrentUrl = torrentLink.startsWith('http') ? 
							torrentLink : `${this.baseUrl}${torrentLink}`;
					}
				}
			});

			// Find and add seeders count
			this.parseSeeders(root, series, html);

			// Detect flags (Bulgarian audio, subtitles, etc.)
			this.detectFlags(root, series);

			// Parse series sizes
			this.parseSeriesSizes(root, series);

			return series;
		} catch (error) {
			console.error('Error parsing series:', error.message);
			return [];
		}
	}

	/**
	 * Detect flags (Bulgarian audio, subtitles, etc.) for series
	 * @param {Object} root - Parsed HTML root element
	 * @param {Array} series - Array of series objects to update
	 */
	detectFlags(root, series) {
		try {
			// Use regex to find flag patterns and match them with series IDs
			const flagPattern = /<img[^>]*src=['"][^'"]*flag_([^'"]*)['"][^>]*>.*?<a[^>]*href=['"][^'"]*\/banan\?id=(\d+)/g;
			
			const seriesFlags = [];
			let match;
			
			while ((match = flagPattern.exec(root.toString())) !== null) {
				const flagType = match[1];
				const seriesId = match[2];
				
				const seriesIndex = series.findIndex(s => s.id === seriesId);
				if (seriesIndex !== -1) {
					if (!seriesFlags[seriesIndex]) {
						seriesFlags[seriesIndex] = [];
					}
					
					// Map flag types to our internal flags
					if (flagType.includes('bgaudio')) {
						seriesFlags[seriesIndex].push('bg_audio');
					}
					if (flagType.includes('bgsub')) {
						seriesFlags[seriesIndex].push('bg_subtitles');
					}
				}
			}
			
			// Apply flags to series
			seriesFlags.forEach((flags, index) => {
				if (flags && flags.length > 0) {
					series[index].flags = flags;
					series[index].hasBulgarianAudio = flags.includes('bg_audio');
					series[index].hasBulgarianSubtitles = flags.includes('bg_subtitles');
				}
			});
		} catch (error) {
			console.error('Error detecting flags:', error.message);
		}
	}

	/**
	 * Parse series sizes from HTML
	 * @param {Object} root - Parsed HTML root element
	 * @param {Array} series - Array of series objects to update
	 */
	parseSeriesSizes(root, series) {
		try {
			const htmlString = root.toString();
			
			// Find all sizes
			const sizePattern = /<td><font color=red>([\d.]+ (?:GB|MB))<\/font><\/td>/g;
			const sizes = [];
			let sizeMatch;
			
			while ((sizeMatch = sizePattern.exec(htmlString)) !== null) {
				sizes.push(sizeMatch[1]);
			}
			
			// Match sizes with series by order
			sizes.forEach((size, index) => {
				if (index < series.length) {
					series[index].size = size;
				}
			});
			
		} catch (error) {
			console.error('Error parsing series sizes:', error.message);
		}
	}

	/**
	 * Fallback regex parsing method when HTML parsing fails
	 * @param {string} html - HTML content to parse
	 * @param {string} query - Search query
	 * @returns {Array} Array of series objects
	 */
	parseWithRegex(html, query) {
		const series = [];
		try {
			// Simple regex patterns to extract series data
			const titleRegex = /<a[^>]*href="[^"]*\/banan\?id=(\d+)"[^>]*>([^<]+)<\/a>/gi;
			const torrentRegex = /<a[^>]*href="([^"]*(?:download\.php|\.torrent)[^"]*)"[^>]*>/gi;
			
			let match;
			while ((match = titleRegex.exec(html)) !== null) {
				series.push({
					id: match[1],
					title: this.normalizeSeriesTitle(match[2]),
					torrentUrl: null,
					seeders: 0
				});
			}
			
			// Try to match torrent links with series
			let torrentMatch;
			let seriesIndex = 0;
			while ((torrentMatch = torrentRegex.exec(html)) !== null && seriesIndex < series.length) {
				const torrentUrl = torrentMatch[1];
				if (torrentUrl) {
					series[seriesIndex].torrentUrl = torrentUrl.startsWith('http') ? 
						torrentUrl : `${this.baseUrl}${torrentUrl}`;
					seriesIndex++;
				}
			}
			
			console.log(`Regex fallback found ${series.length} series`);
			return series;
		} catch (error) {
			console.error('Regex parsing also failed:', error.message);
			return [];
		}
	}

	/**
	 * Parse seeders using multiple approaches for robustness
	 * @param {Object} root - Parsed HTML root element
	 * @param {Array} series - Array of series objects
	 * @param {string} html - Raw HTML string
	 */
	parseSeeders(root, series, html) {
		try {
			// Approach 1: DOM-based parsing
			const seederCells = root.querySelectorAll('td.tddownloaded center font a');
			seederCells.forEach((elem, i) => {
				if (i < series.length && series[i].seeders === undefined) {
					const seedersElement = elem.querySelector('b');
					if (seedersElement) {
						const seeders = seedersElement.text.trim();
						if (seeders) {
							series[i].seeders = parseInt(seeders, 10) || 0;
						}
					}
				}
			});

			// Approach 2: Alternative DOM selectors
			if (series.some(s => s.seeders === undefined)) {
				const altSeederCells = root.querySelectorAll('td.tddownloaded font a b');
				altSeederCells.forEach((elem, i) => {
					if (i < series.length && series[i].seeders === undefined) {
						const seeders = elem.text.trim();
						if (seeders) {
							series[i].seeders = parseInt(seeders, 10) || 0;
						}
					}
				});
			}

			// Approach 3: Regex-based parsing as fallback
			if (series.some(s => s.seeders === undefined)) {
				const seederPattern = /<b>(\d+)<\/b>.*?<b>(\d+)<\/b>/g;
				let match;
				let seriesIndex = 0;
				
				while ((match = seederPattern.exec(html)) !== null && seriesIndex < series.length) {
					if (series[seriesIndex].seeders === undefined) {
						series[seriesIndex].seeders = parseInt(match[1], 10) || 0;
						series[seriesIndex].leechers = parseInt(match[2], 10) || 0;
					}
					seriesIndex++;
				}
			}

			// Set default values for any remaining undefined seeders
			series.forEach(s => {
				if (s.seeders === undefined) {
					s.seeders = 0;
					s.leechers = 0;
				}
			});

		} catch (error) {
			console.error('Error parsing seeders:', error.message);
			// Set default values if parsing fails
			series.forEach(s => {
				if (s.seeders === undefined) {
					s.seeders = 0;
					s.leechers = 0;
				}
			});
		}
	}

	/**
	 * Extract season and episode information from title
	 * @param {string} title - Series title
	 * @returns {Object} Object with season and episode info
	 */
	extractSeasonEpisode(title) {
		if (!title) return { season: null, episode: null, isPack: false, episodeRange: null };
		
		const titleLower = title.toLowerCase();
		
		// Check for episode range (e.g., S01E01-E05, S02E03-E08)
		let match = title.match(/s(\d+)e(\d+)[\s\-]*(?:e|to|-)[\s\-]*e?(\d+)/i);
		if (match) {
			return {
				season: parseInt(match[1], 10),
				episode: parseInt(match[2], 10),
				isPack: true,
				episodeRange: {
					start: parseInt(match[2], 10),
					end: parseInt(match[3], 10)
				}
			};
		}
		
		// Check if it's a complete season pack (e.g., "Season 1", "S01 Complete", "Сезон 2")
		const seasonPackMatch = title.match(/(?:season|сезон|s)[\s\-]?(\d+)(?:\s|$|complete|full|pack)/i);
		if (seasonPackMatch && !title.match(/e\d+/i)) {
			return {
				season: parseInt(seasonPackMatch[1], 10),
				episode: null,
				isPack: true,
				episodeRange: null
			};
		}
		
		// Try S##E## format (e.g., S01E05, s02e10)
		match = title.match(/s(\d+)e(\d+)/i);
		if (match) {
			return {
				season: parseInt(match[1], 10),
				episode: parseInt(match[2], 10),
				isPack: false,
				episodeRange: null
			};
		}
		
		// Try ##x## format (e.g., 1x05, 02x10)
		match = title.match(/(\d+)x(\d+)/i);
		if (match) {
			return {
				season: parseInt(match[1], 10),
				episode: parseInt(match[2], 10),
				isPack: false,
				episodeRange: null
			};
		}
		
		// Try Season ## Episode ## format
		match = title.match(/season[\s\-]?(\d+)[\s\-]?episode[\s\-]?(\d+)/i);
		if (match) {
			return {
				season: parseInt(match[1], 10),
				episode: parseInt(match[2], 10),
				isPack: false,
				episodeRange: null
			};
		}
		
		return { season: null, episode: null, isPack: false, episodeRange: null };
	}

	/**
	 * Convert series objects to torrent format
	 * @param {Array} series - Array of series objects
	 * @returns {Array} Array of torrent objects
	 */
	convertSeriesToTorrents(series) {
		return series.map(s => {
			const seasonEpisode = this.extractSeasonEpisode(s.title);
			return {
				title: `${s.title}\n`,
				url: s.torrentUrl,
				size: 'Unknown',
				seeders: s.seeders,
				leechers: 'Unknown',
				hasBulgarianAudio: s.hasBulgarianAudio || false,
				season: seasonEpisode.season,
				episode: seasonEpisode.episode,
				isPack: seasonEpisode.isPack
			};
		});
	}

	/**
	 * Extract resolution from torrent URL or title
	 * @param {string} text - Text to extract resolution from
	 * @returns {string} Resolution string
	 */
	extractResolution(text) {
		if (!text) return 'Unknown';
		
		const textLower = text.toLowerCase();
		
		// Single comprehensive regex to find any resolution
		const resolutionMatch = text.match(/\b(8K|2160p|4K|UHD|1440p|2K|1080p|FHD|FullHD|Full HD|720p|HD|576p|480p|SD|bluray|blu-ray|blu ray|brrip|bdrip|webrip|web-rip|web\.rip|dvd|pal|ntsc|xvid|divx)\b/i);
		
		if (resolutionMatch) {
			const match = resolutionMatch[1].toLowerCase();
			
			// Map the match to standard resolution
			if (match.match(/^(8k|2160p|4k|uhd)$/)) return '4K';
			if (match.match(/^(1440p|2k)$/)) return '1440p';
			if (match.match(/^(1080p|fhd|fullhd|full hd)$/)) return '1080p';
			if (match.match(/^(720p|hd)$/)) return '720p';
			if (match.match(/^576p$/)) return '576p';
			if (match.match(/^(480p|sd)$/)) return '480p';
			if (match.match(/^(bluray|blu-ray|blu ray)$/)) return '1080p';
			if (match.match(/^(brrip|bdrip|webrip|web-rip|web\.rip)$/)) return '720p';
			if (match.match(/^(dvd|pal|ntsc|xvid|divx)$/)) return '480p';
		}
		
		return 'Unknown';
	}

	/**
	 * Get resolution priority for sorting (higher is better)
	 * @param {string} resolution - Resolution string
	 * @returns {number} Priority value
	 */
	getResolutionPriority(resolution) {
		if (!resolution) return 0;
		
		const resLower = resolution.toLowerCase();
		
		// Priority mapping (higher number = better quality)
		const priorityMap = {
			'8k': 1000,
			'4k': 900,
			'2160p': 900,
			'uhd': 900,
			'1440p': 700,
			'2k': 700,
			'1080p': 600,
			'fhd': 600,
			'720p': 400,
			'hd': 400,
			'576p': 300,
			'480p': 200,
			'sd': 200,
			'unknown': 0
		};
		
		return priorityMap[resLower] || 0;
	}

	/**
	 * Sort streams by resolution (descending) and seeders (descending)
	 * @param {Array} streams - Array of stream objects
	 * @returns {Array} Sorted streams
	 */
	sortStreamsByQuality(streams) {
		return streams.sort((a, b) => {
			// Extract resolution from stream name (format: "zamunda\n720p")
			const resA = (a.name || '').split('\n')[1] || 'Unknown';
			const resB = (b.name || '').split('\n')[1] || 'Unknown';
			
			// Get priority values
			const priorityA = this.getResolutionPriority(resA);
			const priorityB = this.getResolutionPriority(resB);
			
			// Sort by resolution priority first (higher first)
			if (priorityA !== priorityB) {
				return priorityB - priorityA;
			}
			
			// If same resolution, sort by seeders (extract from title)
			const seedersA = this.extractSeedersFromTitle(a.title);
			const seedersB = this.extractSeedersFromTitle(b.title);
			
			return seedersB - seedersA;
		});
	}

	/**
	 * Extract seeders count from stream title
	 * @param {string} title - Stream title (e.g., "S01E05 Title 🇧🇬 👤12 💾 2.34 GB")
	 * @returns {number} Seeders count
	 */
	extractSeedersFromTitle(title) {
		if (!title) return 0;
		
		// Look for 👤 followed by number
		const match = title.match(/👤\s*(\d+)/);
		if (match) {
			return parseInt(match[1], 10) || 0;
		}
		
		return 0;
	}

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
				length: parsedTorrent.length,
				files: parsedTorrent.files || []
			};
		} catch (parseError) {
			console.error(`Error parsing torrent buffer: ${parseError.message}`);
			return null;
		}
	}

	/**
	 * Find the correct episode file index in a torrent's file list
	 * @param {Array} files - Array of file objects from torrent metadata
	 * @param {number} season - Season number
	 * @param {number} episode - Episode number
	 * @returns {number|null} File index or null if not found
	 */
	findEpisodeFileIndex(files, season, episode) {
		if (!files || files.length === 0 || episode === null) {
			return null;
		}

		// Filter video files only
		const videoExtensions = ['.mkv', '.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v'];
		const videoFiles = files.map((f, idx) => ({ file: f, index: idx }))
			.filter(item => {
				const fileName = (item.file.name || item.file.path || '').toLowerCase();
				return videoExtensions.some(ext => fileName.endsWith(ext));
			});

		if (videoFiles.length === 0) {
			return null;
		}

		// Try multiple patterns to find the episode
		const patterns = [
			// S01E05 format
			new RegExp(`s0*${season}e0*${episode}[^0-9]`, 'i'),
			new RegExp(`s0*${season}e0*${episode}$`, 'i'),
			// 1x05 format
			new RegExp(`${season}x0*${episode}[^0-9]`, 'i'),
			new RegExp(`${season}x0*${episode}$`, 'i'),
			// Episode 05 format
			new RegExp(`episode[\\s\\._-]*0*${episode}[^0-9]`, 'i'),
			new RegExp(`episode[\\s\\._-]*0*${episode}$`, 'i'),
			// E05 format
			new RegExp(`[^s]e0*${episode}[^0-9]`, 'i'),
			new RegExp(`[^s]e0*${episode}$`, 'i'),
			// Just the episode number with padding
			new RegExp(`[\\s\\._-]0*${episode}[\\s\\._-]`, 'i')
		];

		// Try each pattern
		for (const pattern of patterns) {
			for (const item of videoFiles) {
				const fileName = item.file.name || item.file.path || '';
				if (pattern.test(fileName)) {
					console.log(`✅ Found episode ${episode} in file: ${fileName}`);
					return item.index;
				}
			}
		}

		// If no match found and there's only one video file, assume it's the right one
		if (videoFiles.length === 1) {
			console.log(`⚠️ Only one video file found, assuming it's episode ${episode}`);
			return videoFiles[0].index;
		}

		console.log(`❌ Could not find episode ${episode} in ${videoFiles.length} video files`);
		return null;
	}

	/**
	 * Format torrents as Stremio streams with bounded parallelism
	 * @param {Array} torrents - Array of torrent objects
	 * @param {Function} getTorrentBuffer - Function to get torrent buffer
	 * @param {number} requestedSeason - Season number requested (optional)
	 * @param {number} requestedEpisode - Episode number requested (optional)
	 * @returns {Promise<Array>} Array of formatted stream objects
	 */
	async formatTorrentsAsStreams(torrents, getTorrentBuffer, requestedSeason = null, requestedEpisode = null) {
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
				// Filter out torrents that don't match the requested season/episode
				if (requestedSeason !== null && torrent.season !== null && torrent.season !== requestedSeason) {
					return null; // Skip this torrent
				}
				
				// For episode-specific requests
				if (requestedEpisode !== null && !torrent.isPack) {
					if (torrent.episode !== null && torrent.episode !== requestedEpisode) {
						return null; // Skip this torrent
					}
				}
				
				// Prefer resolution from URL (torrent name)
				const resolution = this.extractResolution(torrent.url);

				// Try to get torrent buffer
				let torrentBuffer = null;
				if (getTorrentBuffer) {
					torrentBuffer = await getTorrentBuffer(torrent.url);
				}

				// Build stream title
				let streamTitle = torrent.title;
				if (torrent.season && !torrent.isPack) {
					// Single episode format
					streamTitle = `S${String(torrent.season).padStart(2, '0')}`;
					if (torrent.episode) {
						streamTitle += `E${String(torrent.episode).padStart(2, '0')}`;
					}
					streamTitle += `\n${torrent.title}`;
				} else if (torrent.isPack) {
					// Season pack format
					if (torrent.episodeRange) {
						streamTitle = `S${String(torrent.season).padStart(2, '0')}E${String(torrent.episodeRange.start).padStart(2, '0')}-E${String(torrent.episodeRange.end).padStart(2, '0')} (Pack)\n${torrent.title}`;
					} else {
						streamTitle = `Season ${torrent.season} (Complete Pack)\n${torrent.title}`;
					}
				}

				// If we have a torrent buffer, try to parse it
				if (torrentBuffer) {
					const metadata = this.parseTorrentMetadata(torrentBuffer);
					if (metadata) {
						// For season packs with episode files, we might want to specify file index
						let fileIdx = null;
						if (torrent.isPack && requestedEpisode !== null && metadata.files.length > 0) {
							// Try to find the right episode file with multiple patterns
							fileIdx = this.findEpisodeFileIndex(metadata.files, requestedSeason, requestedEpisode);
						}

						const stream = {
							name: `zamunda\n${resolution}`,
							title: `${streamTitle}${torrent.hasBulgarianAudio ? ' 🇧🇬' : ''} 👤${torrent.seeders || 'Unknown'} 💾 ${metadata.size}`,
							infoHash: metadata.infoHash,
							type: 'stream'
						};

						if (fileIdx !== null) {
							stream.fileIdx = fileIdx;
						}

						return stream;
					}
				}

				// Fallback: return basic stream info without parsing
				return {
					name: `zamunda\n${resolution}`,
					title: `${streamTitle}${torrent.hasBulgarianAudio ? ' 🇧🇬' : ''} 👤${torrent.seeders || 'Unknown'}`,
					url: torrent.url,
					type: 'series'
				};
			} catch (error) {
				console.error(`Error processing torrent: ${error.message}`);
				return null;
			}
		}));

		const results = await Promise.all(tasks);
		// Filter out null results (skipped torrents)
		const filtered = results.filter(r => r !== null);
		
		// Sort by resolution and seeders
		const sorted = this.sortStreamsByQuality(filtered);
		
		console.log(`✅ Sorted ${sorted.length} series streams by quality and seeders`);
		
		return sorted;
	}
}

module.exports = ZamundaSeriesParser;

