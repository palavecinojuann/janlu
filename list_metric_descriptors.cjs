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
  console.log("Listing metric descriptors starting with firestore.googleapis.com/...");
  
  const filter = encodeURIComponent('metric.type = starts_with("firestore.googleapis.com/")');
  const url = `https://monitoring.googleapis.com/v3/projects/${projectId}/metricDescriptors?filter=${filter}`;

  try {
    const response = await get(url, {
      'Authorization': `Bearer ${accessToken}`
    });
    console.log("Metric Descriptors retrieved successfully.");
    if (response.metricDescriptors) {
      response.metricDescriptors.forEach(desc => {
        console.log(`- Type: ${desc.type}`);
        console.log(`  DisplayName: ${desc.displayName}`);
        console.log(`  Description: ${desc.description}`);
        console.log(`  MetricKind: ${desc.metricKind}, ValueType: ${desc.valueType}`);
        console.log("------------------------");
      });
    } else {
      console.log("No metric descriptors found.");
    }
  } catch (e) {
    console.error("Error listing metric descriptors:", e.message);
  }
}

run();
