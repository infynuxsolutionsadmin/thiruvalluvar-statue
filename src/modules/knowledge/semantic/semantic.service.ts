import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Ds1HybridRetriever, RetrievalMode } from '../retrievers/ds1-hybrid.retriever';

@Injectable()
export class SemanticRetrievalService implements OnModuleInit {
  private readonly logger = new Logger(SemanticRetrievalService.name);
  private readonly SIMILARITY_THRESHOLD = 0.88; // Minimum threshold
  private readonly MARGIN_THRESHOLD = 0.02; // Minimum margin to safely accept Top 1 over Top 2 if they are in a conflict group

  private readonly CONFLICT_GROUPS = [
    ['A079', 'A080'], // Friendship
    ['A008', 'A131'], // Love
    ['A004', 'A005'], // Virtue / Domestic life
    ['A099', 'A100']  // Character
  ];

  constructor(
    @InjectModel('Adhigaram') private readonly adhigaramModel: Model<any>,
    @InjectModel('Kural') private readonly kuralModel: Model<any>,
    private readonly hybridRetriever: Ds1HybridRetriever,
  ) { }

  private get extractor() {
    return this.hybridRetriever.getExtractor();
  }

  async onModuleInit() {
    // Reuses the single shared extractor from Ds1HybridRetriever to save RAM
    this.logger.log('SemanticRetrievalService ready (using shared bge-m3 extractor).');
  }

  async retrieveAdhigaram(query: string) {
    if (!this.extractor) {
      this.logger.error('Extractor not initialized');
      return { id: null, diagnostics: { top1: null, top2: null, margin: 0, accepted: false } };
    }

    const t0 = Date.now();

    // 1. Generate query embedding
    const output = await this.extractor(query, { pooling: 'mean', normalize: true });
    const queryEmbedding = Array.from(output.data) as number[];
    const tQueryEmbed = Date.now() - t0;

    // 2. Perform Vector Search on DS2 (adhigarams collection)
    const t1 = Date.now();
    const results = await this.adhigaramModel.aggregate([
      {
        $vectorSearch: {
          index: 'vector_index',
          path: 'embedding',
          queryVector: queryEmbedding,
          numCandidates: 100,
          limit: 5, // TOP-K
        }
      },
      {
        $project: {
          id: 1,
          adhigaram_name: 1,
          keywords: 1,
          score: { $meta: 'vectorSearchScore' }
        }
      }
    ]);
    const tVectorSearch = Date.now() - t1;

    const totalTime = Date.now() - t0;

    if (!results || results.length === 0) {
      this.logger.debug(`Semantic match failed: No results found for "${query}"`);
      return { id: null, diagnostics: { top1: null, top2: null, margin: 0, accepted: false } };
    }

    const top1 = results[0];
    const top2 = results.length > 1 ? results[1] : null;

    const top1Score = top1.score;
    const top2Score = top2 ? top2.score : 0;
    const margin = top2 ? top1Score - top2Score : top1Score;

    this.logger.debug(`Semantic Top 5 for "${query}":`);
    results.forEach((r, i) => this.logger.debug(`  ${i + 1}. ${r.id} (${r.score.toFixed(4)}) - ${r.adhigaram_name}`));

    const diagnostics = {
      top1: { id: top1.id, score: top1Score },
      top2: top2 ? { id: top2.id, score: top2Score } : null,
      margin,
      accepted: false
    };

    // Rule 1: Minimum similarity threshold
    if (top1Score < this.SIMILARITY_THRESHOLD) {
      this.logger.log(`Semantic match rejected: Top 1 Score ${top1Score.toFixed(4)} < ${this.SIMILARITY_THRESHOLD} for "${query}"`);
      return { id: null, diagnostics };
    }

    // Rule 2: Conflict Disambiguation
    if (top2 && margin < this.MARGIN_THRESHOLD) {
      this.logger.debug(`Tight margin detected (${margin.toFixed(4)} < ${this.MARGIN_THRESHOLD}). Attempting Keyword Tie-Breaker...`);

      const queryLower = query.toLowerCase();
      let top1ScoreIncrease = 0;
      let top2ScoreIncrease = 0;

      if (top1.keywords) {
        for (const kw of top1.keywords) {
          if (queryLower.includes(kw.toLowerCase())) top1ScoreIncrease++;
        }
      }

      if (top2.keywords) {
        for (const kw of top2.keywords) {
          if (queryLower.includes(kw.toLowerCase())) top2ScoreIncrease++;
        }
      }

      if (top1ScoreIncrease > top2ScoreIncrease) {
        this.logger.log(`Tie-Breaker won by Top 1 (${top1.id}) with +${top1ScoreIncrease} keyword matches.`);
      } else if (top2ScoreIncrease > top1ScoreIncrease) {
        this.logger.log(`Tie-Breaker won by Top 2 (${top2.id}) with +${top2ScoreIncrease} keyword matches. Swapping winner.`);
        diagnostics.accepted = true;
        diagnostics.margin = top2Score - top1Score; // negative margin conceptually
        return { id: top2.id, diagnostics };
      } else {
        // Still tied
        this.logger.log(`Semantic match rejected: Ambiguous Top 1 (${top1.id}) and Top 2 (${top2.id}) (Margin: ${margin.toFixed(4)}) for "${query}". Tie-breaker failed.`);
        return { id: null, diagnostics };
      }
    }

    // Rule 3: Safely Accept
    diagnostics.accepted = true;
    this.logger.debug(`Perf | Query Embed: ${tQueryEmbed}ms | Vector Search: ${tVectorSearch}ms | Total: ${totalTime}ms`);
    return { id: top1.id, diagnostics };
  }

  tokenize(text: string): string[] {
    // 1. remove punctuation and normalize
    let cleaned = text.replace(/[.,?;:'"!()]/g, ' ').toLowerCase();

    // 2. normalize ASR variations
    cleaned = cleaned.replace(/பத்தி/g, 'பற்றி');
    cleaned = cleaned.replace(/சொல்லுங்க(ள்)?/g, 'சொல்லு');
    cleaned = cleaned.replace(/நன்பன்/g, 'நண்பன்');

    // 3. split into tokens
    let tokens = cleaned.split(/\s+/).filter(t => t.length > 0);

    // 4. ignore stopwords
    const stopwords = new Set([
      'என்ன', 'எப்படி', 'ஏன்', 'எந்த', 'ஒரு', 'ஒருவர்', 'பற்றி', 'சொல்லு', 'சொல்லுங்கள்', 'கூறுகிறது', 'கூறுகிறார்', 'என்று', 'எது', 'யார்', 'எங்கே', 'எப்போது', 'என்றால்', 'விளக்கம்', 'பொருள்', 'பழமொழி', 'குறள்', 'திருக்குறள்'
    ]);

    tokens = tokens.filter(t => !stopwords.has(t));

    // 5. morphological normalization (conservative)
    tokens = tokens.map(t => {
      let root = t;
      if (root.endsWith('வுடன்')) root = root.slice(0, -4);
      if (root.endsWith('ின்')) root = root.slice(0, -2);
      if (root.endsWith('க்கு')) root = root.slice(0, -3);
      if (root.endsWith('ப்')) root = root.slice(0, -1);
      if (root.endsWith('ை')) root = root.slice(0, -1);
      if (root.endsWith('ு')) root = root.slice(0, -1);
      if (root.endsWith('ம்')) root = root.slice(0, -1);
      if (root.endsWith('ன்')) root = root.slice(0, -1);
      return root;
    });

    return Array.from(new Set(tokens)); // unique tokens
  }

  calculateLexicalScore(queryTokens: string[], candidateTokens: string[]): number {
    if (queryTokens.length === 0) return 0;

    let matchCount = 0;
    for (const qt of queryTokens) {
      if (candidateTokens.includes(qt)) {
        matchCount++;
      }
    }
    return matchCount / queryTokens.length; // normalized score 0.0 to 1.0
  }

  async retrieveKural(query: string) {
    const t0 = Date.now();
    const hCands = await this.hybridRetriever.retrieveCandidates(query, RetrievalMode.HYBRID);
    const totalTime = Date.now() - t0;

    const diagnostics: any = {
      top1: null,
      top2: null,
      margin: 0,
      accepted: false,
      decision_reason: 'NO_CANDIDATES'
    };

    if (!hCands || hCands.length === 0) {
      this.logger.debug(`Semantic match failed: No Hybrid candidates for "${query}"`);
      return { id: null, diagnostics };
    }

    const top5 = hCands.slice(0, 5);
    const top1 = top5[0];

    diagnostics.top1 = { id: top1.kuralId, score: top1.score, vectorScore: top1.vectorScore, bm25Score: top1.bm25Score };
    if (top5.length > 1) {
      diagnostics.top2 = { id: top5[1].kuralId, score: top5[1].score };
    }

    // 1. Calculate Vector Margin exactly using Top 2 valid vector scores
    const vecScores = top5.map(c => c.vectorScore || 0).sort((a, b) => b - a);
    const trueTop1Vec = vecScores[0] || 0;
    const trueTop2Vec = vecScores.length > 1 ? vecScores[1] : 0;
    const vecMargin = trueTop1Vec - trueTop2Vec;
    const isTop1AlsoVectorTop = (top1.vectorScore || 0) === trueTop1Vec;

    // 2. Base Quality check
    const hasBaseQuality = ((top1.vectorScore || 0) >= 0.88 || (top1.bm25Score || 0) >= 3.0);

    // 3. Keyword scoring
    const candidateDocs = await this.kuralModel.find({ id: { $in: top5.map(c => c.kuralId) } }).lean();
    const queryTokens = this.tokenize(query);

    let bestK = -1;
    let secK = -1;
    let bestKId: string | null = null;

    for (const cand of top5) {
      const doc = candidateDocs.find((d: any) => d.id === cand.kuralId);
      const kScore = doc ? this.calculateLexicalScore(queryTokens, this.tokenize(doc.text || '')) : 0;

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

    diagnostics.keyword_score_top1 = bestK;
    diagnostics.keyword_margin = keyMargin;
    diagnostics.rrf_margin = rrfMargin;
    diagnostics.vector_margin = vecMargin;

    let finalKural: string | null = null;

    // Tier 1: Keyword Disambiguation (needs > 1 query tokens to avoid single-word generic match)
    if (queryTokens.length > 1 && bestK > 0 && keyMargin >= 0.05) {
      finalKural = bestKId;
      diagnostics.accepted = true;
      diagnostics.decision_reason = 'KEYWORD_DISAMBIGUATION';
    }
    // Tier 2: Strong Rank Agreement (RRF)
    else if (hasBaseQuality && queryTokens.length > 1 && isTop1AlsoVectorTop && rrfMargin > 0.01) {
       finalKural = top1.kuralId;
       diagnostics.accepted = true;
       diagnostics.decision_reason = 'STRONG_RRF_AGREEMENT';
    } 
    // Tier 3: Strong Vector Margin (Legacy rule)
    else if (queryTokens.length > 1 && isTop1AlsoVectorTop && hasBaseQuality && trueTop1Vec >= 0.88 && vecMargin >= 0.02) {
       finalKural = top1.kuralId;
       diagnostics.accepted = true;
       diagnostics.decision_reason = 'STRONG_VECTOR_MARGIN';
    } else {
      diagnostics.decision_reason = 'INSUFFICIENT_CONFIDENCE';
    }

    if (finalKural) {
      this.logger.log(`DS1 Semantic match accepted: ${finalKural} via ${diagnostics.decision_reason}`);
    } else {
      this.logger.log(`DS1 Semantic match rejected. Insufficient confidence for "${query}".`);
    }

    return { id: finalKural, diagnostics };
  }
}
