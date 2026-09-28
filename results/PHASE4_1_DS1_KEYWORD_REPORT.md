# Phase 4.1 — DS1 Keyword Tie-Breaker Report

## Baseline (Phase 4)

Phase 4 overall accuracy:
72.15% (57/79)

Phase 4 semantic Top-1 (Vector Search alone):
10.81%

## Phase 4.1 (Keyword Tie-Breaker)

Overall accuracy:
74.68% (59/79)

Semantic Top-1 (Vector search alone):
10.81%

Semantic Top-3:
(N/A - Not collected in benchmark script)

Semantic Top-5:
(N/A - Not collected in benchmark script)

Correct UNKNOWN:
100% (31/31)

False positives:
17

False negatives:
2 (Reduced from 4)

## Comparison

| Metric | Phase 4 | Phase 4.1 | Change |
|---|---:|---:|---:|
| Overall Accuracy | 72.15% | 74.68% | +2.53% |
| Semantic Top-1 | 10.81% | 10.81% | 0% |
| Correct UNKNOWN | 31 | 31 | 0 |
| False Positives | 17 | 17 | 0 |
| False Negatives | 4 | 2 | -2 |

## Successful Recoveries
The keyword tie-breaker successfully disambiguated two closely grouped semantic candidates. These were instances where BGE-M3 returned multiple Kurals with scores that were too close (violating the 0.02 margin safety rule), but the lexical evidence strongly favored the correct expected candidate.
- Recovery 1: `DS1SEM_A01` (ஒருவர் செய்த உதவியை மறக்காமல் இருப்பது பற்றி என்ன குறள்?) -> Correctly tied to `K0110` based on shared keyword roots.
- Recovery 2: `DS1SEM_B01` (ஒருவர் செய்த நன்மையை எப்போதும் நினைவில் வைத்திருக்க வேண்டும் என்று கூறும் குறள் எது?) -> Correctly tied to `K0108` based on lexical comparison.

## Dangerous Regressions
**None.** The implementation successfully avoided introducing any new false positives. Queries with weak lexical separation were safely rejected as `UNKNOWN`.

## Remaining Confusions
There are 2 remaining semantic false negatives and 17 false positives (the false positives are due to the deterministic router mapping generic queries like "broad topic 1" directly to Kural 1). The tie-breaker could not fix the 2 remaining false negatives because the true Kural was either not in the Top-5 returned by vector search, or there was simply no lexical overlap with the candidate text. 

## Keyword Tie-Breaker Behavior
The keyword tie-breaker operates transparently using simple stemming for common suffixes (like வுடன், ின், க்கு, ப், ை, ு, ம், ன்) and stopwords removal. It proved safe and effective for disambiguating closely clustered results without overriding strong vector matches or deterministic routes. 

## Safety Assessment
The benchmark shows no new false positives, which is strong evidence, but not a mathematical guarantee. By only kicking in when the vector score margin is `< 0.02`, and demanding a minimum `KEYWORD_MARGIN_THRESHOLD` of `0.05`, we avoid accidentally selecting a wrong Kural just because of a single generic word overlap.

The important result is:
- Vector only: 57/79
- Vector + keyword tie-breaker: 59/79
- Improvement: +2.53 percentage points
- False-negative recovery: 4 → 2
- New false positives: 0

## Recommendation
**PROCEED TO PHASE 4.2 — ATLAS HYBRID SEARCH**

The key limitation is now clear:

BGE-M3
  ↓
Top-5
  ↓
Correct Kural missing
  ↓
Keyword tie-breaker cannot recover it

So Phase 4.2 should specifically test whether BM25 + vector retrieval increases candidate recall before disambiguation.

For the next implementation, we should compare three candidate-generation methods on the same 79 queries:

- Vector only
- BM25 only
- Hybrid: BM25 + Vector

and measure Recall@5, not just final accuracy.

That will tell us whether Atlas Hybrid Search actually fixes the fundamental DS1 problem rather than merely changing the final ranking.
