const ArenaBGAPI = require('./../arenabg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

console.log('='.repeat(80));
console.log('🇧🇬 Bulgarian Audio Flag Detection Test');
console.log('='.repeat(80));

async function testBulgarianAudioFlag() {
	const searchQuery = 'sing 2 2021';
	
	const arenabg = new ArenaBGAPI({
		username: process.env.ZAMUNDA_USERNAME,
		password: process.env.ZAMUNDA_PASSWORD
	});

	try {
		console.log('\n🔄 Initializing and logging in...');
		await arenabg.ensureInitialized();
		await arenabg.login();
		console.log('✓ Ready');

		console.log(`\n🔍 Searching for: "${searchQuery}"`);
		const results = await arenabg.search(searchQuery);
		
		console.log(`\n📊 Found ${results.length} total results`);
		console.log('='.repeat(80));

		// Look for movies with "Sing 2"
		const sing2Results = results.filter(m => 
			m.title.toLowerCase().includes('sing') && 
			m.title.toLowerCase().includes('2')
		);

		console.log(`\n🎬 "Sing 2" movies: ${sing2Results.length}`);
		console.log('='.repeat(80));

		let foundBulgarianAudio = false;
		
		sing2Results.forEach((movie, index) => {
			console.log(`\n${index + 1}. ${movie.title}`);
			console.log(`   Seeders: ${movie.seeders} | Size: ${movie.size || 'Unknown'}`);
			
			// Check if title contains Bulgarian audio indicators
			const titleLower = movie.title.toLowerCase();
			const hasBgAudioInTitle = 
				titleLower.includes('българско озвучение') ||
				titleLower.includes('bulgarian audio') ||
				titleLower.includes('bg audio') ||
				titleLower.includes('bgaudio');
			
			if (hasBgAudioInTitle) {
				console.log(`   ⭐ Title contains Bulgarian audio indicator!`);
				foundBulgarianAudio = true;
			}
			
			console.log(`   📊 Detection Results:`);
			console.log(`      hasBulgarianAudio: ${movie.hasBulgarianAudio ? '✅ TRUE' : '❌ FALSE'}`);
			console.log(`      hasBulgarianSubtitles: ${movie.hasBulgarianSubtitles ? '✅ TRUE' : '❌ FALSE'}`);
			
			if (hasBgAudioInTitle && !movie.hasBulgarianAudio) {
				console.log(`   ⚠️  WARNING: Title has Bulgarian audio but flag not detected!`);
			} else if (movie.hasBulgarianAudio) {
				console.log(`   ✅ Bulgarian audio flag correctly detected!`);
			}
		});

		// Test the full stream formatting to see final output
		console.log('\n\n' + '='.repeat(80));
		console.log('🎯 Testing Stream Formatting (Final Stremio Output)');
		console.log('='.repeat(80));

		const torrents = await arenabg.searchByTitle('Sing 2', 2021);
		
		if (torrents.length > 0) {
			console.log(`\n✅ Found ${torrents.length} torrents for "Sing 2 (2021)"`);
			console.log('\nFormatting as streams...\n');
			
			// Format torrents as streams (this is what Stremio actually sees)
			const streams = await arenabg.formatTorrentsAsStreams(torrents);
			
			console.log(`✅ Generated ${streams.length} streams\n`);
			console.log('First 3 streams as they would appear in Stremio:\n');
			
			for (let i = 0; i < Math.min(3, streams.length); i++) {
				const stream = streams[i];
				console.log(`${i + 1}. Name: ${JSON.stringify(stream.name)}`);
				console.log(`   Title: ${stream.title}`);
				
				// Check if Bulgarian flag is in the title
				if (stream.title.includes('🇧🇬')) {
					console.log(`   ✅ Contains 🇧🇬 flag - Bulgarian audio detected!`);
				} else {
					console.log(`   ℹ️  No 🇧🇬 flag - Not Bulgarian audio`);
				}
				console.log('');
			}
		}

		console.log('='.repeat(80));
		if (foundBulgarianAudio) {
			console.log('✅ Test completed - Found movies with Bulgarian audio');
		} else {
			console.log('⚠️  Test completed - No Bulgarian audio found in results');
		}
		console.log('='.repeat(80));

	} catch (error) {
		console.error('\n❌ Error:', error.message);
		console.error(error.stack);
		process.exit(1);
	}
}

testBulgarianAudioFlag();
