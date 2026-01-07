const https = require('https');

const url = 'https://lnphhmowklqiomownurw.supabase.co/auth/v1/health';

console.log('Checking connection to:', url);

const req = https.get(url, (res) => {
    console.log('Status Code:', res.statusCode);
    console.log('Headers:', JSON.stringify(res.headers));

    res.on('data', (d) => {
        process.stdout.write(d);
    });
});

req.on('error', (e) => {
    console.error('Connection Error:', e);
});

req.end();
