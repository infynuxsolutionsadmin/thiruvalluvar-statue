import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../src/app.module';
import { Ds1HybridRetriever, RetrievalMode } from '../../src/modules/knowledge/retrievers/ds1-hybrid.retriever';
import { SemanticRetrievalService } from '../../src/modules/knowledge/semantic/semantic.service';
import * as fs from 'fs';
import * as path from 'path';

async function runConfidenceAnalysis() {
  console.log('Initializing application context...');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const hybridRetriever = app.get(Ds1HybridRetriever);
  const semanticService = app.get(SemanticRetrievalService);

  const benchmarkPath = path.join(__dirname, 'ds1-semantic-benchmark.json');
  const queries = JSON.parse(fs.readFileSync(benchmarkPath, 'utf8'));

  let correctAccepted: any[] = [];
  let correctRejected: any[] = [];
  let incorrectAccepted: any[] = [];
  let missingFromTop5: any[] = [];

  let candidateRecallAt5 = 0;
  let acceptedCorrectCount = 0;
  let rejectedCorrectCount = 0;
  let falseAcceptedCount = 0;
  let unknownDecisionsCount = 0;

  console.log(`Running confidence analysis...`);

  const kuralModel = (hybridRetriever as any).kuralModel;

  for (const item of queries) {
    const q = item.query;
    const expected = item.expected_reference;

    // We only analyze semantic target queries as requested
    if (expected === 'UNKNOWN' || expected === 'D001') {
      continue;
    }

    // Measure HYBRID
    const hCands = await hybridRetriever.retrieveCandidates(q, RetrievalMode.HYBRID);
    
    const hTop5 = hCands.map(c => c.kuralId).slice(0, 5);
    const inTop5 = hTop5.includes(expected);
    
    if (inTop5) {
      candidateRecallAt5++;
    }

    let finalKural: string | null = null;
    let accepted = false;
    let decisionReason = '';
    let keywordScore = 0;

    if (hCands.length > 0) {
      const top1 = hCands[0];
      const top2 = hCands.length > 1 ? hCands[1] : null;
      
      if (top1.vectorScore! < 0.88) {
        decisionReason = 'BELOW_SIMILARITY_THRESHOLD';
      } else {
        const margin = top2 ? top1.vectorScore! - top2.vectorScore! : top1.vectorScore!;
        
        if (top2 && margin < 0.02) {
          const queryTokens = (semanticService as any).tokenize(q);
          let bestCandidate: any = null;
          let bestScore = -1;
          let secondBestScore = -1;
          
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
             keywordScore = bestScore;
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

    if (!accepted) {
      unknownDecisionsCount++;
    }

    // Now categorize
    if (!inTop5) {
      missingFromTop5.push({ query: q, expectedKural: expected });
    } else {
      const expectedCand: any = hCands.find(c => c.kuralId === expected);
      const data: any = {
        query: q,
        expectedKural: expected,
        hybridRank: expectedCand.rank,
        rrfScore: expectedCand.score,
        vectorRank: expectedCand.vectorRank,
        vectorScore: expectedCand.vectorScore,
        bm25Rank: expectedCand.bm25Rank,
        bm25Score: expectedCand.bm25Score,
        keywordScore: keywordScore, // If tie breaker was triggered
        accepted: accepted,
        decisionReason: decisionReason,
        finalKural: finalKural
      };

      if (accepted && finalKural === expected) {
        correctAccepted.push(data);
        acceptedCorrectCount++;
      } else if (!accepted) {
        correctRejected.push(data);
        rejectedCorrectCount++;
      } else if (accepted && finalKural !== expected) {
        incorrectAccepted.push(data);
        falseAcceptedCount++;
      }
    }
  }

  console.log('\n=============================================');
  console.log('CORRECT CANDIDATE + ACCEPTED');
  console.log('=============================================');
  for (const d of correctAccepted as any[]) {
    console.log(`Expected: ${d.expectedKural}`);
    console.log(`Hybrid Rank: ${d.hybridRank} | RRF Score: ${d.rrfScore?.toFixed(4)}`);
    console.log(`Vector Rank: ${d.vectorRank} | Vector Score: ${d.vectorScore?.toFixed(4)}`);
    console.log(`BM25 Rank: ${d.bm25Rank} | BM25 Score: ${d.bm25Score?.toFixed(4)}`);
    console.log(`Keyword Score: ${d.keywordScore?.toFixed(2)}`);
    console.log(`Status: ACCEPTED (${d.decisionReason})`);
    console.log('---');
  }

  console.log('\n=============================================');
  console.log('CORRECT CANDIDATE + REJECTED');
  console.log('=============================================');
  for (const d of correctRejected as any[]) {
    console.log(`Expected: ${d.expectedKural}`);
    console.log(`Hybrid Rank: ${d.hybridRank} | RRF Score: ${d.rrfScore?.toFixed(4)}`);
    console.log(`Vector Rank: ${d.vectorRank} | Vector Score: ${d.vectorScore?.toFixed(4)}`);
    console.log(`BM25 Rank: ${d.bm25Rank} | BM25 Score: ${d.bm25Score?.toFixed(4)}`);
    console.log(`Keyword Score: ${d.keywordScore?.toFixed(2)}`);
    console.log(`Status: REJECTED (${d.decisionReason})`);
    console.log('---');
  }

  console.log('\n=============================================');
  console.log('INCORRECT CANDIDATE + ACCEPTED');
  console.log('=============================================');
  for (const d of incorrectAccepted as any[]) {
    console.log(`Expected: ${d.expectedKural} | Final Selected: ${d.finalKural}`);
    console.log(`Expected Candidate Stats:`);
    console.log(`  Hybrid Rank: ${d.hybridRank} | RRF Score: ${d.rrfScore?.toFixed(4)}`);
    console.log(`  Vector Rank: ${d.vectorRank} | Vector Score: ${d.vectorScore?.toFixed(4)}`);
    console.log(`  BM25 Rank: ${d.bm25Rank} | BM25 Score: ${d.bm25Score?.toFixed(4)}`);
    console.log(`Status: FALSE ACCEPT (${d.decisionReason})`);
    console.log('---');
  }

  console.log('\n=============================================');
  console.log('CORRECT KURAL ABSENT FROM TOP-5');
  console.log('=============================================');
  for (const d of missingFromTop5 as any[]) {
    console.log(`Expected: ${d.expectedKural}`);
  }

  console.log('\n=============================================');
  console.log('PHASE 4.3 CONFIDENCE ANALYSIS SUMMARY');
  console.log('=============================================');
  console.log(`Candidate Recall@5: ${candidateRecallAt5}`);
  console.log(`Accepted Correct Answers: ${acceptedCorrectCount}`);
  console.log(`Rejected Correct Candidates: ${rejectedCorrectCount}`);
  console.log(`False Accepted Answers: ${falseAcceptedCount}`);
  console.log(`UNKNOWN Decisions: ${unknownDecisionsCount}`);
  
  await app.close();
}

runConfidenceAnalysis().catch(console.error);
