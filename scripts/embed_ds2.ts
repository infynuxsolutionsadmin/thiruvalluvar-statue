import * as mongoose from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import { pipeline } from '@xenova/transformers';

// Parse .env manually to avoid dotenv dependency
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

const ds2Path = path.resolve(__dirname, '../datasets/DS2/Adhigarams.json');

async function embedDs2() {
  console.log('Loading dataset DS2...');
  const ds2 = JSON.parse(fs.readFileSync(ds2Path, 'utf-8'));
  console.log(`Loaded ${ds2.length} Adhigarams.`);

  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUri);
  console.log('Connected.');

  const schemaOpts: mongoose.SchemaOptions = { strict: false, versionKey: false };
  const AdhigaramModel = mongoose.model('Adhigaram', new mongoose.Schema({}, schemaOpts), 'adhigarams');

  console.log('Loading Xenova/bge-m3 model...');
  const extractor = await pipeline('feature-extraction', 'Xenova/bge-m3');
  console.log('Model loaded.');

  let successCount = 0;
  let failureCount = 0;

  for (const item of ds2) {
    // Construct search text from authoritative fields
    // Using adhigaram_name, short_description, and summary
    const textToEmbed = `${item.adhigaram_name}. ${item.short_description || ''} ${item.summary || ''}`.trim();
    
    try {
      // Create embedding
      const output = await extractor(textToEmbed, { pooling: 'mean', normalize: true });
      const embedding = Array.from(output.data);
      
      if (embedding.length !== 1024) {
        console.warn(`Warning: Expected 1024 dimensions, got ${embedding.length} for ${item.id}`);
      }

      // Update MongoDB
      await AdhigaramModel.updateOne(
        { id: item.id },
        { $set: { embedding } }
      );
      
      successCount++;
      if (successCount % 10 === 0) {
        console.log(`Processed ${successCount}/${ds2.length} records...`);
      }
    } catch (e) {
      console.error(`Failed to embed ${item.id}:`, e);
      failureCount++;
    }
  }

  console.log(`\nMigration Complete!`);
  console.log(`Successful Embeddings: ${successCount}`);
  console.log(`Failed Embeddings: ${failureCount}`);

  await mongoose.disconnect();
}

embedDs2().catch(e => {
  console.error(e);
  process.exit(1);
});
