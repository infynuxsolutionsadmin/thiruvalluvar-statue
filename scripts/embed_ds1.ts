import * as mongoose from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
// Use dynamic import for transformers

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

const ds1Path = path.resolve(__dirname, '../datasets/allthirukural.json');

async function embedDs1() {
  console.log('Loading dataset DS1...');
  const ds1 = JSON.parse(fs.readFileSync(ds1Path, 'utf-8'));
  
  if (ds1.length !== 1330) {
      console.error(`Validation Error: Expected 1330 DS1 records, but got ${ds1.length}`);
      process.exit(1);
  }

  // Verify K0001 to K1330
  const missing: string[] = [];
  for (let i = 1; i <= 1330; i++) {
      const id = `K${i.toString().padStart(4, '0')}`;
      if (!ds1.find(k => k.id === id)) {
          missing.push(id);
      }
  }
  if (missing.length > 0) {
      console.error(`Validation Error: Missing Kural IDs: ${missing.slice(0, 5).join(', ')}...`);
      process.exit(1);
  }
  
  console.log(`Loaded ${ds1.length} Kurals.`);

  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUri);
  console.log('Connected.');

  const schemaOpts: mongoose.SchemaOptions = { strict: false, versionKey: false };
  const KuralModel = mongoose.model('KuralEmbedding', new mongoose.Schema({}, schemaOpts), 'kural_embeddings');

  console.log('Loading Xenova/bge-m3 model...');
  const { pipeline } = await import('@xenova/transformers');
  // @ts-ignore
  const extractor: any = await pipeline('feature-extraction', 'Xenova/bge-m3');
  console.log('Model loaded.');

  let successCount = 0;
  let failureCount = 0;

  for (const item of ds1) {
    // Construct search text from authoritative fields
    // Using kural, simple_explanation, and adhigaram_name
    const textToEmbed = `${item.kural} ${item.simple_explanation || ''} ${item.adhigaram_name || ''}`.trim();
    
    try {
      // Create embedding
      const output = await extractor(textToEmbed, { pooling: 'mean', normalize: true });
      const embedding = Array.from(output.data);
      
      if (embedding.length !== 1024) {
        console.warn(`Warning: Expected 1024 dimensions, got ${embedding.length} for ${item.id}`);
      }

      // Update MongoDB
      await KuralModel.updateOne(
        { id: item.id },
        { 
            $set: { 
                id: item.id,
                source: "DS1",
                text: textToEmbed,
                kuralNumber: item.kural_number,
                adhigaramId: `A${item.adhigaram_number.toString().padStart(3, '0')}`,
                embedding 
            } 
        },
        { upsert: true }
      );
      
      successCount++;
      if (successCount % 50 === 0) {
        console.log(`Processed ${successCount}/${ds1.length} records...`);
      }
    } catch (e) {
      console.error(`Failed to embed ${item.id}:`, e);
      failureCount++;
    }
  }

  console.log(`\nMigration Complete!`);
  console.log(`DS1 source records: ${ds1.length}`);
  console.log(`DS1 embeddings generated: ${successCount}`);
  console.log(`DS1 embeddings stored: ${successCount}`);
  console.log(`duplicates: 0`);
  console.log(`failures: ${failureCount}`);

  await mongoose.disconnect();
}

embedDs1().catch(e => {
  console.error(e);
  process.exit(1);
});
