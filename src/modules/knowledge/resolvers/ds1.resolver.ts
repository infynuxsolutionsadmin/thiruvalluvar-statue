import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { KuralRecord, KnowledgeAnswer, QueryIntent } from '../../../common/types/knowledge.types';

/**
 * DS1 Resolver — loads all 1330 Kural records at startup and serves
 * them by Kural ID.  No DB, no HTTP, no external calls.
 */
@Injectable()
export class Ds1ResolverService implements OnModuleInit {
  private readonly logger = new Logger(Ds1ResolverService.name);
  private readonly index = new Map<string, KuralRecord>(); // K0001 → record

  private readonly ds1Path = path.join(
    process.cwd(),
    'datasets',
    'allthirukural.json',
  );

  onModuleInit() {
    this.loadAll();
  }

  private loadAll() {
    let total = 0;
    const raw = fs.readFileSync(this.ds1Path, 'utf8');
    const records: KuralRecord[] = JSON.parse(raw);
    for (const r of records) {
      this.index.set(r.id, r);
      total++;
    }
    this.logger.log(`DS1 loaded: ${total} Kural records`);
  }

  resolve(reference: string, intent: QueryIntent): KnowledgeAnswer {
    const record = this.index.get(reference);
    if (!record) {
      return { found: false, dataset: 'DS1', reference, intent, answer: null };
    }

    let answer: string;
    switch (intent) {
      case 'EXPLANATION':
      case 'MEANING':
        answer = record.simple_explanation;
        break;
      case 'KURAL_AND_EXPLANATION':
        answer = `${record.kural}\n\nபொருள்: ${record.simple_explanation}`;
        break;
      case 'KURAL_TEXT':
      default:
        answer = record.kural;
        break;
    }

    return {
      found: true,
      dataset: 'DS1',
      reference,
      intent,
      answer,
      record,
    };
  }

  getRecord(id: string): KuralRecord | undefined {
    return this.index.get(id);
  }

  getSize(): number {
    return this.index.size;
  }
}
