const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

initializeApp();
const db = getFirestore("ai-studio-19c9ceaa-c323-42fd-a900-048de6612687");

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

async function count() {
  console.log("Counting collections using Admin SDK...");
  for (const name of collections) {
    try {
      const snap = await db.collection(name).get();
      console.log(`Collection '${name}': ${snap.size} documents`);
    } catch (e) {
      console.log(`Collection '${name}': Failed to read (${e.message})`);
    }
  }
  process.exit(0);
}

count();
