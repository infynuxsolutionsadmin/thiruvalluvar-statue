import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

export enum RetrievalMode {
  VECTOR = 'VECTOR',
  BM25 = 'BM25',
  HYBRID = 'HYBRID'
}

export interface RetrievalResult {
  kuralId: string;
  score: number;
  vectorScore?: number;
  bm25Score?: number;
  rank: number;
}

@Injectable()
export class Ds1HybridRetriever implements OnModuleInit {
  private readonly logger = new Logger(Ds1HybridRetriever.name);
  private extractor: any;
  private readonly RRF_K = 60;

  constructor(
    @InjectModel('Kural') private readonly kuralModel: Model<any>,
  ) {}

  async onModuleInit() {
    this.logger.log('Loading Xenova/bge-m3 model (quantized) for Hybrid retrieval...');
    try {
      const { pipeline } = await import('@xenova/transformers');
      this.extractor = await pipeline('feature-extraction', 'Xenova/bge-m3', { quantized: true });
      this.logger.log('Xenova/bge-m3 model loaded successfully.');
    } catch (e: any) {
      this.logger.error('Failed to load semantic model: ' + (e.stack || e.message || e), e);
    }
  }

  getExtractor() {
    return this.extractor;
  }

  async retrieveCandidates(
    query: string,
    mode: RetrievalMode,
    vectorTopK: number = 20,
    bm25TopK: number = 20,
    hybridTopK: number = 5
  ): Promise<RetrievalResult[]> {
    if (!this.extractor) {
      this.logger.warn('Extractor not initialized. Skipping vector search.');
      return [];
    }

    let vectorCandidates: any[] = [];
    let bm25Candidates: any[] = [];

    // 1. Fetch Vector Candidates
    if (mode === RetrievalMode.VECTOR || mode === RetrievalMode.HYBRID) {
      const output = await this.extractor(query, { pooling: 'mean', normalize: true });
      const queryEmbedding = Array.from(output.data) as number[];
      
      vectorCandidates = await this.kuralModel.aggregate([
        {
          $vectorSearch: {
            index: 'kural_vector_index',
            path: 'embedding',
            queryVector: queryEmbedding,
            numCandidates: 100,
            limit: vectorTopK,
          }
        },
        {
          $project: {
            id: 1,
            score: { $meta: 'vectorSearchScore' }
          }
        }
      ]);
    }

    // 2. Fetch BM25 Candidates
    if (mode === RetrievalMode.BM25 || mode === RetrievalMode.HYBRID) {
      bm25Candidates = await this.kuralModel.aggregate([
        {
          $search: {
            index: 'kural_bm25_index',
            text: {
              query: query,
              path: 'text'
            }
          }
        },
        { $limit: bm25TopK },
        {
          $project: {
            id: 1,
            score: { $meta: 'searchScore' }
          }
        }
      ]);
    }

    // 3. Process and Return based on mode
    if (mode === RetrievalMode.VECTOR) {
      return vectorCandidates.map((c, idx) => ({
        kuralId: c.id,
        score: c.score,
        vectorScore: c.score,
        rank: idx + 1
      })).slice(0, vectorTopK);
    }

    if (mode === RetrievalMode.BM25) {
      return bm25Candidates.map((c, idx) => ({
        kuralId: c.id,
        score: c.score,
        bm25Score: c.score,
        rank: idx + 1
      })).slice(0, bm25TopK);
    }

    if (mode === RetrievalMode.HYBRID) {
      const scoreMap = new Map<string, { vectorRank: number; bm25Rank: number; vectorScore: number; bm25Score: number }>();
      
      vectorCandidates.forEach((c, idx) => {
        scoreMap.set(c.id, { vectorRank: idx + 1, bm25Rank: Infinity, vectorScore: c.score, bm25Score: 0 });
      });

      bm25Candidates.forEach((c, idx) => {
        const existing = scoreMap.get(c.id);
        if (existing) {
          existing.bm25Rank = idx + 1;
          existing.bm25Score = c.score;
        } else {
          scoreMap.set(c.id, { vectorRank: Infinity, bm25Rank: idx + 1, vectorScore: 0, bm25Score: c.score });
        }
      });

      const hybridCandidates = Array.from(scoreMap.entries()).map(([kuralId, data]) => {
        const rrfVector = data.vectorRank !== Infinity ? 1 / (this.RRF_K + data.vectorRank) : 0;
        const rrfBm25 = data.bm25Rank !== Infinity ? 1 / (this.RRF_K + data.bm25Rank) : 0;
        const rrfScore = rrfVector + rrfBm25;
        
        return {
          kuralId,
          score: rrfScore,
          vectorScore: data.vectorScore,
          bm25Score: data.bm25Score,
          rank: 0
        };
      });

      hybridCandidates.sort((a, b) => b.score - a.score);
      
      return hybridCandidates.map((c, idx) => ({
        ...c,
        rank: idx + 1
      })).slice(0, hybridTopK);
    }

    return [];
  }
}
