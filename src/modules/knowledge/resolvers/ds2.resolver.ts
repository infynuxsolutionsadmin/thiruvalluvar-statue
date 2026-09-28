import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { AdhigaramRecord, KnowledgeAnswer } from '../../../common/types/knowledge.types';

/**
 * DS2 Resolver — loads all 133 Adhigaram records and builds two indexes:
 *   adhigaram_number → record
 *   normalized_name  → record
 */
@Injectable()
export class Ds2ResolverService implements OnModuleInit {
  private readonly logger = new Logger(Ds2ResolverService.name);
  private readonly idIndex    = new Map<string, AdhigaramRecord>();   // A001 → rec
  private readonly numIndex   = new Map<number, AdhigaramRecord>();   // 1 → rec
  private readonly nameIndex  = new Map<string, AdhigaramRecord>();   // normalized name → rec

  private readonly ds2File = path.join(
    process.cwd(),
    'datasets',
    'DS2',
    'Adhigarams.json',
  );

  onModuleInit() {
    const raw = fs.readFileSync(this.ds2File, 'utf8');
    const records: AdhigaramRecord[] = JSON.parse(raw);
    for (const r of records) {
      this.idIndex.set(r.id, r);
      this.numIndex.set(r.adhigaram_number, r);
      this.nameIndex.set(this.normalizeName(r.adhigaram_name), r);
      // Also index keywords that look like names
      for (const kw of r.keywords) {
        const nkw = this.normalizeName(kw);
        if (!this.nameIndex.has(nkw)) {
          this.nameIndex.set(nkw, r);
        }
      }
    }
    this.logger.log(`DS2 loaded: ${records.length} Adhigaram records`);
  }

  private normalizeName(name: string): string {
    return name.trim().toLowerCase().replace(/\s+/g, '');
  }

  resolve(reference: string | null, rawQuery: string): KnowledgeAnswer {
    let record: AdhigaramRecord | undefined;

    if (reference) {
      record = this.idIndex.get(reference);
    }

    // If reference didn't resolve (or was null), try name-based lookup
    if (!record) {
      record = this.resolveByName(rawQuery);
    }

    if (!record) {
      return {
        found: false,
        dataset: 'DS2',
        reference,
        intent: 'ADHIGARAM',
        answer: null,
      };
    }

    const answer = `${record.adhigaram_name}: ${record.short_description}`;
    return {
      found: true,
      dataset: 'DS2',
      reference: record.id,
      intent: 'ADHIGARAM',
      answer,
      record,
    };
  }

  resolveByName(query: string): AdhigaramRecord | undefined {
    // Try every known name/keyword against the query
    const normQ = this.normalizeName(query);
    for (const [key, rec] of this.nameIndex.entries()) {
      if (normQ.includes(key) && key.length > 2) {
        return rec;
      }
    }
    return undefined;
  }

  getByNumber(n: number): AdhigaramRecord | undefined {
    return this.numIndex.get(n);
  }

  getSize(): number {
    return this.idIndex.size;
  }
}
