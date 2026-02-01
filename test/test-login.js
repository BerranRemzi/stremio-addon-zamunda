const ArenaBGAPI = require('../src/trackers/arenabg');
require('dotenv').config({ path: './../.env' });

console.log('='.repeat(80));
console.log('ArenaBG Login Test');
console.log('='.repeat(80));

async function testLogin() {
	// Initialize ArenaBG API
	const arenabg = new ArenaBGAPI({
		username: process.env.ZAMUNDA_USERNAME,
		password: process.env.ZAMUNDA_PASSWORD
	});

	console.log('\n📝 Credentials loaded from .env file');
	console.log(`   Username: ${process.env.ZAMUNDA_USERNAME ? '✓' : '✗'}`);
	console.log(`   Password: ${process.env.ZAMUNDA_PASSWORD ? '✓ (hidden)' : '✗'}`);

	try {
		console.log('\n🔄 Initializing ArenaBG API...');
		await arenabg.ensureInitialized();
		console.log('✓ API initialized');

		console.log('\n🔑 Attempting login to arenabg.com...');
		const loginResult = await arenabg.login();
		
		if (loginResult) {
			console.log('✅ Login successful!');
		} else {
			console.log('❌ Login failed!');
		}

		console.log('\n🔍 Testing search functionality...');
		const results = await arenabg.search('sing 2 2021');
		console.log(`✓ Search returned ${results.length} results`);

		if (results.length > 0) {
			console.log('\n📋 First 3 results:');
			results.slice(0, 3).forEach((movie, index) => {
				console.log(`\n${index + 1}. ${movie.title}`);
				console.log(`   Seeders: ${movie.seeders}`);
				console.log(`   ${movie.hasBulgarianAudio ? '🔊 BG Audio' : ''} ${movie.hasBulgarianSubtitles ? '🇧🇬 BG Subs' : ''}`);
			});
		}

		console.log('\n' + '='.repeat(80));
		console.log('Login test completed! ✅');
		console.log('='.repeat(80));

	} catch (error) {
		console.error('\n❌ Error during test:', error.message);
		console.error(error.stack);
		process.exit(1);
	}
}

testLogin();
