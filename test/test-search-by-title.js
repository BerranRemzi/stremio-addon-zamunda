const ArenaBGAPI = require('./../arenabg');
const ZamundaAPI = require('./../zamunda');
require('dotenv').config({ path: './../.env' });

console.log('='.repeat(80));
console.log('Search by Title Test - Both Trackers');
console.log('='.repeat(80));

async function testSearchByTitle() {
	const testMovies = [
		{ title: 'Sing 2', year: 2021 },
		{ title: 'The Matrix', year: 1999 },
		{ title: 'Inception', year: 2010 }
	];

	// Initialize both APIs
	const arenabg = new ArenaBGAPI({
		username: process.env.ZAMUNDA_USERNAME,
		password: process.env.ZAMUNDA_PASSWORD
	});

	const zamunda = new ZamundaAPI({
		username: process.env.ZAMUNDA_USERNAME,
		password: process.env.ZAMUNDA_PASSWORD
	});

	try {
		console.log('\n🔄 Initializing APIs...');
		await Promise.all([
			arenabg.ensureInitialized(),
			zamunda.ensureInitialized()
		]);
		console.log('✓ Both APIs initialized\n');

		for (const movie of testMovies) {
			console.log('='.repeat(80));
			console.log(`🎬 Searching: ${movie.title} (${movie.year})`);
			console.log('='.repeat(80));

			// Search both trackers in parallel
			const [arenabgResults, zamundaResults] = await Promise.all([
				arenabg.searchByTitle(movie.title, movie.year).catch(err => {
					console.error(`  ArenaBG error: ${err.message}`);
					return [];
				}),
				zamunda.searchByTitle(movie.title, movie.year).catch(err => {
					console.error(`  Zamunda error: ${err.message}`);
					return [];
				})
			]);

			console.log(`\n📊 Results:`);
			console.log(`   ArenaBG: ${arenabgResults.length} torrents`);
			console.log(`   Zamunda: ${zamundaResults.length} torrents`);
			console.log(`   Total: ${arenabgResults.length + zamundaResults.length} torrents`);

			if (arenabgResults.length > 0) {
				console.log(`\n   🟢 ArenaBG top result: ${arenabgResults[0].title.trim()}`);
				console.log(`      Seeders: ${arenabgResults[0].seeders}`);
			}

			if (zamundaResults.length > 0) {
				console.log(`\n   🔵 Zamunda top result: ${zamundaResults[0].title.trim()}`);
				console.log(`      Seeders: ${zamundaResults[0].seeders}`);
			}

			console.log('');
		}

		console.log('='.repeat(80));
		console.log('Search test completed! ✅');
		console.log('='.repeat(80));

	} catch (error) {
		console.error('\n❌ Error during test:', error.message);
		console.error(error.stack);
		process.exit(1);
	}
}

testSearchByTitle();
