const { initializeApp } = require('firebase/app');
const { initializeFirestore, collection, getDocs } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyBzOxCdxgJo77Wb8a5Z4PIGJzEdhAcwWVE",
  authDomain: "gen-lang-client-0068721174.firebaseapp.com",
  projectId: "gen-lang-client-0068721174",
  storageBucket: "gen-lang-client-0068721174.appspot.com",
  messagingSenderId: "104493983183",
  appId: "1:104493983183:web:7eef964523e21ee703deba"
};

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {}, "ai-studio-19c9ceaa-c323-42fd-a900-048de6612687");

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
  '_connection_test_'
];

async function count() {
  console.log("Counting collections...");
  for (const name of collections) {
    try {
      const snap = await getDocs(collection(db, name));
      console.log(`Collection '${name}': ${snap.size} documents`);
    } catch (e) {
      console.log(`Collection '${name}': Failed to read (${e.message})`);
    }
  }
  process.exit(0);
}

count();
