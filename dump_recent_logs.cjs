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
  console.log("Fetching recent auditLogs...");
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents:runQuery`;
  
  const payload = {
    "structuredQuery": {
      "from": [{ "collectionId": "auditLogs" }],
      "orderBy": [{
        "field": { "fieldPath": "timestamp" },
        "direction": "DESCENDING"
      }],
      "limit": 20
    }
  };

  try {
    const response = await post(url, payload, {
      'Authorization': `Bearer ${accessToken}`
    });
    console.log("Recent audit logs:");
    response.forEach(item => {
      if (item.document) {
        const fields = item.document.fields;
        console.log(`- Time: ${fields.timestamp?.stringValue}, Action: ${fields.action?.stringValue}, Entity: ${fields.entityType?.stringValue}, User: ${fields.userId?.stringValue}`);
      }
    });
  } catch (e) {
    console.error("Error fetching audit logs:", e);
  }
}

run();
