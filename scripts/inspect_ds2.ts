import * as mongoose from 'mongoose';
import * as dotenv from 'dotenv';

dotenv.config();

async function inspect() {
  await mongoose.connect(process.env.MONGO_URI!);
  const AdhigaramModel = mongoose.model('Adhigaram', new mongoose.Schema({}, { strict: false, collection: 'adhigarams' }));
  
  const ids = ['A004', 'A005', 'A008', 'A079', 'A080', 'A099', 'A100', 'A131'];
  const docsList = await AdhigaramModel.find({ id: { $in: ids } }).lean().exec();

  for (const doc of docsList) {
    const d = doc as any;
    console.log(`\n=== ${d.id} ===`);
    console.log(`Name: ${d.adhigaram_name}`);
    console.log(`Short Desc: ${d.short_description}`);
    console.log(`Translation: ${d.translation || d.adhigaram_translation}`);
    console.log(`Group: ${d.iyal_name || d.iyal} / ${d.pal_name || d.pal}`);
    if (d.keywords) console.log(`Keywords: ${d.keywords.join(', ')}`);
  }
  
  await mongoose.disconnect();
}
inspect().catch(console.error);
