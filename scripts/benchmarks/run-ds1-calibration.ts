import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../src/app.module';
import { Ds1HybridRetriever, RetrievalMode } from '../../src/modules/knowledge/retrievers/ds1-hybrid.retriever';
import { SemanticRetrievalService } from '../../src/modules/knowledge/semantic/semantic.service';
import * as fs from 'fs';
import * as path from 'path';

async function runCalibration() {
  console.log('Initializing application context...');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const hybridRetriever = app.get(Ds1HybridRetriever);
  const semanticService = app.get(SemanticRetrievalService);
  const kuralModel = (hybridRetriever as any).kuralModel;

  const benchmarkPath = path.join(__dirname, 'ds1-semantic-benchmark.json');
  const queries = JSON.parse(fs.readFileSync(benchmarkPath, 'utf8'));

  const results: any[] = [];

  for (const item of queries) {
    const q = item.query;
    const expected = item.expected_reference;

    if (expected === 'UNKNOWN' || expected === 'D001') {
      continue;
    }

    const hCands = await hybridRetriever.retrieveCandidates(q, RetrievalMode.HYBRID);
    const hTop5 = hCands.map((c: any) => c.kuralId).slice(0, 5);
    const inTop5 = hTop5.includes(expected);

    let finalKural: string | null = null;
    let accepted = false;
    let decisionReason = '';
    
    // keyword scores for all top 5
    const keywordScores: Record<string, number> = {};
    const queryTokens = (semanticService as any).tokenize(q);
    const candidateDocs = await kuralModel.find({ id: { $in: hTop5 } }).lean();
    for (const candId of hTop5) {
        const doc = candidateDocs.find((d: any) => d.id === candId);
        if (doc) {
            const candidateTokens = (semanticService as any).tokenize(doc.text || '');
            keywordScores[candId] = (semanticService as any).calculateLexicalScore(queryTokens, candidateTokens);
        } else {
            keywordScores[candId] = 0;
        }
    }

    if (hCands.length > 0) {
      const top1 = hCands[0];
      const top2 = hCands.length > 1 ? hCands[1] : null;
      
      if (top1.vectorScore! < 0.88) {
        decisionReason = 'BELOW_SIMILARITY_THRESHOLD';
      } else {
        const margin = top2 ? top1.vectorScore! - top2.vectorScore! : top1.vectorScore!;
        if (top2 && margin < 0.02) {
          let bestCandidate: any = null;
          let bestScore = -1;
          let secondBestScore = -1;
          for (const candId of hTop5) {
             const score = keywordScores[candId];
             if (score > bestScore) {
                secondBestScore = bestScore;
                bestScore = score;
                bestCandidate = candId;
             } else if (score > secondBestScore) {
                secondBestScore = score;
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

    let category = '';
    if (!inTop5) {
       category = 'Correct Kural absent from Top-5';
    } else if (accepted && finalKural === expected) {
       category = 'Correct + accepted';
    } else if (!accepted && inTop5) {
       category = 'Correct + rejected';
    } else if (accepted && finalKural !== expected) {
       category = 'Incorrect + accepted';
    } else {
       category = 'Incorrect + rejected';
    }

    const rrfMargin = hCands.length > 1 ? hCands[0].score - hCands[1].score : 0;

    results.push({
      query: q,
      expected,
      inTop5,
      category,
      finalKural,
      decisionReason,
      rrfMargin,
      candidates: hCands.slice(0, 5).map((c: any) => ({
        kuralId: c.kuralId,
        hybridRank: c.rank,
        rrfScore: c.score,
        vectorRank: c.vectorRank,
        vectorScore: c.vectorScore,
        bm25Rank: c.bm25Rank,
        bm25Score: c.bm25Score,
        keywordScore: keywordScores[c.kuralId] || 0,
        isExpected: c.kuralId === expected,
        isAccepted: finalKural === c.kuralId
      }))
    });
  }

  fs.writeFileSync(path.join(__dirname, 'ds1-calibration.json'), JSON.stringify(results, null, 2));

  // Generate markdown report
  let md = '# Phase 4.4 DS1 Hybrid Confidence Calibration\n\n';
  md += '| Query | Expected | Hybrid Rank | RRF | Vector | BM25 | Current | Proposed Evidence |\n';
  md += '|---|---|---:|---:|---:|---:|---|---|\n';

  for (const res of results) {
     for (const c of res.candidates) {
        // Only print if it's the expected candidate, OR if it was accepted (incorrectly or correctly), OR if it's the #1 candidate for context.
        if (c.isExpected || c.isAccepted || c.hybridRank === 1) {
            const currentDec = c.isAccepted ? 'ACCEPTED' : (res.finalKural ? 'REJECTED' : 'UNKNOWN');
            const proposed = ''; // Empty for now
            md += `| ${res.query.substring(0, 20)}... | ${c.kuralId}${c.isExpected ? ' (EXP)' : ''} | ${c.hybridRank} | ${c.rrfScore.toFixed(4)} | R:${c.vectorRank || '-'} S:${c.vectorScore?.toFixed(4) || '0.0000'} | R:${c.bm25Rank || '-'} S:${c.bm25Score?.toFixed(4) || '0.0000'} | ${currentDec} | ${proposed} |\n`;
        }
     }
  }

  fs.writeFileSync(path.join(__dirname, 'ds1-calibration.md'), md, 'utf8');

  console.log('Calibration run complete. Written to ds1-calibration.json and .md');
  await app.close();
}

runCalibration().catch(console.error);
