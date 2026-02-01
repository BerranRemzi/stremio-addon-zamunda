const ZamundaCHAPI = require('../zamunda-ch');
require('dotenv').config();

async function testZamundaCH() {
    console.log('=== Testing Zamunda.ch API ===\n');

    // Initialize API with credentials from .env
    const zamundaCH = new ZamundaCHAPI({
        username: process.env.ZAMUNDA_USERNAME,
        password: process.env.ZAMUNDA_PASSWORD
    });

    try {
        // Test 1: Login
        console.log('Test 1: Testing login with GET request...');
        const loginSuccess = await zamundaCH.login();
        
        if (loginSuccess) {
            console.log('✅ Login successful!\n');
        } else {
            console.error('❌ Login failed!\n');
            return;
        }

        // Test 2: Search for a movie
        console.log('Test 2: Testing search...');
        const searchResults = await zamundaCH.search('Avatar');
        console.log(`Found ${searchResults.length} results for "Avatar"`);
        
        if (searchResults.length > 0) {
            console.log('First result:', searchResults[0].title);
            console.log('✅ Search successful!\n');
        } else {
            console.log('⚠️ No results found\n');
        }

        // Test 3: Search by title and year
        console.log('Test 3: Testing searchByTitle with year...');
        const movieResults = await zamundaCH.searchByTitle('The Matrix', 1999);
        console.log(`Found ${movieResults.length} torrents for "The Matrix (1999)"`);
        
        if (movieResults.length > 0) {
            console.log('Sample torrent:', {
                title: movieResults[0].title,
                infoHash: movieResults[0].infoHash,
                sources: movieResults[0].sources
            });
            console.log('✅ searchByTitle successful!\n');
        } else {
            console.log('⚠️ No torrents found\n');
        }

        // Test 4: Format torrents as streams
        if (movieResults.length > 0) {
            console.log('Test 4: Testing formatTorrentsAsStreams...');
            const streams = await zamundaCH.formatTorrentsAsStreams(movieResults.slice(0, 2));
            console.log(`Formatted ${streams.length} streams`);
            
            if (streams.length > 0) {
                console.log('Sample stream:', {
                    name: streams[0].name,
                    infoHash: streams[0].infoHash
                });
                console.log('✅ formatTorrentsAsStreams successful!\n');
            }
        }

        console.log('=== All tests completed ===');
    } catch (error) {
        console.error('❌ Test error:', error.message);
        console.error(error.stack);
    }
}

// Run the test
testZamundaCH();
