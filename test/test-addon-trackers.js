const addon = require('../addon');
require('dotenv').config();

async function testAddon() {
    console.log('=== Testing Complete Addon with Multiple Trackers ===\n');
    
    // Parse tracker enable/disable flags
    const TRACKERS_ENABLED = {
        zamundaNet: process.env.ZAMUNDA_NET === 'true',
        zamundaCh: process.env.ZAMUNDA_CH === 'true',
        zamundaSe: process.env.ZAMUNDA_SE === 'true',
        arenabg: process.env.ARENABG_COM === 'true'
    };
    
    console.log('Tracker Status:');
    console.log('- Zamunda.net:', TRACKERS_ENABLED.zamundaNet ? '✓ Enabled' : '✗ Disabled');
    console.log('- Zamunda.ch:', TRACKERS_ENABLED.zamundaCh ? '✓ Enabled' : '✗ Disabled');
    console.log('- Zamunda.se:', TRACKERS_ENABLED.zamundaSe ? '✓ Enabled' : '✗ Disabled');
    console.log('- ArenaBG:', TRACKERS_ENABLED.arenabg ? '✓ Enabled' : '✗ Disabled');
    console.log();

    try {
        // Test with a popular movie (The Matrix)
        const testImdbId = 'tt0133093'; // The Matrix (1999)
        
        console.log(`Testing with IMDB ID: ${testImdbId} (The Matrix)`);
        console.log('Fetching streams...\n');
        
        const result = await addon.get({ 
            resource: 'stream',
            type: 'movie', 
            id: testImdbId 
        });
        
        if (result && result.streams) {
            console.log(`\n✅ SUCCESS: Found ${result.streams.length} total streams`);
            
            if (result.streams.length > 0) {
                console.log('\nSample streams:');
                result.streams.slice(0, 5).forEach((stream, index) => {
                    console.log(`\n${index + 1}. ${stream.name || 'Unnamed'}`);
                    console.log(`   InfoHash: ${stream.infoHash || 'N/A'}`);
                    if (stream.title) console.log(`   Title: ${stream.title}`);
                });
            }
        } else {
            console.log('❌ No streams found');
        }
        
        console.log('\n=== Test completed ===');
    } catch (error) {
        console.error('❌ Test error:', error.message);
        console.error(error.stack);
    }
}

// Run the test
testAddon();
