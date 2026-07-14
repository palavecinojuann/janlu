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
  console.log("Checking for sales created today (2026-06-05)...");
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents:runQuery`;
  
  // Query sales created after June 5th 2026 (UTC)
  const payload = {
    "structuredQuery": {
      "from": [{ "collectionId": "sales" }],
      "where": {
        "fieldFilter": {
          "field": { "fieldPath": "date" },
          "op": "GREATER_THAN_OR_EQUAL",
          "value": { "stringValue": "2026-06-05T00:00:00.000Z" }
        }
      }
    }
  };

  try {
    const response = await post(url, payload, {
      'Authorization': `Bearer ${accessToken}`
    });
    const docs = response.filter(item => item.document);
    console.log(`Found ${docs.length} sales created today.`);
    docs.forEach((item, index) => {
      const doc = item.document;
      console.log(`[${index}] Sale: ${doc.name.split('/').pop()}`);
      console.log(`    Customer: ${doc.fields.customerName?.stringValue}`);
      console.log(`    Date: ${doc.fields.date?.stringValue}`);
      console.log(`    Total: ${doc.fields.totalAmount?.doubleValue || doc.fields.totalAmount?.integerValue}`);
    });
  } catch (e) {
    console.error("Error querying sales:", e);
  }
}

run();
