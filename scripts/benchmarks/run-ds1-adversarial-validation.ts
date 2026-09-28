import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../src/app.module';
import { Ds1HybridRetriever, RetrievalMode } from '../../src/modules/knowledge/retrievers/ds1-hybrid.retriever';
import { SemanticRetrievalService } from '../../src/modules/knowledge/semantic/semantic.service';
import * as fs from 'fs';
import * as path from 'path';

async function runAdversarialValidation() {
   console.log('Initializing application context...');
   const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
   const hybridRetriever = app.get(Ds1HybridRetriever);
   const semanticService = app.get(SemanticRetrievalService);
   const kuralModel = (hybridRetriever as any).kuralModel;

   const benchmarkPath = path.join(__dirname, 'ds1-semantic-benchmark.json');
   const advPath = path.join(__dirname, 'ds1-adversarial-benchmark.json');

   const standardQueries = JSON.parse(fs.readFileSync(benchmarkPath, 'utf8'));
   const advQueries = JSON.parse(fs.readFileSync(advPath, 'utf8'));

   const allQueries = [...standardQueries, ...advQueries];

   let correctAccepts = 0;
   let incorrectAccepts = 0;
   let unknowns = 0;

   for (const item of allQueries) {
      const q = item.query;
      const expected = item.expected_reference === 'D001' ? 'UNKNOWN' : item.expected_reference;

      const hCands = await hybridRetriever.retrieveCandidates(q, RetrievalMode.HYBRID);

      let finalKural: string | null = null;
      let accepted = false;
      let decisionReason = '';

      if (hCands.length > 0) {
         const top5 = hCands.slice(0, 5);
         const top1 = top5[0];

         // CORRECT VEC MARGIN: Find top 2 valid vector scores in the Hybrid Top 5
         const vecScores = top5.map(c => c.vectorScore || 0).sort((a, b) => b - a);
         const trueTop1Vec = vecScores[0] || 0;
         const trueTop2Vec = vecScores.length > 1 ? vecScores[1] : 0;
         const vecMargin = trueTop1Vec - trueTop2Vec;

         // Because we sort by Vector to find margin, we also need to know if our top1 hybrid candidate is the one that has the top vector score.
         const isTop1AlsoVectorTop = (top1.vectorScore || 0) === trueTop1Vec;

         // Base quality for any decision
         const hasBaseQuality = (top1.vectorScore! >= 0.88 || top1.bm25Score! >= 3.0);

         // Keyword evaluations
         let bestK = -1;
         let secK = -1;
         let bestKId: string | null = null;

         const candidateDocs = await kuralModel.find({ id: { $in: top5.map(c => c.kuralId) } }).lean();
         const queryTokens = (semanticService as any).tokenize(q);

         for (const cand of top5) {
            const doc = candidateDocs.find((d: any) => d.id === cand.kuralId);
            const kScore = doc ? (semanticService as any).calculateLexicalScore(queryTokens, (semanticService as any).tokenize(doc.text || '')) : 0;
            (cand as any).keywordScore = kScore;

            if (kScore > bestK) {
               secK = bestK;
               bestK = kScore;
               bestKId = cand.kuralId;
            } else if (kScore > secK) {
               secK = kScore;
            }
         }

         const rrfMargin = top5.length > 1 ? top1.score - top5[1].score : top1.score;
         const keyMargin = bestK - secK;

         // 1. Keyword Disambiguation
         // Require query length > 1 to avoid single-word adversarial triggers
         if (queryTokens.length > 1 && bestK > 0 && keyMargin >= 0.05) {
            accepted = true;
            finalKural = bestKId;
            decisionReason = 'KEYWORD_DISAMBIGUATION';
         }
         // 2. Rank Agreement (RRF)
         else if (hasBaseQuality && queryTokens.length > 1 && isTop1AlsoVectorTop && rrfMargin > 0.01) {
            accepted = true;
            finalKural = top1.kuralId;
            decisionReason = 'STRONG_RRF_AGREEMENT';
         }
         // 3. Strong Vector Margin
         else if (queryTokens.length > 1 && isTop1AlsoVectorTop && hasBaseQuality && trueTop1Vec >= 0.88 && vecMargin >= 0.02) {
            accepted = true;
            finalKural = top1.kuralId;
            decisionReason = 'STRONG_VECTOR_MARGIN';
         }
      }

      if (accepted && finalKural !== null) {
         if (expected !== 'UNKNOWN' && finalKural === expected) {
            correctAccepts++;
         } else {
            incorrectAccepts++;
            console.log(`\n[FALSE POSITIVE]`);
            console.log(`Query: ${q}`);
            console.log(`Expected: ${expected} | Accepted: ${finalKural} | Reason: ${decisionReason}`);
            console.log(`Candidates:`);
            for (const c of hCands.slice(0, 3)) {
               console.log(`- ${c.kuralId} | RRF: ${c.score.toFixed(4)} | Vec: ${c.vectorScore?.toFixed(4)} | BM25: ${c.bm25Score?.toFixed(4)} | Key: ${(c as any).keywordScore}`);
            }
         }
      } else {
         unknowns++;
      }
   }

   console.log('\n=============================================');
   console.log('PHASE 4.4A ADVERSARIAL VALIDATION SUMMARY');
   console.log('=============================================');
   console.log(`Total Queries: ${allQueries.length}`);
   console.log(`Correctly Accepted: ${correctAccepts}`);
   console.log(`Incorrectly Accepted: ${incorrectAccepts}`);
   console.log(`Safely Rejected (UNKNOWN): ${unknowns}`);

   if (incorrectAccepts === 0) {
      console.log('\n✅ Validation Passed! Zero false positives observed across standard and adversarial queries.');
   } else {
      console.log('\n❌ Validation Failed! False positives detected.');
   }

   await app.close();
}

runAdversarialValidation().catch(console.error);
