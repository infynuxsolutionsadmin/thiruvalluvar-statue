import { ParsedQuery, QueryIntent } from '../../../common/types/knowledge.types';
import { Injectable } from '@nestjs/common';

import { Ds4ParserService } from './ds4.parser';

// ─── Tamil keyword constants (Unicode-escaped for portability) ────────────────
// This ensures the regex literals survive any editor/compiler encoding issues.

// குறள் related (0B95 0BC1 0BB1 0BB3 0BCD)
const KURAL_ROOT   = '\u0B95\u0BC1\u0BB1\u0BB3';   // குறள (root, no virama)
const THIRUKKURAL  = '\u0BA4\u0BBF\u0BB0\u0BC1\u0B95\u0BCD\u0B95\u0BC1\u0BB1\u0BB3\u0BCD'; // திருக்குறள்

// அதிகாரம்
const ADHIGARAM    = '\u0B85\u0BA4\u0BBF\u0B95\u0BBE\u0BB0'; // அதிகார (root)

// திருவள்ளுவர் / வள்ளுவர் — use root WITHOUT final virama so suffix forms match too
// திருவள்ளுவர (0BA4 0BBF 0BB0 0BC1 0BB5 0BB3 0BCD 0BB3 0BC1 0BB5 0BB0)
const THIRUVALLUVAR = '\u0BA4\u0BBF\u0BB0\u0BC1\u0BB5\u0BB3\u0BCD\u0BB3\u0BC1\u0BB5\u0BB0'; // திருவள்ளுவர (root, no final ர்)
// வள்ளுவர (0BB5 0BB3 0BCD 0BB3 0BC1 0BB5 0BB0)
const VALLUVAR      = '\u0BB5\u0BB3\u0BCD\u0BB3\u0BC1\u0BB5\u0BB0'; // வள்ளுவர (root)

// Fact keywords
const ETHANA        = '\u0B8E\u0BA4\u0BCD\u0BA4\u0BA9\u0BC8'; // எத்தனை
const MOTHAM        = '\u0BAE\u0BCA\u0BA4\u0BCD\u0BA4\u0BAE\u0BCD'; // மொத்தம்
const PAAL          = '\u0BAA\u0BBE\u0BB2\u0BCD'; // பால்
const PIRIVUGAL     = '\u0BAA\u0BBF\u0BB0\u0BBF\u0BB5\u0BC1'; // பிரிவு (root)
const PAGAM         = '\u0BAA\u0BBE\u0B95\u0BAE\u0BCD'; // பாகம் (root without m)
const EZHUTHIYAVAR  = '\u0B8E\u0BB4\u0BC1\u0BA4\u0BBF\u0BAF\u0BB5\u0BB0\u0BCD'; // எழுதியவர்
const IYARIYAVAR    = '\u0B87\u0BAF\u0BB1\u0BCD\u0BB1\u0BBF\u0BAF\u0BB5\u0BB0\u0BCD'; // இயற்றியவர்
const AASIRIYAR     = '\u0B86\u0B9A\u0BBF\u0BB0\u0BBF\u0BAF\u0BB0\u0BCD'; // ஆசிரியர்
const ADHIGARAM_WORD = '\u0B85\u0BA4\u0BBF\u0B95\u0BBE\u0BB0\u0BAE\u0BCD'; // அதிகாரம்

// Intent detection keywords
const PORULAI       = '\u0BAA\u0BCA\u0BB0\u0BC1\u0BB3\u0BCD'; // பொருள்
const ARTHAM        = '\u0B85\u0BB0\u0BCD\u0BA4\u0BCD\u0BA4\u0BAE\u0BCD'; // அர்த்தம்
const SOLLA         = '\u0B9A\u0BCA\u0BB2\u0BCD\u0BB2\u0BC1\u0BA4\u0BC1'; // சொல்லுது
const SOLKIRATHU    = '\u0B9A\u0BCA\u0BB2\u0BCD\u0B95\u0BBF\u0BB1\u0BA4\u0BC1'; // சொல்கிறது
const KARUTHU       = '\u0B95\u0BB0\u0BC1\u0BA4\u0BCD\u0BA4\u0BC1'; // கருத்து
const VILAKKAM      = '\u0BB5\u0BBF\u0BB3\u0B95\u0BCD\u0B95\u0BAE\u0BCD'; // விளக்கம்
const VILAKKU       = '\u0BB5\u0BBF\u0BB3\u0B95\u0BCD\u0B95\u0BC1'; // விளக்கு (root)
const ELAIMA        = '\u0B8E\u0BB3\u0BBF\u0BAE\u0BC8'; // எளிமை (root)

/**
 * Deterministic query parser.
 *
 * Priority order:
 *  1. Fixed-fact intent keywords  (F004 checked before F001 to avoid false matches)
 *  2. Kural number extraction
 *  3. Adhigaram name/number detection
 *  4. Biography / entity detection
 *  5. UNKNOWN
 *
 * Within a Kural query, intent priority:
 *  EXPLANATION > MEANING > KURAL_TEXT
 *
 * No LLM, no embeddings, no external calls.
 */
@Injectable()
export class QueryParserService {
  constructor(private readonly ds4: Ds4ParserService) {}

  // ── Normalise ────────────────────────────────────────────────────────────
  normalizeQuery(raw: string): string {
    return raw
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[௦௧௨௩௪௫௬௭௮௯]/g, (match) => {
        // Tamil zero is \u0BE6, so we subtract its char code to get the Arabic digit
        return String(match.charCodeAt(0) - 0x0BE6);
      });
  }

  // ── Main entry point ─────────────────────────────────────────────────────
  parse(rawQuery: string): ParsedQuery {
    const q = this.normalizeQuery(rawQuery);

    // 0. DS4 Exact Match (highest priority)
    const ds4Ref = this.ds4.getReference(q);
    if (ds4Ref) {
      return this.mapDs4Reference(ds4Ref, q);
    }

    // 1. Fixed-fact intents (highest priority)
    const factResult = this.tryFixedFact(q);
    if (factResult) return factResult;

    // 2. Kural number extraction
    const kuralResult = this.tryKural(q);
    if (kuralResult) return kuralResult;

    // 3. Adhigaram detection
    const adhiResult = this.tryAdhigaram(q);
    if (adhiResult) return adhiResult;

    // 4. Biography detection
    const bioResult = this.tryBiography(q);
    if (bioResult) return bioResult;

    // 4.5 Context-dependent ambiguous questions (e.g. "இந்த குறள்")
    // If the query asks about "this kural" but contains no Kural number, we must reject it.
    if ((q.includes('இந்த குறள்') || q.includes('இந்தக் குறள்')) && !this.extractKuralNumber(q)) {
      return {
        dataset: 'UNKNOWN',
        reference: 'D001',
        intent: 'UNKNOWN',
        confidence: 0,
        normalizedQuery: q,
      };
    }

    // 5. UNKNOWN
    return {
      dataset: 'UNKNOWN',
      reference: 'D001',
      intent: 'UNKNOWN',
      confidence: 0,
      normalizedQuery: q,
    };
  }

  // ── 1. Fixed-fact detection ───────────────────────────────────────────────
  private tryFixedFact(q: string): ParsedQuery | null {
    // AUTHOR — check before TOTAL_KURALS
    if (q.includes(EZHUTHIYAVAR) || q.includes(IYARIYAVAR) || q.includes(AASIRIYAR)) {
      return this.factResult(q, 'F004', 'AUTHOR');
    }

    // TOTAL_KURALS — F001 (must have குறள் and எத்தனை/மொத்தம், no அதிகார/பால்)
    if (
      (q.includes(ETHANA) || q.includes(MOTHAM)) &&
      (q.includes(KURAL_ROOT) || q.includes('குரல') || q.includes('குரல்')) &&
      !q.includes(ADHIGARAM) &&
      !q.includes(PAAL)
    ) {
      return this.factResult(q, 'F001', 'TOTAL_KURALS');
    }

    // TOTAL_ADHIGARAMS — F002
    if ((q.includes(ETHANA) || q.includes(MOTHAM)) && q.includes(ADHIGARAM)) {
      return this.factResult(q, 'F002', 'TOTAL_ADHIGARAMS');
    }

    // TOTAL_PAALS — F003
    if (
      (q.includes(ETHANA) || q.includes(MOTHAM)) &&
      (q.includes(PAAL) || q.includes(PIRIVUGAL) || q.includes(PAGAM))
    ) {
      return this.factResult(q, 'F003', 'TOTAL_PAALS');
    }

    return null;
  }

  private factResult(q: string, ref: string, intent: QueryIntent): ParsedQuery {
    return { dataset: 'DS7', reference: ref, intent, confidence: 1.0, normalizedQuery: q };
  }

  // ── 2. Kural number extraction ────────────────────────────────────────────
  private tryKural(q: string): ParsedQuery | null {
    const num = this.extractKuralNumber(q);
    if (num === null) return null;

    const ref = 'K' + String(num).padStart(4, '0');
    const intent = this.detectKuralIntent(q);

    return { dataset: 'DS1', reference: ref, intent, confidence: 1.0, normalizedQuery: q };
  }

  /**
   * Extract Arabic or Tamil spelled-out Kural number (1–1330).
   * Strategy: check for digits first, then try Tamil word parsing.
   * Verify the string also contains a Kural-related root word.
   */
  extractKuralNumber(q: string): number | null {
    if (!q.includes(KURAL_ROOT) && !q.includes(THIRUKKURAL) && !q.includes('குரல்') && !q.includes('குரல')) return null;

    // 1. Try Arabic digits
    const match = q.match(/(\d+)/);
    if (match) {
      const n = parseInt(match[1], 10);
      if (n >= 1 && n <= 1330) return n;
      return null; // out of range
    }

    // 2. Try Tamil words
    const n = this.parseTamilNumber(q);
    if (n !== null && n >= 1 && n <= 1330) {
      return n;
    }

    return null;
  }

  private parseTamilNumber(q: string): number | null {
    // ----------------------------------------------------------------------
    // PHASE A: ASR Spelling Normalization
    // Normalize known ASR variations to standard suffix forms without losing numeric meaning
    // ----------------------------------------------------------------------
    let norm = q
      // ASR missing first letter fixes
      .replace(/(^|\s)ருநூ/g, '$1இருநூ')
      // Thousands & 900 normalization
      .replace(/யிரத்தி(?!ர)/g, 'யிரத்து')

      // 1. Un-merge tens and units compounds (e.g., முப்பத்தொன்பது -> முப்பத்து ஒன்பது)
      // 'த்' base (20-80)
      .replace(/த்தொ/g, 'த்து ஒ')
      .replace(/த்தை/g, 'த்து ஐ')
      .replace(/த்தா/g, 'த்து ஆ')
      .replace(/த்தே/g, 'த்து ஏ')
      .replace(/த்தெ/g, 'த்து எ')
      .replace(/த்தஞ்/g, 'த்து அஞ்')
      .replace(/த்திர/g, 'த்து இர')
      // 'ற்' base (90)
      .replace(/ற்றொ/g, 'ற்று ஒ')
      .replace(/ற்றை/g, 'ற்று ஐ')
      .replace(/ற்றா/g, 'ற்று ஆ')
      .replace(/ற்றே/g, 'ற்று ஏ')
      .replace(/ற்றெ/g, 'ற்று எ')
      .replace(/ற்றஞ்/g, 'ற்று அஞ்')
      .replace(/ற்றிர/g, 'ற்று இர')
      
      // 2. Hundreds compounding with tens (e.g. நூற்றிருபத்து -> நூற்று இருபத்து)
      .replace(/ற்றிருப/g, 'ற்று இருப')
      .replace(/ற்றைம்ப/g, 'ற்று ஐம்ப')
      .replace(/ற்றறுப/g, 'ற்று அறுப')
      .replace(/ற்றெழுப/g, 'ற்று எழுப')
      .replace(/ற்றெண்ப/g, 'ற்று எண்ப')
      // Colloquial Hundreds Sandhi (e.g., நூத்தம்பது -> நூற்று அம்பது)
      .replace(/நூத்தம்ப/g, 'நூற்று அம்ப')
      .replace(/நூத்தறுப/g, 'நூற்று அறுப')
      .replace(/நூத்தெழுப/g, 'நூற்று எழுப')
      .replace(/நூத்தெண்ப/g, 'நூற்று எண்ப')
      .replace(/நூத்திருப/g, 'நூற்று இருப')

      // 3. Thousands compounding with hundreds (e.g. ஆயிரத்திருநூறு -> ஆயிரத்து இருநூறு)
      .replace(/த்தொருநூ/g, 'த்து ஒருநூ')
      .replace(/த்திருநூ/g, 'த்து இருநூ')
      .replace(/த்தெண்ணூ/g, 'த்து எண்ணூ')

      // 4. Hundreds basic suffix normalization (accounting for sandhi: ந, ன, ண)
      .replace(/நூத்தி/g, 'நூற்று')
      .replace(/நூற்றி/g, 'நூற்று')
      .replace(/னூத்தி/g, 'னூற்று')
      .replace(/னூற்றி/g, 'னூற்று')
      .replace(/ணூத்தி/g, 'ணூற்று')
      .replace(/ணூற்றி/g, 'ணூற்று')
      
      // 5. Tens basic normalization
      .replace(/பத்தி/g, 'பத்து')
      // Colloquial 20 variations
      .replace(/இருவத்து/g, 'இருபத்து')
      .replace(/இருவது/g, 'இருபது')
      .replace(/இருவதாவது/g, 'இருபதாவது')
      .replace(/தொன்னூ/g, 'தொண்ணூ')
      // Fix colloquial 90 suffix that appears after un-merging
      .replace(/தொண்ணூத்து/g, 'தொண்ணூற்று')
      // Fix 'ம்பத்து' (e.g. 50/80 variants) -> 'ம்பது' is fine, but lets standardise
      .replace(/எம்பத்து/g, 'எண்பத்து')
      .replace(/எம்பது/g, 'எண்பது')
      .replace(/எம்பதாவது/g, 'எண்பதாவது')
      .replace(/நாப்பத்து/g, 'நாற்பத்து')
      .replace(/நாப்பது/g, 'நாற்பது')
      .replace(/நாப்பதாவது/g, 'நாற்பதாவது')
      // Known 12 variations
      .replace(/பனிரெண்டு/g, 'பன்னிரண்டு')
      .replace(/பனிரெண்டாவது/g, 'பன்னிரண்டாவது')
      .replace(/பன்னிரெண்டு/g, 'பன்னிரண்டு')
      .replace(/பன்னிரெண்டாவது/g, 'பன்னிரண்டாவது')
      .replace(/பனிரண்டு/g, 'பன்னிரண்டு')
      .replace(/பனிரண்டாவது/g, 'பன்னிரண்டாவது');

    // ----------------------------------------------------------------------
    // PHASE B: Tokenization and Compositional Calculation
    // ----------------------------------------------------------------------
    const numDict: Record<string, number> = {
      // Units
      'ஒன்று': 1, 'ஒன்றாவது': 1, 'முதல்': 1, 'ஒன்னு': 1, 'ஒன்னாவது': 1,
      'இரண்டு': 2, 'இரண்டாவது': 2, 'ரெண்டு': 2, 'ரெண்டாவது': 2,
      'மூன்று': 3, 'மூன்றாவது': 3, 'மூனு': 3, 'மூனாவது': 3,
      'நான்கு': 4, 'நான்காவது': 4, 'நாலு': 4, 'நாலாவது': 4,
      'ஐந்து': 5, 'ஐந்தாவது': 5, 'அஞ்சு': 5, 'அஞ்சாவது': 5,
      'ஆறு': 6, 'ஆறாவது': 6,
      'ஏழு': 7, 'ஏழாவது': 7,
      'எட்டு': 8, 'எட்டாவது': 8,
      'ஒன்பது': 9, 'ஒன்பதாவது': 9,
      
      // Teens and Ten
      'பத்து': 10, 'பத்தாவது': 10,
      'பதினொன்று': 11, 'பதினொன்றாவது': 11, 'பதினோரு': 11, 'பதினோராவது': 11,
      'பன்னிரண்டு': 12, 'பன்னிரண்டாவது': 12,
      'பதிமூன்று': 13, 'பதிமூன்றாவது': 13, 'பதின்மூன்று': 13, 'பதின்மூன்றாவது': 13,
      'பதினான்கு': 14, 'பதினான்காவது': 14,
      'பதினைந்து': 15, 'பதினைந்தாவது': 15,
      'பதினாறு': 16, 'பதினாறாவது': 16,
      'பதினேழு': 17, 'பதினேழாவது': 17,
      'பதினெட்டு': 18, 'பதினெட்டாவது': 18,
      'பத்தொன்பது': 19, 'பத்தொன்பதாவது': 19,
      
      // Tens
      'இருபது': 20, 'இருபத்து': 20, 'இருபதாவது': 20,
      'முப்பது': 30, 'முப்பத்து': 30, 'முப்பதாவது': 30,
      'நாற்பது': 40, 'நாற்பத்து': 40, 'நாற்பதாவது': 40,
      'ஐம்பது': 50, 'ஐம்பத்து': 50, 'ஐம்பதாவது': 50, 'அம்பது': 50, 'அம்பத்து': 50, 'அம்பதாவது': 50,
      'அறுபது': 60, 'அறுபத்து': 60, 'அறுபதாவது': 60,
      'எழுபது': 70, 'எழுபத்து': 70, 'எழுபதாவது': 70,
      'எண்பது': 80, 'எண்பத்து': 80, 'எண்பதாவது': 80,
      'தொண்ணூறு': 90, 'தொண்ணூற்று': 90, 'தொண்ணூறாவது': 90,
      
      // Hundreds
      'நூறு': 100, 'நூற்று': 100, 'நூறாவது': 100,
      'இருநூறு': 200, 'இருநூற்று': 200, 'இருநூறாவது': 200, 'இரநூறு': 200, 'இரநூற்று': 200, 'இரநூறாவது': 200,
      'முந்நூறு': 300, 'முந்நூற்று': 300, 'முந்நூறாவது': 300, 'முன்னூறு': 300, 'முன்னூற்று': 300, 'முன்னூறாவது': 300,
      'நானூறு': 400, 'நானூற்று': 400, 'நானூறாவது': 400,
      'ஐந்நூறு': 500, 'ஐந்நூற்று': 500, 'ஐந்நூறாவது': 500, 'ஐநூறு': 500, 'ஐநூற்று': 500, 'ஐநூறாவது': 500,
      'அறுநூறு': 600, 'அறுநூற்று': 600, 'அறுநூறாவது': 600,
      'எழுநூறு': 700, 'எழுநூற்று': 700, 'எழுநூறாவது': 700,
      'எண்ணூறு': 800, 'எண்ணூற்று': 800, 'எண்ணூறாவது': 800, 'எட்நூற்று': 800,
      'தொள்ளாயிரம்': 900, 'தொள்ளாயிரத்து': 900, 'தொள்ளாயிரமாவது': 900,
      
      // Thousands
      'ஆயிரம்': 1000, 'ஆயிரத்து': 1000, 'ஆயிரமாவது': 1000
    };

    const tokens = norm.split(/\s+/);
    let totalValue = 0;
    let foundNumericTokens = false;
    let inNumericSequence = false;

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (numDict.hasOwnProperty(token)) {
        if (foundNumericTokens && !inNumericSequence) {
          // Found a second disjoint sequence of numbers, highly ambiguous
          return null;
        }
        totalValue += numDict[token];
        foundNumericTokens = true;
        inNumericSequence = true;
      } else {
        inNumericSequence = false;
      }
    }

    // Strict safety check: must be in range 1-1330
    if (foundNumericTokens && totalValue > 0 && totalValue <= 1330) {
      return totalValue;
    }

    return null;
  }

  /** Intent within a confirmed Kural query. EXPLANATION > MEANING > KURAL_TEXT */
  detectKuralIntent(q: string): QueryIntent {
    if (q.includes(VILAKKAM) || q.includes(VILAKKU) || q.includes(ELAIMA) || q.includes('புரியும்படி')) {
      return 'EXPLANATION';
    }
    if (q.includes(PORULAI) || q.includes(ARTHAM) || q.includes(SOLLA) ||
        q.includes(SOLKIRATHU) || q.includes(KARUTHU) || q.includes('பொருள்') ||
        q.includes('சொல்லுது') || q.includes('சொல்கிற') || q.includes('சொல்லுகிறது')) {
      return 'MEANING';
    }
    return 'KURAL_TEXT';
  }

  // ── 3. Adhigaram detection ────────────────────────────────────────────────
  private tryAdhigaram(q: string): ParsedQuery | null {
    if (!q.includes(ADHIGARAM)) return null;

    let n: number | null = null;

    // Numbered adhigaram: find a digit and verify adhigaram root is present
    const match = q.match(/(\d+)/);
    if (match) {
      n = parseInt(match[1], 10);
    } else {
      n = this.parseTamilNumber(q);
    }

    if (n !== null && n >= 1 && n <= 133) {
      const ref = 'A' + String(n).padStart(3, '0');
      return { dataset: 'DS2', reference: ref, intent: 'ADHIGARAM', confidence: 1.0, normalizedQuery: q };
    }

    // Named adhigaram — DS2Resolver resolves by name at runtime
    return { dataset: 'DS2', reference: null, intent: 'ADHIGARAM', confidence: 0.8, normalizedQuery: q };
  }

  // ── 4. Biography detection ────────────────────────────────────────────────
  private tryBiography(q: string): ParsedQuery | null {
    const hasValluvar = q.includes(THIRUVALLUVAR) || q.includes(VALLUVAR);
    if (!hasValluvar) return null;

    // To prevent false-positives where topical questions mention Thiruvalluvar,
    // we only route to BIO001 if the query strictly matches known biography intent patterns,
    // rather than using loose keyword matching (e.g., q.includes('யார்') which might match accidentally).
    const bioPatterns = [
      'யார்',
      'வரலாறு',
      'பற்றி சொல்லுங்க',
      'பற்றிச் சொல்லுங்க' // accounts for sandhi (ச்)
    ];

    // Check if the query ends with or heavily focuses on these bio patterns
    // without topical words like 'அன்பு', 'கல்வி', etc.
    const isBioQuery = bioPatterns.some(pattern => q.includes(pattern));

    // Wait, the user specifically said "DO NOT add generic keyword rules".
    // "A query about a specific subject/topic must not become BIOGRAPHY merely because it mentions திருவள்ளுவர்."
    
    // Instead of doing partial matches that can fail, we just do strict suffix/exact matches
    // for the remaining cases not caught by DS4.
    const normalizedForBio = q.replace(/ச்/g, '').replace(/த்/g, '').trim();

    if (
      normalizedForBio === 'திருவள்ளுவர் யார்' ||
      normalizedForBio === 'திருவள்ளுவர் யார்?' ||
      normalizedForBio === 'வள்ளுவர் யார்' ||
      normalizedForBio === 'திருவள்ளுவரைப் பற்றி சொல்லுங்க' ||
      normalizedForBio === 'வள்ளுவரைப் பற்றி சொல்லுங்க' ||
      normalizedForBio === 'திருவள்ளுவரின் வாழ்க்கை வரலாறு'
    ) {
      return { dataset: 'DS3', reference: 'BIO001', intent: 'BIOGRAPHY', confidence: 0.9, normalizedQuery: q };
    }

    if (
      normalizedForBio.includes('வாழ்ந்த காலம்') ||
      normalizedForBio.includes('பிறந்த காலம்') ||
      normalizedForBio.includes('வாழ்ந்த ஆண்டு') ||
      normalizedForBio.includes('பிறந்த ஆண்டு') ||
      (normalizedForBio.includes('காலம்') && (normalizedForBio.includes('எந்த') || normalizedForBio.includes('என்ன')))
    ) {
      // Prevent false-positive with 'காலமறிதல்' Adhigaram if explicitly mentioned
      if (!normalizedForBio.includes('அதிகாரம்') && !normalizedForBio.includes('அறிதல்')) {
        return { dataset: 'DS3', reference: 'BIO007', intent: 'BIOGRAPHY', confidence: 0.9, normalizedQuery: q };
      }
    }
    
    return null;
  }

  // ── 5. Map DS4 Reference to ParsedQuery ────────────────────────────────────
  private mapDs4Reference(ref: string, q: string): ParsedQuery {
    if (ref.startsWith('K')) {
      return { dataset: 'DS1', reference: ref, intent: this.detectKuralIntent(q), confidence: 1.0, normalizedQuery: q };
    }
    if (ref.startsWith('A')) {
      return { dataset: 'DS2', reference: ref, intent: 'ADHIGARAM', confidence: 1.0, normalizedQuery: q };
    }
    if (ref.startsWith('BIO')) {
      return { dataset: 'DS3', reference: ref, intent: 'BIOGRAPHY', confidence: 1.0, normalizedQuery: q };
    }
    if (ref.startsWith('F')) {
      let intent: QueryIntent = 'UNKNOWN';
      if (ref === 'F001') intent = 'TOTAL_KURALS';
      else if (ref === 'F002') intent = 'TOTAL_ADHIGARAMS';
      else if (ref === 'F003') intent = 'TOTAL_PAALS';
      else if (ref === 'F004') intent = 'AUTHOR';
      return { dataset: 'DS7', reference: ref, intent, confidence: 1.0, normalizedQuery: q };
    }
    return { dataset: 'UNKNOWN', reference: ref, intent: 'UNKNOWN', confidence: 1.0, normalizedQuery: q };
  }
}
