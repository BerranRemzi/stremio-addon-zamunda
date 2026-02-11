const { parse } = require('node-html-parser');
const parseTorrent = require('parse-torrent');

class ZamundaRipParser {
	constructor(baseUrl = 'https://zamunda.rip') {
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

	parseMovies(html, query = '') {
		try {
			// Parse HTML with error handling
			let root;
			try {
				root = parse(html);
			} catch (parseError) {
				console.error('HTML parsing failed:', parseError.message);
				return [];
			}

			const movies = [];

			// Try multiple selectors for movie rows (common patterns in dynamic sites)
			// Look for table rows with movie data
			const movieRows = root.querySelectorAll('tr[data-id], .movie-item, .torrent-row, tbody tr');
			
			movieRows.forEach((row) => {
				try {
					// Try to extract movie ID and title from various possible structures
					
					// Pattern 1: data-id attribute with link
					let movieId = row.getAttribute('data-id');
					let titleLink = row.querySelector('a[href*="download"], a[href*="id="], a[href*="banan"]');
					
					if (!titleLink) {
						titleLink = row.querySelector('a');
					}

					if (titleLink && titleLink.text) {
						const title = this.normalizeMovieTitle(titleLink.text);
						const href = titleLink.getAttribute('href') || '';
						
						// Extract ID from href if not already found
						if (!movieId && href) {
							const idMatch = href.match(/id=(\d+)/);
							movieId = idMatch ? idMatch[1] : null;
						}

						if (title && movieId) {
							// Try to find year in the same row
							const yearCell = row.querySelector('td:last-child, .year, [class*="year"]');
							let year = null;
							if (yearCell) {
								const yearMatch = yearCell.text.match(/\d{4}/);
								year = yearMatch ? yearMatch[0] : null;
							}

							// Try to find quality/resolution
							const qualityCell = row.querySelector('[class*="quality"], [class*="resolution"]');
							let quality = null;
							if (qualityCell) {
								quality = qualityCell.text.trim();
							}

							// Try to find size
							const sizeCell = row.querySelector('[class*="size"], td:nth-child(3)');
							let size = null;
							if (sizeCell) {
								size = sizeCell.text.trim();
							}

							movies.push({
								id: movieId,
								title: title,
								year: year,
								quality: quality,
								size: size,
								torrentUrl: href || `${this.baseUrl}/download.php?id=${movieId}`
							});
						}
					}
				} catch (e) {
					// Skip rows that can't be parsed
					console.debug('Skipped row due to parse error:', e.message);
				}
			});

			// If no movies found with above method, try simpler extraction
			if (movies.length === 0) {
				const allLinks = root.querySelectorAll('a[href*="id="], a[href*="download"]');
				allLinks.forEach((link) => {
					try {
						const title = this.normalizeMovieTitle(link.text);
						const href = link.getAttribute('href') || '';
						const idMatch = href.match(/id=(\d+)/);
						const movieId = idMatch ? idMatch[1] : null;

						if (title && movieId && !movies.find(m => m.id === movieId)) {
							movies.push({
								id: movieId,
								title: title,
								torrentUrl: href
							});
						}
					} catch (e) {
						// Skip invalid links
					}
				});
			}

			console.log(`📊 [Zamunda.rip] Parsed ${movies.length} movies from search results`);
			return movies;
		} catch (error) {
			console.error('Error parsing movies:', error.message);
			return [];
		}
	}

	/**
	 * Convert movies array to torrent streams format
	 * @param {Array} movies - Array of movie objects
	 * @returns {Array} Array of torrent stream objects
	 */
	convertMoviesToTorrents(movies) {
		const torrents = [];

		movies.forEach((movie) => {
			try {
				// Create a magnet link (format: magnet:?xt=urn:btih:HASH&dn=NAME&tr=TRACKER)
				// For now, use the torrent download URL as the source
				const torrent = {
					title: `${movie.title}${movie.year ? ` (${movie.year})` : ''}${movie.quality ? ` ${movie.quality}` : ''}`,
					url: movie.torrentUrl,
					size: movie.size
				};

				torrents.push(torrent);
			} catch (e) {
				console.debug('Skipped movie conversion due to error:', e.message);
			}
		});

		return torrents;
	}
}

module.exports = ZamundaRipParser;
