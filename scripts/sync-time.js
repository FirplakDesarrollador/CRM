const https = require('https');

function checkTime() {
    const start = Date.now();
    const req = https.request('https://api.forcemanager.com/api/v4/accounts', { method: 'HEAD' }, (res) => {
        const serverDate = new Date(res.headers.date);
        const end = Date.now();
        const latency = (end - start) / 2;
        const localTime = Date.now();

        console.log('Server Date Header:', res.headers.date);
        console.log('Server Time (parsed):', serverDate.toISOString(), `(${serverDate.getTime()})`);
        console.log('Local Time:', new Date(localTime).toISOString(), `(${localTime})`);

        const offset = serverDate.getTime() - localTime;
        console.log('Offset (ms):', offset);
        console.log('Offset (seconds):', Math.floor(offset / 1000));
    });

    req.on('error', (e) => {
        console.error(e);
    });

    req.end();
}

checkTime();
