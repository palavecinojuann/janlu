const fs = require('fs');
const https = require('https');

const databaseId = "ai-studio-19c9ceaa-c323-42fd-a900-048de6612687";
const projectId = "gen-lang-client-0068721174";

// Read tokens
const configPath = "C:\\Users\\bimontcad\\.config\\configstore\\firebase-tools.json";
let accessToken = "";
try {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  accessToken = config.tokens.access_token;
} catch (e) {
  console.error("Error reading firebase-tools.json:", e);
  process.exit(1);
}

function post(url, data, headers) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const options = {
      method: 'POST',
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = https.request(options, (res) => {
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
    req.write(JSON.stringify(data));
    req.end();
  });
}

async function run() {
  console.log("Listing all collections in Firestore...");
  // Firestore REST API has an endpoint to list collections
  // POST https://firestore.googleapis.com/v1/projects/{projectId}/databases/{databaseId}/documents:listCollectionIds
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents:listCollectionIds`;
  
  try {
    const response = await post(url, {}, {
      'Authorization': `Bearer ${accessToken}`
    });
    console.log("Collections in the database:");
    if (response.collectionIds) {
      for (const id of response.collectionIds) {
        // Query to count documents in this collection
        const countUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents:runAggregationQuery`;
        const countPayload = {
          "structuredAggregationQuery": {
            "structuredQuery": {
              "from": [{ "collectionId": id }]
            },
            "aggregations": [{
              "count": {},
              "alias": "total"
            }]
          }
        };
        const countResponse = await post(countUrl, countPayload, {
          'Authorization': `Bearer ${accessToken}`
        });
        const count = countResponse[0]?.result?.aggregateFields?.total?.integerValue || 0;
        console.log(`- ${id}: ${count} documents`);
      }
    } else {
      console.log("No collections found.");
    }
  } catch (e) {
    console.error("Error listing collections:", e);
  }
}

run();
