import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../src/app.module';
import { KnowledgeService } from '../../src/modules/knowledge/knowledge.service';
import { TamilConceptNormalizerService } from '../../src/modules/knowledge/semantic/tamil-concept-normalizer.service';
import * as fs from 'fs';
import * as path from 'path';

async function bootstrap() {
  console.log('Initializing application context...');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const knowledgeService = app.get(KnowledgeService);
  const normalizer = app.get(TamilConceptNormalizerService);

  const benchmarkPath = path.join(__dirname, 'tamil-query-intent-benchmark.json');
  const queries = JSON.parse(fs.readFileSync(benchmarkPath, 'utf8'));

  console.log(`Running intent benchmark against ${queries.length} queries...\n`);

  let correctIntents = 0;
  let correctRefs = 0;
  let falsePositives = 0;
  let totalTime = 0;

  const results: any[] = [];

  for (const q of queries) {
    const t0 = Date.now();
    
    // Test normalizer intent
    const normalizedData = normalizer.normalize(q.query);
    const intent = normalizedData.intent;
    
    // Test full resolution
    const { parsed, answer } = await knowledgeService.query(q.query);
    
    const time = Date.now() - t0;
    totalTime += time;

    const intentMatch = intent === q.expectedIntent || (intent === 'ADHIGARAM_GENERAL' && q.expectedIntent === 'UNKNOWN');
    const refMatch = answer.reference === q.expectedRef || (q.expectedRef === 'UNKNOWN' && answer.dataset === 'UNKNOWN');

    if (intentMatch) correctIntents++;
    if (refMatch) correctRefs++;
    if (answer.dataset !== 'UNKNOWN' && q.expectedRef === 'UNKNOWN') falsePositives++;

    results.push({
      query: q.query,
      expectedIntent: q.expectedIntent,
      actualIntent: intent,
      expectedRef: q.expectedRef,
      actualRef: answer.reference,
      dataset: answer.dataset,
      time
    });

    console.log(`Query: ${q.query}`);
    console.log(`=> Intent Match: ${intentMatch ? 'PASS' : 'FAIL'} | Expected: ${q.expectedIntent}, Got: ${intent}`);
    console.log(`=> Ref Match: ${refMatch ? 'PASS' : 'FAIL'} | Expected: ${q.expectedRef}, Got: ${answer.reference} (${answer.dataset})`);
  }

  const intentAccuracy = (correctIntents / queries.length) * 100;
  const refAccuracy = (correctRefs / queries.length) * 100;
  const avgTime = totalTime / queries.length;

  console.log('\n========================================');
  console.log('TAMIL INTENT NORMALIZATION BENCHMARK SUMMARY');
  console.log('========================================');
  console.log(`Total queries: ${queries.length}`);
  console.log(`Intent Accuracy: ${intentAccuracy.toFixed(2)}%`);
  console.log(`Routing/Ref Accuracy: ${refAccuracy.toFixed(2)}%`);
  console.log(`False Positives: ${falsePositives}`);
  console.log(`Avg Latency: ${avgTime.toFixed(2)} ms`);
  console.log('========================================');

  fs.writeFileSync(
    path.join(__dirname, 'tamil-query-intent-results.json'),
    JSON.stringify(results, null, 2)
  );

  await app.close();
}

bootstrap().catch(err => {
  console.error(err);
  process.exit(1);
});
