const https = require('https');

function testUrl(url) {
    return new Promise((resolve) => {
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                resolve({ status: res.statusCode, length: data.length, sample: data.substring(0, 300) });
            });
        }).on('error', err => {
            resolve({ error: err.message });
        });
    });
}

async function run() {
    console.log('Testing CFM endpoints...');
    console.log('1:', await testUrl('https://portal.cfm.org.br/busca-medicos/'));
    console.log('2:', await testUrl('https://portal.cfm.org.br/api/v1/medicos?crm=12345'));
}

run();
