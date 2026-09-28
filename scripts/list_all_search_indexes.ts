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

async function listAllIndexes() {
  const client = new MongoClient(mongoUri);
  await client.connect();
  const adminDb = client.db().admin();
  
  const dbsResult = await adminDb.listDatabases();
  
  for (const dbInfo of dbsResult.databases) {
      const dbName = dbInfo.name;
      const db = client.db(dbName);
      
      try {
          const collections = await db.listCollections().toArray();
          for (const c of collections) {
              try {
                  const searchIndexes = await db.collection(c.name).listSearchIndexes().toArray();
                  if (searchIndexes.length > 0) {
                      console.log(`Database: ${dbName}, Collection: ${c.name}`);
                      for (const idx of searchIndexes as any[]) {
                          console.log(`  - Index Name: ${idx.name}, Type: ${idx.type}`);
                      }
                  }
              } catch(e: any) {
                  // Ignore permissions errors or lack of search index support on system collections
              }
          }
      } catch (e: any) {
          // Ignore
      }
  }
  await client.close();
}

listAllIndexes().catch(console.error);
