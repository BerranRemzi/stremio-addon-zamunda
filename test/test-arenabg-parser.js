const fs = require('fs');
const ArenaBGMovieParser = require('./../arenabg-movie-parser');
const path = require('path');

// Read the saved HTML file
const htmlPath = path.join(__dirname, 'Търсене » ArenaBG.html');
if (!fs.existsSync(htmlPath)) {
	console.log('⚠️  HTML fixture file not found. Skipping test.');
	console.log('This test requires a saved HTML file from ArenaBG search results.');
	process.exit(0);
}
const html = fs.readFileSync(htmlPath, 'utf-8');

// Create parser instance
const parser = new ArenaBGMovieParser('https://arenabg.com');

// Parse the movies
const movies = parser.parseMovies(html, 'sing 2 2021');

console.log(`Found ${movies.length} movies:`);
movies.forEach((movie, index) => {
	console.log(`\n${index + 1}. ${movie.title}`);
	console.log(`   ID: ${movie.id}`);
	console.log(`   Seeders: ${movie.seeders}, Leechers: ${movie.leechers}`);
	console.log(`   Size: ${movie.size}`);
	console.log(`   BG Audio: ${movie.hasBulgarianAudio}, BG Subs: ${movie.hasBulgarianSubtitles}`);
	console.log(`   URL: ${movie.torrentUrl}`);
});

// Convert to torrents
const torrents = parser.convertMoviesToTorrents(movies);
console.log(`\n\nConverted to ${torrents.length} torrent objects`);
