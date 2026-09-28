import { Module } from '@nestjs/common';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgeService } from './knowledge.service';
import { QueryParserService } from './parsers/query-parser.service';
import { Ds4ParserService } from './parsers/ds4.parser';
import { Ds1ResolverService } from './resolvers/ds1.resolver';
import { Ds2ResolverService } from './resolvers/ds2.resolver';
import { Ds3ResolverService } from './resolvers/ds3.resolver';
import { Ds7ResolverService } from './resolvers/ds7.resolver';
import { TopicResolverService } from './resolvers/topic.resolver';
import { SemanticRetrievalService } from './semantic/semantic.service';
import { MongooseModule } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';

import { Ds1HybridRetriever } from './retrievers/ds1-hybrid.retriever';
import { TamilConceptNormalizerService } from './semantic/tamil-concept-normalizer.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Adhigaram', schema: new mongoose.Schema({}, { strict: false, collection: 'adhigarams' }) },
      { name: 'Kural', schema: new mongoose.Schema({}, { strict: false, collection: 'kural_embeddings' }) }
    ])
  ],
  controllers: [KnowledgeController],
  providers: [
    KnowledgeService,
    QueryParserService,
    Ds4ParserService,
    Ds1ResolverService,
    Ds2ResolverService,
    Ds3ResolverService,
    Ds7ResolverService,
    TopicResolverService,
    SemanticRetrievalService,
    TamilConceptNormalizerService,
    Ds1HybridRetriever
  ],
  exports: [KnowledgeService, Ds1HybridRetriever],
})
export class KnowledgeModule {}

