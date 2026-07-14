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
  console.log("Listing all Firestore databases in project:", projectId);
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases`;

  try {
    const response = await get(url, {
      'Authorization': `Bearer ${accessToken}`
    });
    console.log("Databases retrieved successfully.");
    if (response.databases) {
      response.databases.forEach(db => {
        console.log(`- DatabaseName: ${db.name}`);
        console.log(`  Type: ${db.type}`);
        console.log(`  LocationId: ${db.locationId}`);
        console.log(`  ConcurrencyMode: ${db.concurrencyMode}`);
        console.log("------------------------");
      });
    } else {
      console.log("No databases found.");
    }
  } catch (e) {
    console.error("Error listing databases:", e.message);
  }
}

run();
