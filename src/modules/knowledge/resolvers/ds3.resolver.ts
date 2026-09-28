import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { BiographyRecord, KnowledgeAnswer } from '../../../common/types/knowledge.types';

/**
 * DS3 Resolver — loads biography records and returns them by ID.
 * For general biography queries, defaults to BIO001.
 */
@Injectable()
export class Ds3ResolverService implements OnModuleInit {
  private readonly logger = new Logger(Ds3ResolverService.name);
  private readonly index = new Map<string, BiographyRecord>();

  private readonly ds3File = path.join(
    process.cwd(),
    'datasets',
    'DS3',
    'Biography.json',
  );

  onModuleInit() {
    const raw = fs.readFileSync(this.ds3File, 'utf8');
    const records: BiographyRecord[] = JSON.parse(raw);
    for (const r of records) {
      this.index.set(r.id, r);
    }
    this.logger.log(`DS3 loaded: ${records.length} Biography records`);
  }

  resolve(reference: string | null): KnowledgeAnswer {
    const ref = reference ?? 'BIO001';
    const record = this.index.get(ref);

    if (!record) {
      return {
        found: false,
        dataset: 'DS3',
        reference: ref,
        intent: 'BIOGRAPHY',
        answer: null,
      };
    }

    return {
      found: true,
      dataset: 'DS3',
      reference: ref,
      intent: 'BIOGRAPHY',
      answer: record.content,
      record,
    };
  }

  getSize(): number {
    return this.index.size;
  }
}
