const fs = require('fs');
const path = require('path');
const ArenaBGMovieParser = require('../src/parsers/arenabg-movie-parser');

console.log('='.repeat(80));
console.log('ArenaBG Parser Test');
console.log('='.repeat(80));

// Read the saved HTML file
const htmlPath = path.join(__dirname, 'Търсене » ArenaBG.html');
if (!fs.existsSync(htmlPath)) {
	console.log('⚠️  HTML fixture file not found. Skipping test.');
	console.log('This test requires a saved HTML file from ArenaBG search results.');
	console.log('To create it, visit https://arenabg.com/bg/torrents/?text=sing+2+2021 and save the HTML.');
	process.exit(0);
}
const html = fs.readFileSync(htmlPath, 'utf-8');

console.log(`\nHTML file loaded: ${htmlPath}`);
console.log(`HTML size: ${(html.length / 1024).toFixed(2)} KB\n`);

// Create parser instance
const parser = new ArenaBGMovieParser('https://arenabg.com');

// Parse the movies
const movies = parser.parseMovies(html, 'sing 2 2021');

console.log(`Total movies found: ${movies.length}`);
console.log('-'.repeat(80));

// Separate top torrents from search results
const topTorrents = movies.slice(0, 3);
const searchResults = movies.slice(3);

console.log(`\n📊 TOP 3 TORRENTS (most watched):`);
console.log('='.repeat(80));
topTorrents.forEach((movie, index) => {
	console.log(`\n${index + 1}. ${movie.title}`);
	console.log(`   ID: ${movie.id}`);
	console.log(`   👤 Seeders: ${movie.seeders} | 📥 Leechers: ${movie.leechers}`);
	console.log(`   💾 Size: ${movie.size}`);
	console.log(`   ${movie.hasBulgarianAudio ? '🔊 BG Audio' : '   '} ${movie.hasBulgarianSubtitles ? '🇧🇬 BG Subs' : ''}`);
	console.log(`   🔗 ${movie.torrentUrl}`);
});

console.log(`\n\n🔍 SEARCH RESULTS for "sing 2 2021" (${searchResults.length} results):`);
console.log('='.repeat(80));
searchResults.forEach((movie, index) => {
	console.log(`\n${index + 1}. ${movie.title}`);
	console.log(`   ID: ${movie.id}`);
	console.log(`   👤 Seeders: ${movie.seeders} | 📥 Leechers: ${movie.leechers}`);
	console.log(`   💾 Size: ${movie.size}`);
	console.log(`   ${movie.hasBulgarianAudio ? '🔊 BG Audio' : '   '} ${movie.hasBulgarianSubtitles ? '🇧🇬 BG Subs' : ''}`);
	console.log(`   🔗 ${movie.torrentUrl}`);
});

// Convert to torrents
const torrents = parser.convertMoviesToTorrents(movies);
console.log(`\n\n✅ Successfully converted to ${torrents.length} torrent objects`);

// Test filtering for "Sing 2" specifically
const sing2Results = movies.filter(m => 
	m.title.toLowerCase().includes('sing') && 
	m.title.toLowerCase().includes('2')
);

console.log(`\n\n🎬 Filtered "Sing 2" results: ${sing2Results.length}`);
console.log('='.repeat(80));
sing2Results.forEach((movie, index) => {
	console.log(`\n${index + 1}. ${movie.title}`);
	console.log(`   Resolution: ${parser.extractResolution(movie.title)}`);
	console.log(`   👤 ${movie.seeders} seeders | 💾 ${movie.size}`);
	console.log(`   ${movie.hasBulgarianAudio ? '🔊 BG Audio' : ''} ${movie.hasBulgarianSubtitles ? '🇧🇬 BG Subs' : ''}`);
});

console.log('\n' + '='.repeat(80));
console.log('Test completed successfully! ✅');
console.log('='.repeat(80));
