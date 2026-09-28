import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../src/app.module';
import { Ds1HybridRetriever, RetrievalMode } from '../../src/modules/knowledge/retrievers/ds1-hybrid.retriever';
import { SemanticRetrievalService } from '../../src/modules/knowledge/semantic/semantic.service';
import * as fs from 'fs';
import * as path from 'path';

async function runHybridBenchmark() {
  console.log('Initializing application context...');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const hybridRetriever = app.get(Ds1HybridRetriever);
  const semanticService = app.get(SemanticRetrievalService); // for tokenize and calculateLexicalScore

  const benchmarkPath = path.join(__dirname, 'ds1-semantic-benchmark.json');
  const queries = JSON.parse(fs.readFileSync(benchmarkPath, 'utf8'));

  const results: any[] = [];
  
  let vectorRecall = 0;
  let bm25Recall = 0;
  let hybridRecall = 0;
  let vectorTop1 = 0;
  let bm25Top1 = 0;
  let hybridTop1 = 0;
  
  // Safety metrics for Hybrid
  let correctUnknown = 0;
  let falsePositives = 0;
  let falseNegatives = 0;
  
  console.log(`Running hybrid benchmark against ${queries.length} queries...`);

  for (const item of queries) {
    const q = item.query;
    const expected = item.expected_reference;
    const isExpectedUnknown = expected === 'UNKNOWN' || expected === 'D001';

    // Measure VECTOR
    const vCands = await hybridRetriever.retrieveCandidates(q, RetrievalMode.VECTOR);
    const vTop5 = vCands.map(c => c.kuralId);
    const vRecall = !isExpectedUnknown && vTop5.includes(expected);
    if (vRecall) vectorRecall++;
    if (!isExpectedUnknown && vTop5[0] === expected) vectorTop1++;

    // Measure BM25
    const bCands = await hybridRetriever.retrieveCandidates(q, RetrievalMode.BM25);
    const bTop5 = bCands.map(c => c.kuralId);
    const bRecall = !isExpectedUnknown && bTop5.includes(expected);
    if (bRecall) bm25Recall++;
    if (!isExpectedUnknown && bTop5[0] === expected) bm25Top1++;

    // Measure HYBRID
    const hCands = await hybridRetriever.retrieveCandidates(q, RetrievalMode.HYBRID);
    const hTop5 = hCands.map(c => c.kuralId);
    const hRecall = !isExpectedUnknown && hTop5.includes(expected);
    if (hRecall) hybridRecall++;
    if (!isExpectedUnknown && hTop5[0] === expected) hybridTop1++;

    // Safety and Disambiguation (Simulating existing logic on Hybrid Top 5)
    let finalKural: string | null = null;
    let accepted = false;
    let decisionReason = '';

    if (hCands.length > 0) {
      const top1 = hCands[0];
      const top2 = hCands.length > 1 ? hCands[1] : null;
      
      // existing SIMILARITY_THRESHOLD is 0.88 for vectorScore
      if (top1.vectorScore! < 0.88) {
        decisionReason = 'BELOW_SIMILARITY_THRESHOLD';
      } else {
        // existing MARGIN_THRESHOLD is 0.02 on vectorScore
        // Note: For hybrid, we just check the vector margin between top1 and top2
        const margin = top2 ? top1.vectorScore! - top2.vectorScore! : top1.vectorScore!;
        
        if (top2 && margin < 0.02) {
          // Trigger Keyword Tie-Breaker
          const queryTokens = (semanticService as any).tokenize(q);
          let bestCandidate: any = null;
          let bestScore = -1;
          let secondBestScore = -1;
          
          // Get texts for candidates from DB for lexical scoring
          const kuralModel = (hybridRetriever as any).kuralModel;
          const candidateDocs = await kuralModel.find({ id: { $in: hTop5 } }).lean();
          
          for (const candId of hTop5) {
             const doc = candidateDocs.find((d: any) => d.id === candId);
             if (doc) {
                const candidateTokens = (semanticService as any).tokenize(doc.text || '');
                const score = (semanticService as any).calculateLexicalScore(queryTokens, candidateTokens);
                if (score > bestScore) {
                   secondBestScore = bestScore;
                   bestScore = score;
                   bestCandidate = candId;
                } else if (score > secondBestScore) {
                   secondBestScore = score;
                }
             }
          }
          
          const keywordMargin = bestScore - secondBestScore;
          if (bestCandidate && keywordMargin >= 0.05 && bestScore > 0) {
             finalKural = bestCandidate;
             accepted = true;
             decisionReason = 'VECTOR_CLOSE_KEYWORD_DISAMBIGUATION';
          } else {
             decisionReason = 'LEXICAL_EVIDENCE_INSUFFICIENT';
          }
        } else {
          finalKural = top1.kuralId;
          accepted = true;
          decisionReason = 'STRONG_MARGIN';
        }
      }
    }

    const isActualUnknown = finalKural === null;
    let result = '';
    
    // We only evaluate semantic queries here. 
    // Deterministic queries are excluded from this benchmark logic, but 
    // we process all 79 queries exactly as requested.
    if (isExpectedUnknown && isActualUnknown) {
      result = 'CORRECT_UNKNOWN';
      correctUnknown++;
    } else if (isExpectedUnknown && !isActualUnknown) {
      result = 'FALSE_POSITIVE';
      falsePositives++;
    } else if (!isExpectedUnknown && isActualUnknown) {
      result = 'FALSE_NEGATIVE';
      falseNegatives++;
    } else if (finalKural === expected) {
      result = 'CORRECT';
    } else {
      result = 'INCORRECT';
    }

    results.push({
      query: q,
      expectedKural: expected,
      vector: {
        top1: vTop5[0] || null,
        top5: vTop5,
        recallAt5: vRecall
      },
      bm25: {
        top1: bTop5[0] || null,
        top5: bTop5,
        recallAt5: bRecall
      },
      hybrid: {
        top1: hTop5[0] || null,
        top5: hTop5,
        recallAt5: hRecall,
        finalDecision: finalKural,
        decisionReason
      },
      result
    });
  }

  const validTargetQueries = queries.filter((q: any) => q.expected_reference !== 'UNKNOWN' && q.expected_reference !== 'D001').length;
  
  console.log('\n========================================');
  console.log('PHASE 4.2 HYBRID BENCHMARK SUMMARY');
  console.log('========================================');
  console.log(`Total Target Queries: ${validTargetQueries} (excluding UNKNOWN)`);
  console.log(`Vector Top-1: ${vectorTop1} (${((vectorTop1/validTargetQueries)*100).toFixed(2)}%)`);
  console.log(`Vector Recall@5: ${vectorRecall} (${((vectorRecall/validTargetQueries)*100).toFixed(2)}%)`);
  console.log(`BM25 Top-1: ${bm25Top1} (${((bm25Top1/validTargetQueries)*100).toFixed(2)}%)`);
  console.log(`BM25 Recall@5: ${bm25Recall} (${((bm25Recall/validTargetQueries)*100).toFixed(2)}%)`);
  console.log(`Hybrid Top-1 (Raw): ${hybridTop1} (${((hybridTop1/validTargetQueries)*100).toFixed(2)}%)`);
  console.log(`Hybrid Recall@5: ${hybridRecall} (${((hybridRecall/validTargetQueries)*100).toFixed(2)}%)`);
  console.log('----------------------------------------');
  console.log(`Correct UNKNOWN: ${correctUnknown}`);
  console.log(`Semantic False Positives: ${falsePositives}`); // Assuming all are semantic since we bypass deterministic routing
  console.log(`Semantic False Negatives: ${falseNegatives}`);
  
  fs.writeFileSync(path.join(__dirname, 'ds1-hybrid-results.json'), JSON.stringify(results, null, 2));
  await app.close();
}

runHybridBenchmark().catch(console.error);
