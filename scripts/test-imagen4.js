'use strict';
// Standalone Imagen 4 API key test — completely separate from everything else.
// Usage: node scripts/test-imagen4.js

const https = require('https');

const API_KEY = process.env.IMAGEN4_API_KEY;
if (!API_KEY) { console.error('Set IMAGEN4_API_KEY env var before running.'); process.exit(1); }
const MODEL   = 'imagen-4.0-generate-001';

const body = JSON.stringify({
  instances: [{ prompt: 'A clean white coffee mug on a wooden desk' }],
  parameters: { sampleCount: 1 }
});

const options = {
  hostname: 'generativelanguage.googleapis.com',
  path: `/v1beta/models/${MODEL}:generateImages?key=${API_KEY}`,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  },
};

console.log(`Testing Imagen 4 API key...`);
console.log(`Model: ${MODEL}\n`);

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log(`Status: ${res.statusCode}`);
    try {
      const json = JSON.parse(data);
      if (res.statusCode === 200 && json.predictions?.length > 0) {
        console.log(`✓ API key works! Got ${json.predictions.length} image(s).`);
        console.log(`  Image data length: ${json.predictions[0].bytesBase64Encoded?.length || 0} chars (base64)`);
      } else {
        console.error(`✗ Error response:`);
        console.error(JSON.stringify(json, null, 2));
      }
    } catch {
      console.error(`✗ Non-JSON response:`);
      console.error(data);
    }
  });
});

req.on('error', (err) => {
  console.error(`✗ Request failed: ${err.message}`);
});

req.write(body);
req.end();
