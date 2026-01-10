const ArenaBGAPI = require('./../arenabg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

console.log('='.repeat(80));
console.log('ArenaBG Download Key Extraction Test');
console.log('='.repeat(80));

async function testDownloadKeyExtraction() {
	// Initialize ArenaBG API
	const arenabg = new ArenaBGAPI({
		username: process.env.ZAMUNDA_USERNAME,
		password: process.env.ZAMUNDA_PASSWORD
	});

	try {
		console.log('\n🔄 Initializing and logging in...');
		await arenabg.ensureInitialized();
		await arenabg.login();

		// Example detail page URL from user
		const exampleDetailUrl = 'https://arenabg.com/bg/torrents/MmVBTnVmd2x1M0RnVzh2OUNkcjRHZz09OjrZpW8aCKHvYPm5XVjnDYdH/';
		
		console.log('\n🔍 Testing download key extraction:');
		console.log(`   Detail URL: ${exampleDetailUrl}`);
		
		const downloadUrl = await arenabg.getDownloadUrl(exampleDetailUrl);
		
		if (downloadUrl) {
			console.log(`\n✅ Successfully extracted download URL:`);
			console.log(`   ${downloadUrl}`);
			
			// Expected format: https://arenabg.com/bg/torrents/download/?key=...
			if (downloadUrl.includes('/bg/torrents/download/?key=')) {
				console.log('\n✓ Download URL format is correct!');
			} else {
				console.log('\n⚠️  Download URL format may be incorrect');
			}
		} else {
			console.log('\n❌ Failed to extract download key');
		}

		// Now test with search results
		console.log('\n\n' + '='.repeat(80));
		console.log('Testing with "Sing 2 2021" search results');
		console.log('='.repeat(80));

		const torrents = await arenabg.searchByTitle('Sing 2', 2021);
		console.log(`\nFound ${torrents.length} torrents`);

		if (torrents.length > 0) {
			console.log('\n🔗 Fetching download URLs for all results...\n');
			
			for (let i = 0; i < Math.min(torrents.length, 5); i++) {
				const torrent = torrents[i];
				console.log(`${i + 1}. ${torrent.title.trim()}`);
				console.log(`   Detail: ${torrent.detailUrl || torrent.url}`);
				
				if (torrent.detailUrl) {
					const dlUrl = await arenabg.getDownloadUrl(torrent.detailUrl);
					if (dlUrl) {
						console.log(`   ✅ Download: ${dlUrl.substring(0, 80)}...`);
					} else {
						console.log(`   ❌ Could not get download URL`);
					}
				} else {
					console.log(`   ⚠️  No detail URL available`);
				}
				console.log('');
			}
		}

		console.log('='.repeat(80));
		console.log('✅ Download key extraction test completed!');
		console.log('='.repeat(80));

	} catch (error) {
		console.error('\n❌ Error during test:', error.message);
		console.error(error.stack);
		process.exit(1);
	}
}

testDownloadKeyExtraction();
