import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../src/app.module';
import { KnowledgeService } from '../../src/modules/knowledge/knowledge.service';
import { SemanticRetrievalService } from '../../src/modules/knowledge/semantic/semantic.service';
import * as fs from 'fs';
import * as path from 'path';

async function runBenchmark() {
  console.log('Initializing application context...');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const knowledgeService = app.get(KnowledgeService);
  const semanticService = app.get(SemanticRetrievalService);

  const benchmarkPath = path.join(__dirname, 'ds2-semantic-benchmark.json');
  const queries = JSON.parse(fs.readFileSync(benchmarkPath, 'utf8'));

  const results: any[] = [];
  let correct = 0;
  let incorrect = 0;
  let unknownCorrect = 0;
  let falsePositives = 0;
  let falseNegatives = 0;
  
  let semanticQueriesCount = 0;
  let semanticCorrectTop1 = 0;
  
  // Patch SemanticRetrievalService to capture top-k
  let currentSemanticDiagnostics: any = null;
  let semanticCalled = false;
  const originalRetrieveAdhigaram = semanticService.retrieveAdhigaram.bind(semanticService);
  semanticService.retrieveAdhigaram = async (query: string) => {
    semanticCalled = true;
    const result = await originalRetrieveAdhigaram(query);
    currentSemanticDiagnostics = result?.diagnostics || null;
    return result;
  };
  
  console.log(`Running benchmark against ${queries.length} queries...`);

  for (const item of queries) {
    const q = item.query;
    console.log(`\nQuery: ${q}`);
    
    currentSemanticDiagnostics = null;
    semanticCalled = false;
    
    const response = await knowledgeService.query(q);
    const actual = response.answer.reference;
    
    let routing_path = 'UNKNOWN';
    if (semanticCalled) {
        routing_path = 'SEMANTIC';
        semanticQueriesCount++;
    } else if (actual && actual !== 'D001') {
        routing_path = 'DETERMINISTIC';
    }
    
    let result = '';
    const isExpectedUnknown = item.expected_reference === 'UNKNOWN' || item.expected_reference === 'D001';
    const isActualUnknown = actual === 'UNKNOWN' || actual === 'D001' || actual === null;

    if (isExpectedUnknown && isActualUnknown) {
      result = 'CORRECT_UNKNOWN';
      unknownCorrect++;
      correct++;
    } else if (isExpectedUnknown && !isActualUnknown) {
      result = 'FALSE_POSITIVE';
      falsePositives++;
      incorrect++;
    } else if (!isExpectedUnknown && isActualUnknown) {
      result = 'FALSE_NEGATIVE';
      falseNegatives++;
      incorrect++;
    } else if (actual === item.expected_reference) {
      result = 'CORRECT';
      correct++;
    } else {
      result = 'INCORRECT';
      incorrect++;
    }
    
    if (routing_path === 'SEMANTIC' && currentSemanticDiagnostics?.top1?.id === item.expected_reference) {
      semanticCorrectTop1++;
    }

    console.log(`Expected: ${item.expected_reference} | Actual: ${actual} | Result: ${result} | Route: ${routing_path}`);
    results.push({
      ...item,
      actual_reference: actual || 'D001',
      routing_path,
      result,
      top1: currentSemanticDiagnostics?.top1?.id || null,
      top2: currentSemanticDiagnostics?.top2?.id || null,
      top1_score: currentSemanticDiagnostics?.top1?.score || null,
      top2_score: currentSemanticDiagnostics?.top2?.score || null,
      margin: currentSemanticDiagnostics?.margin || null,
      accepted: currentSemanticDiagnostics?.accepted || false
    });
  }

  console.log('\n========================================');
  console.log('BENCHMARK SUMMARY');
  console.log('========================================');
  console.log(`Total queries: ${queries.length}`);
  console.log(`Correct: ${correct}`);
  console.log(`Incorrect: ${incorrect}`);
  console.log(`UNKNOWN correctly returned: ${unknownCorrect}`);
  console.log(`False positives: ${falsePositives}`);
  console.log(`False negatives: ${falseNegatives}`);
  console.log(`Accuracy: ${((correct / queries.length) * 100).toFixed(2)}%`);
  
  console.log('\nSEMANTIC SPECIFIC STATS');
  console.log(`Total Semantic Queries: ${semanticQueriesCount}`);
  if (semanticQueriesCount > 0) {
    console.log(`Semantic Top-1 Accuracy: ${((semanticCorrectTop1 / semanticQueriesCount) * 100).toFixed(2)}%`);
  }
  
  fs.writeFileSync(path.join(__dirname, 'ds2-semantic-results.json'), JSON.stringify(results, null, 2));
  await app.close();
}

runBenchmark().catch(console.error);
