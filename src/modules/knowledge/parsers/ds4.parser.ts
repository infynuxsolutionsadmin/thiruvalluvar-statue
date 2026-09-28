import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export interface Ds4Record {
  id: string;
  questions: string[];
  answer_reference: string;
}

@Injectable()
export class Ds4ParserService implements OnModuleInit {
  private readonly logger = new Logger(Ds4ParserService.name);
  private readonly questionMap = new Map<string, string>(); // question -> answer_reference

  private readonly ds4Path = path.join(
    process.cwd(),
    'datasets',
    'DS4_faq.json',
  );

  onModuleInit() {
    this.loadAll();
  }

  private loadAll() {
    try {
      const raw = fs.readFileSync(this.ds4Path, 'utf8');
      const records: Ds4Record[] = JSON.parse(raw);
      
      let totalQuestions = 0;
      for (const record of records) {
        if (record.questions && record.answer_reference) {
          for (const q of record.questions) {
            // Normalize question to ensure robust matching
            const normalized = this.normalize(q);
            this.questionMap.set(normalized, record.answer_reference);
            totalQuestions++;
          }
        }
      }
      this.logger.log(`DS4 loaded: ${records.length} records, ${totalQuestions} questions mapped`);
    } catch (err) {
      this.logger.error(`Failed to load DS4 dataset: ${err}`);
    }
  }

  private normalize(q: string): string {
    return q
      .normalize('NFC') // Ensure standard Unicode composition
      .replace(/[^\p{L}\p{M}\p{N}\s]/gu, '') // Keep letters, vowel marks (pulli/modifiers), numbers, whitespace. Removes punctuation & ZWJ.
      .replace(/(?:^|\s)இத்\s+/g, ' ') // Remove non-semantic prefix 'இத் ' before words like 'திருக்குறள்'
      .replace(/[\u0B95\u0B9A\u0BA4\u0BAA]\u0BCD(?=\s|$)/g, '') // Remove trailing sandhi consonants (க், ச், த், ப்) before a space
      .trim()
      .replace(/\s+/g, ' '); // Collapse spaces
  }

  getReference(rawQuery: string): string | null {
    const q = this.normalize(rawQuery);
    return this.questionMap.get(q) || null;
  }
}
