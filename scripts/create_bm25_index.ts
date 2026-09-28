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

if (!mongoUri) {
  console.error('Validation Error: MONGO_URI not found in .env');
  process.exit(1);
}

async function createAtlasSearchIndex() {
  console.log('Connecting to MongoDB using mongodb driver...');
  const client = new MongoClient(mongoUri);
  await client.connect();
  console.log('Connected.');

  const db = client.db();
  const collection = db.collection('kural_embeddings');
  
  const indexDefinition = {
    name: 'kural_bm25_index',
    definition: {
      mappings: {
        dynamic: false,
        fields: {
          text: {
            type: 'string',
            analyzer: 'lucene.standard'
          }
        }
      }
    }
  };

  try {
    console.log('Creating Atlas Search index...');
    // Create the search index. Note: This only works on MongoDB Atlas.
    await collection.createSearchIndex(indexDefinition);
    console.log('Atlas Search index creation initiated successfully.');
    console.log('Note: It may take a few minutes for the index to build in Atlas.');
  } catch (error: any) {
    if (error.code === 68) {
       console.log('Index already exists or similar conflict:', error.message);
    } else {
       console.error('Failed to create search index:', error);
    }
  }

  await client.close();
}

createAtlasSearchIndex().catch(e => {
  console.error(e);
  process.exit(1);
});
