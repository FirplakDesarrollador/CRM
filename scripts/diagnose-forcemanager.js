/**
 * Diagnóstico completo de conexión ForceManager API
 *
 * Prueba TODAS las combinaciones posibles:
 * - Ambos juegos de llaves
 * - API v4 (api.forcemanager.com) y Legacy (restfm2.forcemanager.net)
 * - Con y sin header X-FM-API-Version
 */
const crypto = require('crypto');
const https = require('https');

// ── Dos juegos de llaves ──
const KEY_SETS = [
  {
    name: 'Juego 1 (antiguo)',
    publicKey: 'b58oc9lhy1xptspqm1wczuh1jity5d',
    privateKey: '56e465d18a4cd99a0d620bd948bb2d09',
  },
  {
    name: 'Juego 2 (reciente)',
    publicKey: 'OTOAp4dXgm7O0bFM1zDCcDESRNN1Jc',
    privateKey: '93cc08cc7b70854a9438c13b9eec148d',
  },
];

// ── Endpoints a probar ──
const ENDPOINTS = [
  { name: 'API v4 Production', url: 'https://api.forcemanager.com/api/v4/accounts' },
  { name: 'API v4 Sandbox', url: 'https://sandbox-api.forcemanager.com/api/v4/accounts' },
  { name: 'Legacy restfm2', url: 'https://restfm2.forcemanager.net/api/companies' },
  { name: 'Legacy restfm', url: 'https://restfm.forcemanager.net/api/companies' },
];

function buildHeaders(publicKey, privateKey, apiVersion) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const payload = timestamp + publicKey + privateKey;
  const signature = crypto.createHash('sha1').update(payload).digest('hex');

  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'X-FM-PublicKey': publicKey,
    'X-FM-UnixTimestamp': timestamp,
    'X-FM-Signature': signature,
  };

  if (apiVersion) {
    headers['X-FM-API-Version'] = apiVersion;
  }

  return { headers, timestamp, signature };
}

function doRequest(url, headers) {
  return new Promise((resolve) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers,
      timeout: 10000,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          statusMessage: res.statusMessage,
          serverDate: res.headers.date,
          body: data.substring(0, 500),
        });
      });
    });

    req.on('error', (e) => {
      resolve({ status: 0, statusMessage: e.message, body: '' });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ status: 0, statusMessage: 'TIMEOUT', body: '' });
    });

    req.end();
  });
}

async function runTests() {
  console.log('='.repeat(70));
  console.log('  DIAGNOSTICO FORCEMANAGER API');
  console.log('  Fecha:', new Date().toISOString());
  console.log('  Unix Timestamp:', Math.floor(Date.now() / 1000));
  console.log('='.repeat(70));

  const apiVersions = [null, '2', '4'];
  let testNum = 0;

  for (const keySet of KEY_SETS) {
    for (const endpoint of ENDPOINTS) {
      for (const apiVer of apiVersions) {
        testNum++;
        const label = `Test ${testNum}: ${keySet.name} | ${endpoint.name} | API-Version: ${apiVer || 'none'}`;
        console.log('\n' + '-'.repeat(70));
        console.log(label);

        const { headers, timestamp, signature } = buildHeaders(
          keySet.publicKey, keySet.privateKey, apiVer
        );

        console.log(`  Timestamp: ${timestamp}`);
        console.log(`  Signature: ${signature}`);
        console.log(`  URL: ${endpoint.url}`);

        const result = await doRequest(endpoint.url, headers);

        const icon = result.status >= 200 && result.status < 300 ? 'OK' : 'FAIL';
        console.log(`  Result: [${icon}] ${result.status} ${result.statusMessage}`);
        if (result.serverDate) {
          console.log(`  Server Date: ${result.serverDate}`);
        }
        console.log(`  Body: ${result.body}`);
      }
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('  DIAGNOSTICO COMPLETO');
  console.log('='.repeat(70));
}

runTests();
