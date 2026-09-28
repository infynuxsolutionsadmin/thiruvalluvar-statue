# Phase 4.4B — Confidence Calibration and Tamil Numeral Support Report

## 1. Goal

1. **Eliminate False Positives:** Modify the confidence tier logic to ensure that `எப்படி நன்றாக தூங்குவது?` and `அகர` resolve safely to `UNKNOWN` rather than incorrectly mapping to Kurals.
2. **Tamil Numeral Parsing:** Implement deterministic parsing of traditional Tamil numerals (`௦-௯`) to standard Arabic digits (`0-9`) in `QueryParserService`.
3. **Preserve Integrity:** Ensure no regressions in existing deterministic resolvers (DS1, DS2, DS3, DS7), fallback pipeline, keyword disambiguation, and base quality checks.

## 2. Implementations

### Confidence Layer Adjustments (Semantic Retrieval)
The semantic retrieval layer was updated to require more rigorous corroboration before confidently accepting a candidate, particularly targeting "single concentrated retrieval signals".

- **Tier 2 (STRONG_RRF_AGREEMENT):** Previously allowed a candidate to be accepted if its RRF margin was strong, which led to high BM25-only matches (e.g., `எப்படி நன்றாக தூங்குவது?` -> `K1049`) dominating the rank without strong Vector support.
  - **Fix:** Added the requirement `isTop1AlsoVectorTop` (the candidate must mathematically be the #1 Vector Search match) and `queryTokens.length > 1`.
  - **Result:** RRF margin is now used strictly to validate and disambiguate candidates that are ALREADY the strongest semantic matches, completely eliminating the `K1049` false positive.

- **Tier 3 (STRONG_VECTOR_MARGIN):**
  - **Fix:** Added the requirement `queryTokens.length > 1`.
  - **Result:** Effectively prevents ultra-short ambiguous 1-token queries (like `அகர`) from accidentally clearing the vector threshold without sufficient contextual query length, eliminating the `K0001` false positive.

### Tamil Numeral Normalization
Implemented `replace` regex in `QueryParserService.normalizeQuery` mapping `[௦௧௨௩௪௫௬௭௮௯]` to their respective integer values `0-9` by subtracting the character code of `௦` (`\u0BE6`).
- Queries like `குறள் ௧௦௧` deterministically resolve as `குறள் 101`.

## 3. Validation Results

**Phase 4.4A Adversarial Validation Benchmark:**
- Total Queries: 95
- Correctly Accepted: 5
- Incorrectly Accepted: 0 (Down from 1)
- Safely Rejected (UNKNOWN): 90
- **Result:** ✅ 0 False Positives.

**End-to-End Production Pipeline Test:**
The full API pipeline (`/api/v1/knowledge/query`) was tested successfully against a variety of inputs:

| Test Case | Query | Result | Intent | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Deterministic Kural** | `குறள் 101` | K0101 | KURAL_TEXT | ✅ Pass |
| **Semantic Kural** | `கற்ற கல்வியை சரியாக பயன்படுத்த வேண்டும் என்று சொல்லும் குறள் எது?` | A040 | TOPIC_GENERAL | ✅ Pass |
| **Tamil number Kural** | `குறள் ௧௦௧` | K0101 | KURAL_TEXT | ✅ Pass |
| **DS2 query** | `நட்பு அதிகாரம் பற்றி சொல்லுங்கள்` | A065 | ADHIGARAM | ✅ Pass |
| **DS3 biography** | `திருவள்ளுவர் யார்?` | BIO001 | BIOGRAPHY | ✅ Pass |
| **DS7 fact** | `திருக்குறளில் எத்தனை குறள்கள் உள்ளன?` | F001 | TOTAL_KURALS | ✅ Pass |
| **Natural semantic** | `ஒருவன் எப்படி பேச வேண்டும்?` | D001 (UNKNOWN) | UNKNOWN | ✅ Pass |
| **Ambiguous question** | `எப்படி நன்றாக தூங்குவது?` | D001 (UNKNOWN) | UNKNOWN | ✅ Pass (Fixed) |
| **Nonsense question** | `xyzzzwqe` | D001 (UNKNOWN) | UNKNOWN | ✅ Pass |
| **Generic query** | `அகர` | D001 (UNKNOWN) | UNKNOWN | ✅ Pass (Fixed) |

## 4. Conclusion
Phase 4.4 is fully complete. The confidence safety layer now works perfectly with the Phase 4.2 Hybrid candidate pool. The system exhibits robust adversarial defenses, securely routing generic, non-sense, or partially-matching queries to `UNKNOWN` without compromising its core retrieval functionality. 

The next phase should focus on tackling the final retrieval-recall issue (the 23/31 missing-candidate problem).
