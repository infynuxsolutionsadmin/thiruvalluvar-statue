import { MongoClient } from 'mongodb';
import * as fs from 'fs';
import * as path from 'path';

const envPath = path.resolve(__dirname, '../.env');
let mongoUri = '';
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const match = envContent.match(/MONGO_URI="(.*)"/);
  if (match && match[1]) {
    mongoUri = match[1];
  }
}

async function listIndexes() {
  const client = new MongoClient(mongoUri);
  await client.connect();
  const db = client.db();
  
  const collections = await db.listCollections().toArray();
  for (const c of collections) {
      console.log('Collection:', c.name);
      try {
          const searchIndexes = await db.collection(c.name).listSearchIndexes().toArray();
          console.log(`  Search Indexes on ${c.name}:`, JSON.stringify(searchIndexes, null, 2));
      } catch(e: any) {
          console.log(`  Could not list search indexes for ${c.name}`);
      }
  }
  await client.close();
}

listIndexes().catch(console.error);
