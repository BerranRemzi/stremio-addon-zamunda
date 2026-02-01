const ArenaBGAPI = require('../src/trackers/arenabg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

console.log('='.repeat(80));
console.log('ArenaBG Live Search Test - Fetching from Real Site');
console.log('='.repeat(80));

async function testLiveSearch() {
	const searchQuery = 'sing 2 2021';
	
	// Initialize ArenaBG API
	const arenabg = new ArenaBGAPI({
		username: process.env.ZAMUNDA_USERNAME,
		password: process.env.ZAMUNDA_PASSWORD
	});

	console.log('\n📝 Credentials loaded from .env file');
	console.log(`   Username: ${process.env.ZAMUNDA_USERNAME || '(not set)'}`);
	console.log(`   Password: ${process.env.ZAMUNDA_PASSWORD ? '✓ (hidden)' : '✗ (not set)'}`);

	try {
		console.log('\n🔄 Initializing ArenaBG API...');
		await arenabg.ensureInitialized();
		console.log('✓ API initialized');

		console.log('\n🔑 Logging in to arenabg.com...');
		const loginResult = await arenabg.login();
		
		if (!loginResult) {
			console.log('⚠️  Login returned false, but continuing with search attempt...');
		}

		console.log(`\n🔍 Searching for: "${searchQuery}"`);
		console.log('   Fetching live data from https://arenabg.com/bg/torrents/...\n');
		
		const results = await arenabg.search(searchQuery);
		
		console.log('='.repeat(80));
		console.log(`📊 LIVE SEARCH RESULTS: ${results.length} movies found`);
		console.log('='.repeat(80));

		if (results.length === 0) {
			console.log('\n❌ No results found. This could mean:');
			console.log('   - Search query returned no matches');
			console.log('   - Login failed and page is restricted');
			console.log('   - HTML structure changed and parser needs updating');
			console.log('\n💡 Try running test-parse.js to verify the parser works with saved HTML');
			console.log('   If that works, the issue is likely with login or live fetching');
			return;
		}

		// Separate top results from actual search results
		const topTorrents = results.filter((m, i) => i < 3);
		const searchResults = results.filter((m, i) => i >= 3);
		
		if (topTorrents.length > 0) {
			console.log(`\n📊 TOP TORRENTS (${topTorrents.length}):`);
			console.log('-'.repeat(80));
			topTorrents.forEach((movie, index) => {
				console.log(`\n${index + 1}. ${movie.title}`);
				console.log(`   👤 Seeders: ${movie.seeders} | 📥 Leechers: ${movie.leechers || 'N/A'}`);
				console.log(`   💾 Size: ${movie.size || 'Unknown'}`);
				console.log(`   ${movie.hasBulgarianAudio ? '🔊 BG Audio' : ''}${movie.hasBulgarianSubtitles ? ' 🇧🇬 BG Subs' : ''}`);
			});
		}

		if (searchResults.length > 0) {
			console.log(`\n\n🔍 SEARCH RESULTS for "${searchQuery}" (${searchResults.length}):`);
			console.log('-'.repeat(80));
			searchResults.forEach((movie, index) => {
				console.log(`\n${index + 1}. ${movie.title}`);
				console.log(`   👤 Seeders: ${movie.seeders} | 📥 Leechers: ${movie.leechers || 'N/A'}`);
				console.log(`   💾 Size: ${movie.size || 'Unknown'}`);
				console.log(`   ${movie.hasBulgarianAudio ? '🔊 BG Audio' : ''}${movie.hasBulgarianSubtitles ? ' 🇧🇬 BG Subs' : ''}`);
				if (movie.torrentUrl) {
					console.log(`   🔗 ${movie.torrentUrl.substring(0, 80)}...`);
				}
			});
		}

		// Filter for "Sing 2" specifically
		const sing2Results = results.filter(m => 
			m.title.toLowerCase().includes('sing') && 
			m.title.toLowerCase().includes('2')
		);

		if (sing2Results.length > 0) {
			console.log(`\n\n🎬 Filtered "Sing 2" results: ${sing2Results.length}`);
			console.log('='.repeat(80));
			sing2Results.forEach((movie, index) => {
				console.log(`\n${index + 1}. ${movie.title}`);
				console.log(`   👤 ${movie.seeders} seeders | 💾 ${movie.size || 'Unknown'}`);
				console.log(`   ${movie.hasBulgarianAudio ? '🔊 BG Audio' : ''}${movie.hasBulgarianSubtitles ? ' 🇧🇬 BG Subs' : ''}`);
			});
		}

		// Now test searchByTitle with filtering
		console.log('\n\n' + '='.repeat(80));
		console.log('🎯 Testing searchByTitle() with title and year filtering');
		console.log('='.repeat(80));

		const filteredResults = await arenabg.searchByTitle('Sing 2', 2021);
		
		console.log(`\n✅ searchByTitle("Sing 2", 2021) returned ${filteredResults.length} results`);
		
		if (filteredResults.length > 0) {
			console.log('\nFiltered results:');
			filteredResults.forEach((torrent, index) => {
				console.log(`\n${index + 1}. ${torrent.title.trim()}`);
				console.log(`   👤 ${torrent.seeders} seeders`);
				console.log(`   ${torrent.hasBulgarianAudio ? '🔊 BG Audio' : ''}`);
			});
		}

		console.log('\n' + '='.repeat(80));
		console.log('✅ Live search test completed successfully!');
		console.log('='.repeat(80));

	} catch (error) {
		console.error('\n❌ Error during live search test:', error.message);
		console.error('\nStack trace:');
		console.error(error.stack);
		process.exit(1);
	}
}

testLiveSearch();
