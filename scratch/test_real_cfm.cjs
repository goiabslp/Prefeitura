const https = require('https');

function fetchJson(url) {
    return new Promise((resolve) => {
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, json: JSON.parse(data) });
                } catch {
                    resolve({ status: res.statusCode, text: data.substring(0, 300) });
                }
            });
        }).on('error', err => resolve({ error: err.message }));
    });
}

async function run() {
    console.log('Testing open CRM APIs...');
    console.log('API 1 (consultacrm):', await fetchJson('https://consultacrm.com.br/api/v1/crm/12345/mg'));
}

run();
