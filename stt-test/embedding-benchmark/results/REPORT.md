# Embedding Models Benchmark Report

**Number of benchmark questions:** 12
**Number of strictly scored questions:** 10

## Tamil-ai/tamil-embed-base
- **Dimensions**: 768
- **Load Time**: 17.90 s
- **Doc Embedding Time**: 261.39 s
- **Query Embedding Time**: 0.54 s
- **Top-1 Accuracy**: 40.00%
- **Top-3 Accuracy**: 60.00%
- **Top-5 Accuracy**: 80.00%
- **MRR**: 0.5400

### Representative Examples
**Question:** நல்ல நட்பு எப்படி இருக்க வேண்டும்?
**Expected:** A079
**Top 5:**
1. A079 (sim: 0.7098)
2. A080 (sim: 0.6758)
3. K0823 (sim: 0.6565)
4. K0789 (sim: 0.6530)
5. K0794 (sim: 0.6385)

**Question:** நல்ல நண்பனுடைய பண்புகள் என்ன?
**Expected:** A079
**Top 5:**
1. A079 (sim: 0.7283)
2. A081 (sim: 0.7061)
3. K0998 (sim: 0.6880)
4. K0789 (sim: 0.6734)
5. A080 (sim: 0.6661)

**Question:** நட்பு பற்றி திருவள்ளுவர் என்ன கூறுகிறார்?
**Expected:** A079
**Top 5:**
1. K0106 (sim: 0.6322)
2. K0998 (sim: 0.6255)
3. K0787 (sim: 0.6187)
4. A080 (sim: 0.6147)
5. A079 (sim: 0.6091)


---
## l3cube-pune/tamil-sentence-similarity-sbert
- **Dimensions**: 768
- **Load Time**: 7.90 s
- **Doc Embedding Time**: 211.39 s
- **Query Embedding Time**: 0.46 s
- **Top-1 Accuracy**: 10.00%
- **Top-3 Accuracy**: 50.00%
- **Top-5 Accuracy**: 60.00%
- **MRR**: 0.3033

### Representative Examples
**Question:** நல்ல நட்பு எப்படி இருக்க வேண்டும்?
**Expected:** A079
**Top 5:**
1. K0786 (sim: 0.7541)
2. K0801 (sim: 0.7199)
3. A079 (sim: 0.7137)
4. K0789 (sim: 0.7016)
5. K0800 (sim: 0.6902)

**Question:** நல்ல நண்பனுடைய பண்புகள் என்ன?
**Expected:** A079
**Top 5:**
1. K0786 (sim: 0.5751)
2. A079 (sim: 0.5449)
3. K0800 (sim: 0.5399)
4. K0802 (sim: 0.5380)
5. K0807 (sim: 0.5300)

**Question:** நட்பு பற்றி திருவள்ளுவர் என்ன கூறுகிறார்?
**Expected:** A079
**Top 5:**
1. K0106 (sim: 0.5990)
2. A079 (sim: 0.5951)
3. K0107 (sim: 0.5615)
4. K0802 (sim: 0.5584)
5. K0800 (sim: 0.5577)


---
## BAAI/bge-m3
- **Dimensions**: 1024
- **Load Time**: 11.28 s
- **Doc Embedding Time**: 721.62 s
- **Query Embedding Time**: 1.41 s
- **Top-1 Accuracy**: 60.00%
- **Top-3 Accuracy**: 90.00%
- **Top-5 Accuracy**: 90.00%
- **MRR**: 0.7333

### Representative Examples
**Question:** நல்ல நட்பு எப்படி இருக்க வேண்டும்?
**Expected:** A079
**Top 5:**
1. A079 (sim: 0.6695)
2. K0789 (sim: 0.6564)
3. K0786 (sim: 0.6505)
4. A080 (sim: 0.6504)
5. K0787 (sim: 0.6281)

**Question:** நல்ல நண்பனுடைய பண்புகள் என்ன?
**Expected:** A079
**Top 5:**
1. A079 (sim: 0.6216)
2. A080 (sim: 0.6187)
3. K0794 (sim: 0.6119)
4. K0111 (sim: 0.6074)
5. K0789 (sim: 0.6054)

**Question:** நட்பு பற்றி திருவள்ளுவர் என்ன கூறுகிறார்?
**Expected:** A079
**Top 5:**
1. K0789 (sim: 0.5942)
2. A079 (sim: 0.5869)
3. K0787 (sim: 0.5856)
4. K0798 (sim: 0.5836)
5. K0784 (sim: 0.5796)


---
