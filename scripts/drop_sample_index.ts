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

async function dropIndex() {
  const client = new MongoClient(mongoUri);
  await client.connect();
  const db = client.db('sample_mflix');
  
  try {
      console.log('Dropping search index on sample_mflix.movies...');
      await db.collection('movies').dropSearchIndex('default');
      console.log('Successfully dropped search index.');
  } catch (e: any) {
      console.error('Failed to drop index:', e.message);
  }
  await client.close();
}

dropIndex().catch(console.error);
