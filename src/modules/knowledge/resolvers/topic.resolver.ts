import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import {
  AdhigaramRecord,
  KuralRecord,
  KnowledgeAnswer,
  QueryIntent,
  TopicMatch,
} from '../../../common/types/knowledge.types';

// ─── Minimum score to return a result rather than D001 ───────────────────────
const CONFIDENCE_THRESHOLD = 60;

// ─── Scoring constants (documented, deterministic) ───────────────────────────
const SCORE = {
  ADHIGARAM_NAME_EXACT:   100,   // topic normalised == adhigaram_name normalised
  DS2_KEYWORD_EXACT:       85,   // topic found as-is in DS2 keywords[]
  DS2_KEYWORD_CONTAINS:    70,   // DS2 keyword contains the topic token
  DS1_KEYWORD_EXACT:       60,   // topic found as-is in DS1 keywords[]
  DS1_KEYWORD_CONTAINS:    45,   // DS1 keyword contains the topic token
  TOKEN_MATCH:             30,   // normalised token subset overlap
};

// ─── Filler phrases to strip from query before topic extraction ───────────────
// All expressed as Unicode-escaped roots so no encoding issues occur.
// These are checked via .includes() on the normalised query.
const FILLER_ROOTS: string[] = [
  '\u0BAA\u0BB1\u0BCD\u0BB1\u0BBF',        // பற்றி
  '\u0B95\u0BC1\u0BB1\u0BBF\u0BA4\u0BCD\u0BA4\u0BC1', // குறித்து
  '\u0B9A\u0BCA\u0BB2\u0BCD\u0BB2\u0BC1\u0B99\u0BCD\u0B95\u0BB3\u0BCD', // சொல்லுங்கள்
  '\u0B9A\u0BCA\u0BB2\u0BCD\u0BB2\u0BC1\u0B99\u0BCD\u0B95', // சொல்லுங்க
  '\u0B95\u0BC2\u0BB1\u0BC1\u0B95',         // கூறுக
  '\u0B95\u0BC2\u0BB1\u0BC1\u0B99\u0BCD\u0B95\u0BB3\u0BCD', // கூறுங்கள்
  '\u0BB5\u0BBF\u0BB3\u0B95\u0BCD\u0B95\u0BC1\u0B99\u0BCD\u0B95', // விளக்குங்க
  '\u0BB5\u0BBF\u0BB3\u0B95\u0BCD\u0B95\u0BC1\u0B99\u0BCD\u0B95\u0BB3\u0BCD', // விளக்குங்கள்
  '\u0B8E\u0BA9\u0BCD\u0BA9',               // என்ன
  '\u0B8E\u0BA4\u0BC8',                     // எதை
  '\u0B9A\u0BBF\u0BB2 \u0B95\u0BC1\u0BB1\u0BB3\u0BCD\u0B95\u0BB3\u0BCD', // சில குறள்கள்
  '\u0BA4\u0BBF\u0BB0\u0BC1\u0B95\u0BCD\u0B95\u0BC1\u0BB1\u0BB3\u0BCD', // திருக்குறள்
  '\u0B95\u0BC1\u0BB1\u0BB3\u0BCD',         // குறள்
  '\u0B85\u0BA4\u0BBF\u0B95\u0BBE\u0BB0\u0BAE\u0BCD', // அதிகாரம்
  '\u0B9A\u0BCA\u0BB2\u0BCD\u0B95\u0BBF\u0BB1\u0BA4\u0BC1', // சொல்கிறது
  '\u0B9A\u0BCA\u0BB2\u0BCD\u0B95\u0BBF\u0BB1\u0BA4\u0BC1\u0BAA\u0BCD', // சொல்கிறதுப்
  '\u0B9A\u0BCA\u0BB2\u0BCD\u0BB2\u0BC1',    // சொல்லு
  '\u0B9A\u0BCA\u0BB2\u0BCD\u0BB2\u0BC1\u0BA4\u0BC1', // சொல்லுது
  '\u0B9A\u0BCA\u0BB2\u0BCD\u0BB2\u0BAA\u0BCD\u0BAA\u0B9F\u0BCD\u0B9F\u0BC1\u0BB3\u0BCD\u0BB3\u0BA4\u0BC1', // சொல்லப்பட்டுள்ளது
  '\u0BB5\u0BBF\u0BB3\u0B95\u0BCD\u0B95\u0BC1', // விளக்கு
  '\u0B95\u0BC1\u0BB1\u0BBF\u0BA4\u0BCD\u0BA4',  // குறித்த
  '\u0BAA\u0BC7\u0B9A\u0BC1\u0B95\u0BBF\u0BB1\u0BA4\u0BC1', // பேசுகிறது
  '\u0BAA\u0BA4\u0BCD\u0BA4\u0BBF', // பத்தி
  '\u0B95\u0BCA\u0B9E\u0BCD\u0B9A\u0BAE\u0BCD', // கொஞ்சம்
  '\u0B8E\u0BAA\u0BCD\u0BAA\u0B9F\u0BBF', // எப்படி
  '\u0B87\u0BB0\u0BC1\u0B95\u0BCD\u0B95\u0BA3\u0BC1\u0BAE\u0BCD', // இருக்கணும்
  '\u0BA4\u0BCA\u0B9F\u0BB0\u0BCD\u0BAA\u0BBE\u0B95', // தொடர்பாக
  '\u0BAE\u0BC1\u0B95\u0BCD\u0B95\u0BBF\u0BAF\u0BA4\u0BCD\u0BA4\u0BC1\u0BB5\u0BAE\u0BCD', // முக்கியத்துவம்

];

// Intent signal: asking for "எந்த அதிகாரம்" or similar → TOPIC_ADHIGARAM
const ADHIGARAM_INTENT_SIGNAL = '\u0B85\u0BA4\u0BBF\u0B95\u0BBE\u0BB0'; // அதிகார

// Intent signal: "சில குறள்கள்", "பல குறள்கள்" → TOPIC_KURALS
const MULTIPLE_SIGNAL_ROOTS: string[] = [
  '\u0B9A\u0BBF\u0BB2',   // சில
  '\u0BAA\u0BB2',         // பல
  '\u0B9A\u0BBF\u0BB2\u0BB5\u0BB1\u0BCD\u0BB1\u0BC8', // சிலவற்றை
];

/**
 * TopicResolverService
 *
 * Handles queries where no explicit Kural/Adhigaram number was found.
 * Implements three matching levels:
 *   L1 — exact Adhigaram name match  (score 100)
 *   L2 — DS2 keyword match           (score 70–85)
 *   L3 — DS1 keyword match           (score 45–60)
 *   fallback — D001 / UNKNOWN
 *
 * Does NOT use DS4, embeddings, or any external calls.
 */
@Injectable()
export class TopicResolverService implements OnModuleInit {
  private readonly logger = new Logger(TopicResolverService.name);

  // DS2 index: adhigaram_name (normalised) → record
  private ds2ByName = new Map<string, AdhigaramRecord>();
  // DS2 flat list for keyword scanning
  private ds2All: AdhigaramRecord[] = [];
  // DS1: adhigaram_number → Kural records belonging to it
  private ds1ByAdhigaram = new Map<number, KuralRecord[]>();

  private readonly ds2File = path.join(process.cwd(), 'datasets', 'DS2', 'Adhigarams.json');
  private readonly ds1Dir  = path.join(process.cwd(), 'datasets', 'DS1');

  onModuleInit() {
    this.loadDs2();
    this.loadDs1();
  }

  private loadDs2() {
    const records: AdhigaramRecord[] = JSON.parse(fs.readFileSync(this.ds2File, 'utf8'));
    this.ds2All = records;
    for (const r of records) {
      this.ds2ByName.set(this.norm(r.adhigaram_name), r);
    }
    this.logger.log(`TopicResolver DS2 index: ${records.length} adhigarams`);
  }

  private loadDs1() {
    const files = fs.readdirSync(this.ds1Dir).filter(f => f.endsWith('.json'));
    let total = 0;
    for (const file of files) {
      const records: KuralRecord[] = JSON.parse(
        fs.readFileSync(path.join(this.ds1Dir, file), 'utf8'),
      );
      for (const r of records) {
        const bucket = this.ds1ByAdhigaram.get(r.adhigaram_number) ?? [];
        bucket.push(r);
        this.ds1ByAdhigaram.set(r.adhigaram_number, bucket);
        total++;
      }
    }
    this.logger.log(`TopicResolver DS1 index: ${total} kurals indexed by adhigaram`);
  }

  // ─── Public resolve entry point ──────────────────────────────────────────
  resolve(normalizedQuery: string): KnowledgeAnswer {
    const intent  = this.detectTopicIntent(normalizedQuery);
    const topic   = this.extractTopic(normalizedQuery);

    if (!topic || topic.length < 2) {
      return this.unknown(normalizedQuery);
    }

    const matches = this.match(topic);

    if (!matches.length || matches[0].score < CONFIDENCE_THRESHOLD) {
      return this.unknown(normalizedQuery);
    }

    // Handle ties: if the top two matches have the exact same score but different references, it's ambiguous
    if (matches.length > 1 && matches[0].score === matches[1].score && matches[0].reference !== matches[1].reference) {
      // If one is DS2 and the other is DS1, we might prefer DS2, but if both are DS2 it's definitely ambiguous
      if (matches[0].dataset === matches[1].dataset) {
        return this.unknown(normalizedQuery);
      }
    }

    const top = matches[0];

    // TOPIC_ADHIGARAM: user asked "எந்த அதிகாரம்..."
    if (intent === 'TOPIC_ADHIGARAM') {
      // Drive toward the best DS2 match
      const ds2Match = matches.find(m => m.dataset === 'DS2') ?? top;
      const adhRec = this.ds2All.find(a => a.id === ds2Match.reference);
      if (!adhRec) return this.unknown(normalizedQuery);

      return {
        found: true,
        dataset: 'DS2',
        reference: adhRec.id,
        intent: 'TOPIC_ADHIGARAM',
        answer: `${adhRec.adhigaram_name}: ${adhRec.short_description}`,
        record: adhRec,
        topicMatches: matches,
      };
    }

    // TOPIC_KURALS: user asked "சில குறள்கள்..."
    if (intent === 'TOPIC_KURALS') {
      const ds2Match = matches.find(m => m.dataset === 'DS2');
      if (ds2Match?.adhigaramNumber !== undefined) {
        const kurals = (this.ds1ByAdhigaram.get(ds2Match.adhigaramNumber) ?? [])
          .slice(0, 5);   // top 5 from the adhigaram — all authoritative
        if (kurals.length) {
          return {
            found: true,
            dataset: 'DS1',
            reference: kurals[0].id,
            references: kurals.map(k => k.id),
            intent: 'TOPIC_KURALS',
            answer: kurals.map(k => k.kural).join('\n---\n'),
            topicMatches: matches,
          };
        }
      }
      // Fallback to DS1-matched kurals
      const ds1Refs = matches.filter(m => m.dataset === 'DS1').slice(0, 5);
      if (ds1Refs.length) {
        return {
          found: true,
          dataset: 'DS1',
          reference: ds1Refs[0].reference,
          references: ds1Refs.map(m => m.reference),
          intent: 'TOPIC_KURALS',
          answer: null,
          topicMatches: matches,
        };
      }
      return this.unknown(normalizedQuery);
    }

    // TOPIC_GENERAL: prefer DS2 → return Adhigaram answer
    if (top.dataset === 'DS2') {
      const adhRec = this.ds2All.find(a => a.id === top.reference);
      if (!adhRec) return this.unknown(normalizedQuery);
      return {
        found: true,
        dataset: 'DS2',
        reference: adhRec.id,
        intent: 'TOPIC_GENERAL',
        answer: `${adhRec.adhigaram_name}: ${adhRec.short_description}`,
        record: adhRec,
        topicMatches: matches,
      };
    }

    // Top is DS1 Kural
    return this.unknown(normalizedQuery); // DS1-only hits kept below threshold for now
  }

  // ─── Topic intent detection ───────────────────────────────────────────────
  detectTopicIntent(q: string): QueryIntent {
    if (q.includes(ADHIGARAM_INTENT_SIGNAL)) return 'TOPIC_ADHIGARAM';
    if (MULTIPLE_SIGNAL_ROOTS.some(r => q.includes(r))) return 'TOPIC_KURALS';
    return 'TOPIC_GENERAL';
  }

  // ─── Topic extraction — strips filler words ───────────────────────────────
  extractTopic(q: string): string | null {
    let candidate = q;
    for (const filler of FILLER_ROOTS) {
      candidate = candidate.split(filler).join(' ');
    }
    // Collapse whitespace and trim
    candidate = candidate.replace(/\s+/g, ' ').trim();
    // Remove any remaining punctuation
    candidate = candidate.replace(/[?!.,;:]/g, '').trim();
    return candidate.length >= 2 ? candidate : null;
  }

  // ─── Three-level deterministic matching ──────────────────────────────────
  private match(topic: string): TopicMatch[] {
    const results: TopicMatch[] = [];
    const normTopic = this.norm(topic);
    // Minimum useful keyword length to prevent short-token false positives
    const MIN_KW_LEN = 4;

    // L1 — DS2 exact adhigaram name
    for (const [normName, rec] of this.ds2ByName.entries()) {
      if (normName === normTopic || normTopic.includes(normName)) {
        results.push({
          reference: rec.id,
          dataset: 'DS2',
          score: SCORE.ADHIGARAM_NAME_EXACT,
          matchedBy: 'ADHIGARAM_NAME',
          adhigaramNumber: rec.adhigaram_number,
        });
      }
    }

    // L2 — DS2 keyword match
    for (const rec of this.ds2All) {
      if (results.some(r => r.reference === rec.id)) continue;
      let bestScore = 0;
      for (const kw of rec.keywords) {
        if (kw.length < MIN_KW_LEN) continue; // skip trivially short keywords
        const normKw = this.norm(kw);
        if (normKw === normTopic) {
          bestScore = Math.max(bestScore, SCORE.DS2_KEYWORD_EXACT);
        } else if (
          (normKw.includes(normTopic) || normTopic.includes(normKw)) &&
          normKw.length >= MIN_KW_LEN
        ) {
          bestScore = Math.max(bestScore, SCORE.DS2_KEYWORD_CONTAINS);
        }
      }
      if (bestScore > 0) {
        results.push({
          reference: rec.id,
          dataset: 'DS2',
          score: bestScore,
          matchedBy: 'DS2_KEYWORD',
          adhigaramNumber: rec.adhigaram_number,
        });
      }
    }

    // L3 — DS1 keyword match
    const ds2MaxScore = results.filter(r => r.dataset === 'DS2').reduce((m, r) => Math.max(m, r.score), 0);
    if (ds2MaxScore < SCORE.DS2_KEYWORD_EXACT) {
      const kuralHits: TopicMatch[] = [];
      for (const [, kurals] of this.ds1ByAdhigaram.entries()) {
        for (const kural of kurals) {
          let bestScore = 0;
          for (const kw of kural.keywords) {
            if (kw.length < MIN_KW_LEN) continue;
            const normKw = this.norm(kw);
            if (normKw === normTopic) {
              bestScore = Math.max(bestScore, SCORE.DS1_KEYWORD_EXACT);
            } else if (
              (normKw.includes(normTopic) || normTopic.includes(normKw)) &&
              normKw.length >= MIN_KW_LEN
            ) {
              bestScore = Math.max(bestScore, SCORE.DS1_KEYWORD_CONTAINS);
            }
          }
          if (bestScore > 0) {
            kuralHits.push({
              reference: kural.id,
              dataset: 'DS1',
              score: bestScore,
              matchedBy: 'DS1_KEYWORD',
            });
          }
        }
      }
      results.push(...kuralHits);
    }

    return results.sort((a, b) => b.score - a.score);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────
  private norm(s: string): string {
    return s.trim().toLowerCase().replace(/\s+/g, '');
  }

  private unknown(q: string): KnowledgeAnswer {
    return {
      found: false,
      dataset: 'UNKNOWN',
      reference: 'D001',
      intent: 'UNKNOWN',
      answer: null,
    };
  }
}
