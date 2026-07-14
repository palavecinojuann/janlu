const fs = require('fs');
const https = require('https');

const projectId = "gen-lang-client-0068721174";
const configPath = "C:\\Users\\bimontcad\\.config\\configstore\\firebase-tools.json";

let accessToken = "";
try {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  accessToken = config.tokens.access_token;
} catch (e) {
  console.error("Error reading firebase-tools.json:", e);
  process.exit(1);
}

function get(url, headers) {
  return new Promise((resolve, reject) => {
    const options = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = https.request(url, options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(body));
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function run() {
  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - 7 * 24 * 3600 * 1000); // 7 days
  
  const filter = encodeURIComponent('metric.type="firestore.googleapis.com/document/read_ops_count"');
  const startStr = encodeURIComponent(startTime.toISOString());
  const endStr = encodeURIComponent(endTime.toISOString());
  
  const url = `https://monitoring.googleapis.com/v3/projects/${projectId}/timeSeries?filter=${filter}&interval.startTime=${startStr}&interval.endTime=${endStr}`;

  try {
    const response = await get(url, {
      'Authorization': `Bearer ${accessToken}`
    });
    if (response.timeSeries && response.timeSeries.length > 0) {
      console.log(`Found ${response.timeSeries.length} time series.`);
      response.timeSeries.forEach((ts, idx) => {
        console.log(`\n--- Time Series #${idx + 1} ---`);
        console.log("Metric Type:", ts.metric.type);
        console.log("Metric Labels:", JSON.stringify(ts.metric.labels));
        console.log("Resource Type:", ts.resource.type);
        console.log("Resource Labels:", JSON.stringify(ts.resource.labels));
        const points = ts.points || [];
        let sum = 0;
        let max = 0;
        points.forEach(pt => {
          const val = Number(pt.value.int64Value || pt.value.doubleValue || 0);
          sum += val;
          if (val > max) max = val;
        });
        console.log(`Points count: ${points.length}, Sum: ${sum}, Max: ${max}`);
      });
    } else {
      console.log("No timeSeries found.");
    }
  } catch (e) {
    console.error("Error:", e.message);
  }
}

run();
