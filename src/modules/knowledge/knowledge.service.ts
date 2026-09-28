import { Injectable } from '@nestjs/common';
import { QueryParserService } from './parsers/query-parser.service';
import { Ds1ResolverService } from './resolvers/ds1.resolver';
import { Ds2ResolverService } from './resolvers/ds2.resolver';
import { Ds3ResolverService } from './resolvers/ds3.resolver';
import { Ds7ResolverService } from './resolvers/ds7.resolver';
import { TopicResolverService } from './resolvers/topic.resolver';
import { SemanticRetrievalService } from './semantic/semantic.service';
import { TamilConceptNormalizerService } from './semantic/tamil-concept-normalizer.service';
import { KnowledgeAnswer, ParsedQuery } from '../../common/types/knowledge.types';
import { Logger } from '@nestjs/common';

/**
 * KnowledgeService orchestrates:
 *   1. Parse query (QueryParserService — deterministic explicit resolver)
 *   2. If explicit reference found → DS1/DS2/DS3/DS7 resolver
 *   3. If UNKNOWN (no explicit reference) → TopicResolverService
 *   4. Return KnowledgeAnswer
 *
 * The topic resolver NEVER runs before the deterministic resolver.
 */
@Injectable()
export class KnowledgeService {
  constructor(
    private readonly parser: QueryParserService,
    private readonly ds1: Ds1ResolverService,
    private readonly ds2: Ds2ResolverService,
    private readonly ds3: Ds3ResolverService,
    private readonly ds7: Ds7ResolverService,
    private readonly topic: TopicResolverService,
    private readonly semantic: SemanticRetrievalService,
    private readonly normalizer: TamilConceptNormalizerService,
  ) {}

  private readonly logger = new Logger(KnowledgeService.name);

  async query(rawQuery: string): Promise<{ parsed: ParsedQuery; answer: KnowledgeAnswer }> {
    const parsed = this.parser.parse(rawQuery);
    let answer: KnowledgeAnswer;

    // Normalization phase for Semantic Retrieval
    const normalizedData = this.normalizer.normalize(rawQuery);
    const retrievalQuery = this.normalizer.buildRetrievalQuery(normalizedData);
    
    if (normalizedData.concepts.length > 0 || normalizedData.broadTerms.length > 0) {
       this.logger.debug(`Original query: ${normalizedData.originalQuery}`);
       this.logger.debug(`Normalized concepts: ${normalizedData.concepts.join(', ')}`);
       this.logger.debug(`Broad terms: ${normalizedData.broadTerms.join(', ')}`);
       this.logger.debug(`Retrieval query: ${retrievalQuery}`);
    }

    switch (parsed.dataset) {
      case 'DS1':
        answer = this.ds1.resolve(parsed.reference!, parsed.intent);
        if (!answer.found) {
            const result = await this.semantic.retrieveKural(retrievalQuery);
            if (result && result.id) {
                // If it fell back from deterministic DS1, keep the intent parsed from the query
                // but just check if it defaults to something we can improve. 
                // The intent is already parsed from `parsed.intent`.
                answer = this.ds1.resolve(result.id, parsed.intent);
                answer.intent = parsed.intent; // it should be EXPLICIT_KURAL or MEANING etc.
            }
        }
        break;

      case 'DS2':
        answer = this.ds2.resolve(parsed.reference, parsed.normalizedQuery);
        // Fallback to Semantic retrieval if reference was not resolved deterministically!
        if (!answer.found && (parsed.intent === 'ADHIGARAM' || parsed.intent === 'TOPIC_ADHIGARAM')) {
          const result = await this.semantic.retrieveAdhigaram(retrievalQuery);
          if (result && result.id) {
             answer = this.ds2.resolve(result.id, parsed.normalizedQuery);
          }
        }
        break;

      case 'DS3':
        answer = this.ds3.resolve(parsed.reference);
        break;

      case 'DS7':
        answer = this.ds7.resolve(parsed.reference!, parsed.intent);
        break;

      case 'UNKNOWN':
        // Check for specific intents to prioritize DS1 over Topic
        if (normalizedData.intent === 'KURAL_SPECIFIC' || normalizedData.intent === 'KURAL_GENERAL') {
           const kuralResult = await this.semantic.retrieveKural(retrievalQuery);
           if (kuralResult && kuralResult.id) {
              const explicitIntent = this.parser.detectKuralIntent(rawQuery);
              answer = this.ds1.resolve(kuralResult.id, explicitIntent);
              answer.intent = explicitIntent;
              break;
           }
        }
        
        // Try topic resolver with the normalized query minus broad words
        let topicQuery = parsed.normalizedQuery;
        normalizedData.broadTerms.forEach(bt => {
            // Replace full words only (custom boundary for Tamil)
            const regex = new RegExp(`(^|\\s)${bt}(?=\\s|$)`, 'g');
            topicQuery = topicQuery.replace(regex, '').replace(/\s+/g, ' ').trim();
        });
        
        // Sometimes removing broad words leaves the query empty, in that case use original
        if (!topicQuery) {
            topicQuery = parsed.normalizedQuery;
        }

        answer = this.topic.resolve(topicQuery);
        
        // Fallback to Semantic retrieval if topic resolver fails
        if (!answer.found) {
           const result = await this.semantic.retrieveAdhigaram(retrievalQuery);
           if (result && result.id) {
              answer = this.ds2.resolve(result.id, parsed.normalizedQuery);
              answer.intent = 'TOPIC_ADHIGARAM';
           } else {
              // Final fallback to Kural semantic search if not tried yet and not explicitly asking for Adhigaram
              if (normalizedData.intent !== 'KURAL_SPECIFIC' && normalizedData.intent !== 'KURAL_GENERAL' && normalizedData.intent !== 'ADHIGARAM_SPECIFIC') {
                 const kuralResult = await this.semantic.retrieveKural(retrievalQuery);
                 if (kuralResult && kuralResult.id) {
                    let semanticIntent = this.parser.detectKuralIntent(rawQuery);
                    // For generic questions without explicit kural-intent words, 
                    // return both the Kural and its explanation.
                    if (semanticIntent === 'KURAL_TEXT') {
                       semanticIntent = 'KURAL_AND_EXPLANATION';
                    }
                    answer = this.ds1.resolve(kuralResult.id, semanticIntent);
                    answer.intent = semanticIntent;
                 }
              }
           }
        }
        break;

      default:
        answer = {
          found: false,
          dataset: 'UNKNOWN',
          reference: 'D001',
          intent: 'UNKNOWN',
          answer: null,
        };
    }

    return { parsed, answer };
  }
}
