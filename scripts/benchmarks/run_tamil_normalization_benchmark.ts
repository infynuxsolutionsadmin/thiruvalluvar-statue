import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../src/app.module';
import { KnowledgeService } from '../../src/modules/knowledge/knowledge.service';
import { SemanticRetrievalService } from '../../src/modules/knowledge/semantic/semantic.service';
import { TamilConceptNormalizerService } from '../../src/modules/knowledge/semantic/tamil-concept-normalizer.service';
import * as fs from 'fs';
import * as path from 'path';

async function runBenchmark() {
  console.log('Initializing application context...');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const knowledgeService = app.get(KnowledgeService);
  const semanticService = app.get(SemanticRetrievalService);
  const normalizer = app.get(TamilConceptNormalizerService);

  const benchmarkPath = path.join(__dirname, 'tamil-query-normalization-benchmark.json');
  const queries = JSON.parse(fs.readFileSync(benchmarkPath, 'utf8'));

  const results: any[] = [];
  let correct = 0;
  let incorrect = 0;
  let unknownSafe = 0;
  
  let ds1ValidCount = 0;
  let ds2ValidCount = 0;
  let ds1Correct = 0;
  let ds2Correct = 0;
  
  let totalTimeMs = 0;

  // Patch to capture recall
  let top5RecallCandidates: string[] = [];
  const originalRetrieveKural = semanticService.retrieveKural.bind(semanticService);
  semanticService.retrieveKural = async (query: string) => {
    const result = await originalRetrieveKural(query);
    if (result && result.diagnostics && result.diagnostics.top5) {
       top5RecallCandidates = result.diagnostics.top5.map((c: any) => c.id);
    }
    return result;
  };
  
  const originalRetrieveAdhigaram = semanticService.retrieveAdhigaram.bind(semanticService);
  semanticService.retrieveAdhigaram = async (query: string) => {
    const result = await originalRetrieveAdhigaram(query);
    if (result && result.diagnostics && result.diagnostics.top5) {
       top5RecallCandidates = result.diagnostics.top5.map((c: any) => c.id);
    }
    return result;
  };

  console.log(`Running benchmark against ${queries.length} queries...\n`);

  for (const item of queries) {
    const q = item.query;
    console.log(`Query: ${q}`);
    
    top5RecallCandidates = [];
    const normalizedData = normalizer.normalize(q);
    
    const startTime = Date.now();
    const response = await knowledgeService.query(q);
    const latency = Date.now() - startTime;
    totalTimeMs += latency;
    
    const actualRef = response.answer.reference;
    const actualDataset = response.answer.dataset;
    const actualIntent = response.answer.intent;
    
    let isCorrect = false;
    let reason = '';
    
    if (item.expectedAction === 'UNKNOWN') {
      if (actualDataset === 'UNKNOWN') {
        isCorrect = true;
        unknownSafe++;
      } else {
        reason = `Expected UNKNOWN but got ${actualRef} (${actualDataset})`;
      }
    } else if (item.expectedAction === 'UNKNOWN_OR_VALID_KURAL') {
       if (actualDataset === 'UNKNOWN') {
         isCorrect = true;
         unknownSafe++;
       } else if (item.avoid && item.avoid.includes(actualRef)) {
         reason = `Hit avoid list: ${actualRef}`;
       } else {
         isCorrect = true; // Any valid Kural that is not avoided
       }
    } else if (item.expectedAction === 'VALID_DS1') {
       ds1ValidCount++;
       if (actualDataset === 'DS1' && actualRef === item.expectedReference) {
          if (item.expectedIntent && actualIntent !== item.expectedIntent) {
            reason = `DS1 Reference correct but intent wrong: expected ${item.expectedIntent}, got ${actualIntent}`;
          } else {
            isCorrect = true;
            ds1Correct++;
          }
       } else {
          reason = `Expected DS1 ${item.expectedReference} but got ${actualDataset} ${actualRef}`;
       }
    } else if (item.expectedAction === 'VALID_DS2') {
       ds2ValidCount++;
       if (actualDataset === 'DS2' && actualRef === item.expectedReference) {
          isCorrect = true;
          ds2Correct++;
       } else {
          reason = `Expected DS2 ${item.expectedReference} but got ${actualDataset} ${actualRef}`;
       }
    }
    
    if (isCorrect) correct++;
    else incorrect++;

    console.log(`=> Result: ${isCorrect ? 'PASS' : 'FAIL'} | Ref: ${actualRef} | Intent: ${actualIntent} ${reason ? `| ${reason}` : ''}`);
    
    results.push({
      ...item,
      normalizedData,
      latency,
      actualRef,
      actualDataset,
      actualIntent,
      isCorrect,
      reason,
      top5RecallCandidates
    });
  }

  const avgLatency = (totalTimeMs / queries.length).toFixed(2);
  const accuracy = ((correct / queries.length) * 100).toFixed(2);
  
  // Calculate Recall@5 for queries where we expect a specific Kural or Adhigaram
  let recallAt5Count = 0;
  let recallAt5Hits = 0;
  for (const res of results) {
     if (res.expectedReference) {
        recallAt5Count++;
        if (res.top5RecallCandidates.includes(res.expectedReference) || res.actualRef === res.expectedReference) {
           recallAt5Hits++;
        }
     }
  }

  console.log('\n========================================');
  console.log('TAMIL NORMALIZATION BENCHMARK SUMMARY');
  console.log('========================================');
  console.log(`Total queries: ${queries.length}`);
  console.log(`Correct behavior: ${correct}`);
  console.log(`Incorrect behavior: ${incorrect}`);
  console.log(`UNKNOWN gracefully safe: ${unknownSafe}`);
  console.log(`DS1 Exact Match Routing: ${ds1Correct}/${ds1ValidCount}`);
  console.log(`DS2 Exact Match Routing: ${ds2Correct}/${ds2ValidCount}`);
  console.log(`Avg Latency: ${avgLatency} ms`);
  console.log(`Overall Accuracy: ${accuracy}%`);
  
  if (recallAt5Count > 0) {
      console.log(`Specific Reference Recall@5: ${((recallAt5Hits / recallAt5Count) * 100).toFixed(2)}%`);
  }
  
  fs.writeFileSync(path.join(__dirname, 'tamil-query-normalization-results.json'), JSON.stringify(results, null, 2));
  await app.close();
}

runBenchmark().catch(console.error);
