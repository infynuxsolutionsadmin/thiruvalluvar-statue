import * as mongoose from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';

const envPath = path.resolve(__dirname, '../.env');
let mongoUri = '';
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const match = envContent.match(/MONGO_URI="(.*)"/);
  if (match && match[1]) mongoUri = match[1];
}

async function verify() {
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB for verification.');

  const KuralModel = mongoose.model('Kural', new mongoose.Schema({}, { strict: false }), 'kurals');
  const AdhigaramModel = mongoose.model('Adhigaram', new mongoose.Schema({}, { strict: false }), 'adhigarams');
  const BiographyModel = mongoose.model('Biography', new mongoose.Schema({}, { strict: false }), 'biographies');
  const FactModel = mongoose.model('Fact', new mongoose.Schema({}, { strict: false }), 'facts');

  const checkRecord = async (Model: any, id: string) => {
    const doc = await Model.findOne({ id }).lean();
    if (doc) {
      console.log(`Found ${Model.modelName} ${id}: OK`);
    } else {
      console.error(`Error: Missing ${Model.modelName} ${id}`);
    }
  }

  await checkRecord(KuralModel, 'K0001');
  await checkRecord(KuralModel, 'K0100');
  await checkRecord(KuralModel, 'K0101');
  await checkRecord(KuralModel, 'K1330');

  await checkRecord(AdhigaramModel, 'A001');
  await checkRecord(AdhigaramModel, 'A040');
  await checkRecord(AdhigaramModel, 'A079');
  await checkRecord(AdhigaramModel, 'A133');

  await checkRecord(BiographyModel, 'BIO001');

  await checkRecord(FactModel, 'F001');
  await checkRecord(FactModel, 'F002');
  await checkRecord(FactModel, 'F003');
  await checkRecord(FactModel, 'F004');

  await mongoose.disconnect();
}

verify().catch(console.error);
