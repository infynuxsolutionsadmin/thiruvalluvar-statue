import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { FactRecord, KnowledgeAnswer, QueryIntent } from '../../../common/types/knowledge.types';

/**
 * DS7 Resolver — loads fixed facts and resolves by fact ID.
 * Values come from DS7; nothing is hardcoded in the engine.
 */
@Injectable()
export class Ds7ResolverService implements OnModuleInit {
  private readonly logger = new Logger(Ds7ResolverService.name);
  private readonly index = new Map<string, FactRecord>();

  private readonly ds7File = path.join(
    process.cwd(),
    'datasets',
    'DS7',
    'DS7_Facts.json',
  );

  onModuleInit() {
    const raw = fs.readFileSync(this.ds7File, 'utf8');
    const records: FactRecord[] = JSON.parse(raw);
    for (const r of records) {
      this.index.set(r.id, r);
    }
    this.logger.log(`DS7 loaded: ${records.length} Fact records`);
  }

  resolve(reference: string, intent: QueryIntent): KnowledgeAnswer {
    const record = this.index.get(reference);
    if (!record) {
      return {
        found: false,
        dataset: 'DS7',
        reference,
        intent,
        answer: null,
      };
    }
    return {
      found: true,
      dataset: 'DS7',
      reference,
      intent,
      answer: record.answer,
      record,
    };
  }

  getSize(): number {
    return this.index.size;
  }
}
