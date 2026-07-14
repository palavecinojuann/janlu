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

const collections = [
  'products',
  'rawMaterials',
  'campaigns',
  'offers',
  'sales',
  'customers',
  'auditLogs',
  'courses',
  'productionOrders',
  'preAuthorizedAdmins',
  'activities',
  'quotes',
  'financialDocs',
  'simulations',
  'coupons',
  'users',
  'subscribers',
  '_connection_test_'
];

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
  console.log("Querying Firestore REST API with access token...");
  for (const coll of collections) {
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents:runAggregationQuery`;
    
    // Query payload to count documents
    const payload = {
      "structuredAggregationQuery": {
        "structuredQuery": {
          "from": [{ "collectionId": coll }]
        },
        "aggregations": [{
          "count": {},
          "alias": "total"
        }]
      }
    };

    try {
      const response = await post(url, payload, {
        'Authorization': `Bearer ${accessToken}`
      });
      const count = response[0]?.result?.aggregateFields?.total?.integerValue || 0;
      console.log(`Collection '${coll}': ${count} documents`);
    } catch (e) {
      console.log(`Collection '${coll}': Failed (${e.message})`);
    }
  }
}

run();
