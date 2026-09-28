# Phase 4 DS1 Semantic Retrieval Benchmark Report

## 1. Implementation Overview
- **Dataset:** DS1 (1330 Kurals)
- **Embedding Source:** `kural` + `simple_explanation` + `adhigaram_name`
- **Model:** `Xenova/bge-m3` (Local ONNX)
- **Vector DB:** MongoDB Atlas Vector Search (`kural_embeddings` collection, `kural_vector_index`)
- **Dimensions:** 1024
- **Similarity Metric:** Cosine

## 2. Integration Architecture
DS1 semantic retrieval was integrated as a fallback in the `UNKNOWN` query resolution path, ensuring it never overrides deterministic routing.

1. **Routing:** If a query fails deterministic routing (resolves to UNKNOWN), we attempt DS1 semantic retrieval (if "குறள்" is explicitly mentioned in the query) or prioritize DS2 semantic retrieval and fallback to DS1.
2. **Retrieval Service:** Uses Vector Search on `kural_embeddings` with `SIMILARITY_THRESHOLD = 0.88` and `MARGIN_THRESHOLD = 0.02`.
3. **Safety Mechanism:** Rejects ambiguous matches where top 2 candidate scores are too close (`< 0.02` margin). If a valid ID is found, it is securely delegated to `Ds1ResolverService` to guarantee authoritative response schemas and prevent hallucinations.

## 3. Benchmark Results
A benchmark of 79 queries (including variations, negations, exact numbers, and semantic queries) was evaluated.

- **Total Queries:** 79
- **Overall System Accuracy:** 72.15% (57/79 Correct)
- **False Positives:** 17
- **False Negatives:** 4
- **UNKNOWN Correctly Handled:** 31
- **Semantic-Specific Accuracy:** 10.81%

## 4. Diagnostics & Failure Analysis
### Low Semantic Top-1 Accuracy
The Semantic Top-1 Accuracy was very low (10.81%). This is due to the fundamental nature of Kurals:
- **High Density of Similarity:** Many Kurals express slightly different facets of the same overarching virtue (e.g., gratitude, love, education). BGE-M3 often produces highly clustered scores for these.
- **Margin Threshold Rejections:** The strict `MARGIN_THRESHOLD (0.02)` correctly triggers rejections when the Top-1 and Top-2 Kurals are extremely close in semantic distance. Since DS1 has 1330 dense records, margin collisions occur much more frequently than they did for DS2 (133 records).
- **No Keyword Tie-Breaker (Yet):** Unlike the DS2 implementation which falls back to keyword overlaps to break ties, the DS1 fallback does not yet utilize a robust tie-breaker mechanism.

### False Positives
The high number of false positives (17) is largely attributed to deterministic routing overlapping with generic numbers (like "broad topic 1", mapping to Kural 1).

## 5. Recommendation: Recalibrate & Improve
Given the current performance, we must **Recalibrate** before proceeding to production. A strict semantic fallback for individual Kurals is too ambiguous with generic embeddings like BGE-M3.

**Next Steps for Improvement:**
1. **Implement Keyword Tie-Breakers for DS1:** When semantic margin is too close, calculate keyword intersection (using `keywords` array in DS1) to confidently pick the most relevant Kural.
2. **Dynamic Margin Thresholds:** Consider lowering the margin threshold specifically for DS1 (e.g., `0.01`), or returning a group of Kurals if they belong to the same Adhigaram.
3. **Hybrid Search (BM25 + Vector):** Pure semantic search struggles with exact phrasing (like "கற்க கசடற"). MongoDB Atlas supports Hybrid Search combining Atlas Search (Lexical) with Vector Search. This would dramatically increase precision for DS1.

The DS1 semantic pipeline is fully functional and safe (never corrupts deterministic logic or introduces hallucinations), but requires tuning to be truly effective.
