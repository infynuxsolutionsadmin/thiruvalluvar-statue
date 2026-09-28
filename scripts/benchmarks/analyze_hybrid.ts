import * as fs from 'fs';
import * as path from 'path';

const resultsPath = path.join(__dirname, 'ds1-hybrid-results.json');
const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));

console.log('--- RECOVERIES ---');
for (const r of results) {
  if (r.expectedKural !== 'UNKNOWN' && r.expectedKural !== 'D001') {
    const vectorMissed = !r.vector.recallAt5;
    const hybridFound = r.hybrid.recallAt5;
    if (vectorMissed && hybridFound) {
      console.log(`Query: ${r.query}`);
      console.log(`Expected: ${r.expectedKural}`);
      console.log(`Vector Top-5: ${r.vector.top5.join(', ')}`);
      console.log(`BM25 Top-5: ${r.bm25.top5.join(', ')}`);
      console.log(`Hybrid Top-5: ${r.hybrid.top5.join(', ')}`);
      console.log('---');
    }
  }
}

console.log('--- REGRESSIONS ---');
for (const r of results) {
  if (r.expectedKural !== 'UNKNOWN' && r.expectedKural !== 'D001') {
    const vectorFound = r.vector.recallAt5;
    const hybridMissed = !r.hybrid.recallAt5;
    if (vectorFound && hybridMissed) {
      console.log(`Query: ${r.query}`);
      console.log(`Expected: ${r.expectedKural}`);
      console.log(`Vector Top-5: ${r.vector.top5.join(', ')}`);
      console.log(`BM25 Top-5: ${r.bm25.top5.join(', ')}`);
      console.log(`Hybrid Top-5: ${r.hybrid.top5.join(', ')}`);
      console.log('---');
    }
  }
}
