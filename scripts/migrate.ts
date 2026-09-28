import * as mongoose from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';

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

const datasetsDir = path.resolve(__dirname, '../datasets');
const ds1Path = path.join(datasetsDir, 'allthirukural.json');
const ds2Path = path.join(datasetsDir, 'DS2', 'Adhigarams.json');
const ds3Path = path.join(datasetsDir, 'DS3', 'Biography.json');
const ds7Path = path.join(datasetsDir, 'DS7', 'DS7_Facts.json');

function validateDataset(name: string, data: any[], expectedCount: number, idPrefix: string) {
  if (data.length !== expectedCount) {
    console.error(`Validation Error: ${name} expects ${expectedCount} records, but found ${data.length}`);
    process.exit(1);
  }
  
  const ids = new Set();
  for (const item of data) {
    if (!item.id) {
      console.error(`Validation Error: ${name} record missing 'id'`);
      process.exit(1);
    }
    if (ids.has(item.id)) {
      console.error(`Validation Error: ${name} has duplicate id ${item.id}`);
      process.exit(1);
    }
    ids.add(item.id);
  }
}

async function migrate() {
  console.log('Loading datasets...');
  const ds1 = JSON.parse(fs.readFileSync(ds1Path, 'utf-8'));
  const ds2 = JSON.parse(fs.readFileSync(ds2Path, 'utf-8'));
  const ds3 = JSON.parse(fs.readFileSync(ds3Path, 'utf-8'));
  const ds7 = JSON.parse(fs.readFileSync(ds7Path, 'utf-8'));

  console.log('Validating datasets...');
  validateDataset('DS1', ds1, 1330, 'K');
  validateDataset('DS2', ds2, 133, 'A');
  validateDataset('DS3', ds3, 50, 'BIO');
  validateDataset('DS7', ds7, 4, 'F');
  
  console.log('Validation passed. Connecting to MongoDB...');
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB.');

  const schemaOpts: mongoose.SchemaOptions = { strict: false, versionKey: false };
  const KuralModel = mongoose.model('Kural', new mongoose.Schema({}, schemaOpts), 'kurals');
  const AdhigaramModel = mongoose.model('Adhigaram', new mongoose.Schema({}, schemaOpts), 'adhigarams');
  const BiographyModel = mongoose.model('Biography', new mongoose.Schema({}, schemaOpts), 'biographies');
  const FactModel = mongoose.model('Fact', new mongoose.Schema({}, schemaOpts), 'facts');

  // Create unique index on 'id'
  await KuralModel.collection.createIndex({ id: 1 }, { unique: true });
  await AdhigaramModel.collection.createIndex({ id: 1 }, { unique: true });
  await BiographyModel.collection.createIndex({ id: 1 }, { unique: true });
  await FactModel.collection.createIndex({ id: 1 }, { unique: true });

  const migrateCollection = async (Model: any, data: any[], datasetName: string) => {
    let inserted = 0;
    let updated = 0;
    for (const item of data) {
      const doc = { ...item, sourceDataset: datasetName };
      const res = await Model.updateOne({ id: item.id }, { $set: doc }, { upsert: true });
      if (res.upsertedCount > 0) inserted++;
      else if (res.modifiedCount > 0) updated++;
    }
    console.log(`${datasetName}: ${inserted} inserted, ${updated} updated, ${data.length - inserted - updated} skipped`);
  };

  await migrateCollection(KuralModel, ds1, 'DS1');
  await migrateCollection(AdhigaramModel, ds2, 'DS2');
  await migrateCollection(BiographyModel, ds3, 'DS3');
  await migrateCollection(FactModel, ds7, 'DS7');

  const kuralsCount = await KuralModel.countDocuments();
  const adhigaramsCount = await AdhigaramModel.countDocuments();
  const biopsiesCount = await BiographyModel.countDocuments();
  const factsCount = await FactModel.countDocuments();
  
  console.log(`\nFinal MongoDB Counts:`);
  console.log(`kurals: ${kuralsCount}`);
  console.log(`adhigarams: ${adhigaramsCount}`);
  console.log(`biographies: ${biopsiesCount}`);
  console.log(`facts: ${factsCount}`);

  await mongoose.disconnect();
  console.log('Disconnected from MongoDB.');
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
