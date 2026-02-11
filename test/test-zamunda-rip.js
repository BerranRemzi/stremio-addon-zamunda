require('dotenv').config();
const ZamundaRIPAPI = require('../src/trackers/zamunda-rip');

async function testZamundaRip() {
	console.log('🧪 Testing Zamunda.rip API...\n');

	const api = new ZamundaRIPAPI({});

	try {
		// Initialize
		await api.ensureInitialized();
		console.log('✓ API Initialized');

		// Test search
		console.log('\n🔍 Testing search for "The Matrix"...');
		const results = await api.searchByTitle('The Matrix', 1999);
		console.log(`Found ${results.length} results`);
		
		if (results.length > 0) {
			console.log('📊 First 3 results:');
			results.slice(0, 3).forEach((torrent, index) => {
				console.log(`  ${index + 1}. ${torrent.title}`);
				console.log(`     URL: ${torrent.url}`);
			});
		}

		console.log('\n✅ All tests completed successfully!');
	} catch (error) {
		console.error('❌ Test failed:', error.message);
	}
}

testZamundaRip();
