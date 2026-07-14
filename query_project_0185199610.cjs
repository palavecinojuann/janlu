const fs = require('fs');
const https = require('https');

const projectId = "gen-lang-client-0185199610";
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
  console.log("Querying GCP Monitoring for gen-lang-client-0185199610...");
  
  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - 7 * 24 * 3600 * 1000); // last 7 days
  
  const filter = encodeURIComponent('metric.type="firestore.googleapis.com/document/read_count"');
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
        console.log(`\nTime Series #${idx + 1}:`);
        console.log("Labels:", JSON.stringify(ts.metric.labels));
        const points = ts.points || [];
        let maxVal = 0;
        let maxTime = "";
        let sumVal = 0;
        points.forEach(pt => {
          const val = Number(pt.value.int64Value || pt.value.doubleValue || 0);
          sumVal += val;
          if (val > maxVal) {
            maxVal = val;
            maxTime = pt.interval.endTime;
          }
        });
        console.log(`- Total Points: ${points.length}`);
        console.log(`- Sum of values: ${sumVal}`);
        console.log(`- Max value: ${maxVal} at ${maxTime}`);
      });
    } else {
      console.log("No timeSeries data found for gen-lang-client-0185199610.");
    }
  } catch (e) {
    console.error("Error querying monitoring metrics:", e.message);
  }
}

run();
