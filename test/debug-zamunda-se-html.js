const ZamundaSEAPI = require('../zamunda-se');
const fs = require('fs');
require('dotenv').config();

async function debugZamundaSE() {
    console.log('=== Debugging Zamunda.se HTML Structure ===\n');

    const zamundaSE = new ZamundaSEAPI({
        username: process.env.ZAMUNDA_SE_USERNAME,
        password: process.env.ZAMUNDA_SE_PASSWORD
    });

    try {
        console.log('Logging in...');
        await zamundaSE.login();
        console.log('✅ Login successful\n');

        console.log('Fetching search page...');
        await zamundaSE.ensureInitialized();
        
        const searchUrl = `${zamundaSE.config.baseUrl}/catalogue.php?search=avatar&catalog=movies`;
        console.log('URL:', searchUrl);
        
        const response = await zamundaSE.client.get(searchUrl, {
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept-Charset': 'UTF-8'
            },
            responseType: 'arraybuffer'
        });

        // Decode the response
        const { TextDecoder } = require('util');
        const decoder = new TextDecoder('windows-1251');
        const html = decoder.decode(response.data);
        
        // Save to file for inspection
        fs.writeFileSync('zamunda-se-search.html', html, 'utf8');
        console.log('\n✅ HTML saved to: zamunda-se-search.html');
        console.log('File size:', html.length, 'bytes');
        
        // Show a preview
        console.log('\nHTML Preview (first 2000 chars):');
        console.log('='.repeat(80));
        console.log(html.substring(0, 2000));
        console.log('='.repeat(80));
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

debugZamundaSE();
