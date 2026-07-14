const fs = require('fs');
const https = require('https');

const configPath = "C:\\Users\\bimontcad\\.config\\configstore\\firebase-tools.json";

let accessToken = "";
try {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  accessToken = config.tokens.access_token;
} catch (e) {
  console.error("Error reading firebase-tools.json:", e);
  process.exit(1);
}

const projects = [
  "gen-lang-client-0938419484",
  "finanzas-hogar-8129e",
  "app-finanzas-ead64",
  "gen-lang-client-0185199610",
  "gen-lang-client-0068721174",
  "gen-lang-client-0986090044",
  "distributed-cave-wbb3r",
  "lateral-origin-454011-i9"
];

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

async function checkProject(proj) {
  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - 7 * 24 * 3600 * 1000); // 7 days
  
  const filter = encodeURIComponent('metric.type="firestore.googleapis.com/document/read_ops_count"');
  const startStr = encodeURIComponent(startTime.toISOString());
  const endStr = encodeURIComponent(endTime.toISOString());
  
  const url = `https://monitoring.googleapis.com/v3/projects/${proj}/timeSeries?filter=${filter}&interval.startTime=${startStr}&interval.endTime=${endStr}`;

  try {
    const response = await get(url, {
      'Authorization': `Bearer ${accessToken}`
    });
    let hasData = false;
    if (response.timeSeries && response.timeSeries.length > 0) {
      response.timeSeries.forEach(ts => {
        const points = ts.points || [];
        let sum = 0;
        let max = 0;
        points.forEach(pt => {
          const val = Number(pt.value.int64Value || pt.value.doubleValue || 0);
          sum += val;
          if (val > max) max = val;
        });
        if (sum > 0) {
          hasData = true;
          console.log(`Project: ${proj}`);
          console.log(`  Metric: ${ts.metric.type} (${ts.metric.labels.type || 'unknown'})`);
          console.log(`  Database ID: ${ts.resource.labels.database_id || 'default'}`);
          console.log(`  Total Points: ${points.length}, Sum of reads: ${sum}, Max reads in single minute: ${max}`);
          console.log("------------------------------------------------");
        }
      });
    }
    if (!hasData) {
      // console.log(`Project: ${proj} - No reads found`);
    }
  } catch (e) {
    console.log(`Project: ${proj} - Failed to query (${e.message})`);
  }
}

async function run() {
  console.log("Checking all projects for Firestore read activity in the last 7 days...");
  for (const proj of projects) {
    await checkProject(proj);
  }
}

run();
