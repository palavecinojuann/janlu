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
  console.log("Checking for failed sales in Firestore...");
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents:runQuery`;
  
  const payload = {
    "structuredQuery": {
      "from": [{ "collectionId": "sales" }],
      "where": {
        "fieldFilter": {
          "field": { "fieldPath": "status" },
          "op": "EQUAL",
          "value": { "stringValue": "failed_stock" }
        }
      }
    }
  };

  try {
    const response = await post(url, payload, {
      'Authorization': `Bearer ${accessToken}`
    });
    console.log(`Query returned ${response.length} results.`);
    response.forEach((item, index) => {
      if (item.document) {
        const docName = item.document.name;
        const fields = item.document.fields;
        console.log(`[${index}] Doc: ${docName}`);
        console.log(`    Customer: ${fields.customerName?.stringValue}`);
        console.log(`    Date: ${fields.date?.stringValue}`);
        console.log(`    ErrorLog: ${fields.errorLog?.stringValue}`);
      }
    });
  } catch (e) {
    console.error("Error running query:", e);
  }
}

run();
