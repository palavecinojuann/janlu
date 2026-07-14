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
  console.log("Listing all GCP projects accessible to the user...");
  const url = "https://cloudresourcemanager.googleapis.com/v1/projects";

  try {
    const response = await get(url, {
      'Authorization': `Bearer ${accessToken}`
    });
    console.log("Projects retrieved successfully.");
    if (response.projects) {
      response.projects.forEach(p => {
        console.log(`- ProjectName: ${p.name}`);
        console.log(`  ProjectId: ${p.projectId}`);
        console.log(`  ProjectNumber: ${p.projectNumber}`);
        console.log(`  LifecycleState: ${p.lifecycleState}`);
        console.log("------------------------");
      });
    } else {
      console.log("No projects found.");
    }
  } catch (e) {
    console.error("Error listing projects:", e.message);
  }
}

run();
