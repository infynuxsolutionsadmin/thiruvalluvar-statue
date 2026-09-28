import * as mongoose from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';

const envPath = path.resolve('./.env');
const match = fs.readFileSync(envPath, 'utf8').match(/MONGO_URI="(.*)"/);
if (!match) process.exit(1);

mongoose.connect(match[1]).then(async () => {
    const db = mongoose.connection.db;
    if (!db) process.exit(1);
    try {
        await db.command({
            createSearchIndexes: 'kural_embeddings',
            indexes: [{
                name: 'kural_vector_index',
                type: 'vectorSearch',
                definition: {
                    fields: [{
                        type: 'vector',
                        path: 'embedding',
                        numDimensions: 1024,
                        similarity: 'cosine'
                    }]
                }
            }]
        });
        console.log('Index created!');
    } catch (e) {
        console.error('Error creating index:', e);
    }
    process.exit(0);
});
