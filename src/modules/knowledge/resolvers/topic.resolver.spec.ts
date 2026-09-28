import { TopicResolverService } from '../resolvers/topic.resolver';

/**
 * Topic Resolver unit tests.
 *
 * These run against the actual DS1/DS2 JSON files so they
 * verify real authoritative data — not mocks.
 *
 * Working directory must be thiruvalluvar-backend so paths resolve.
 */
describe('TopicResolverService', () => {
  let svc: TopicResolverService;

  beforeAll(async () => {
    svc = new TopicResolverService();
    // Manually trigger onModuleInit since we're not using the NestJS IoC here
    svc.onModuleInit();
  });

  // ── TOPIC_GENERAL ──────────────────────────────────────────────────────────
  describe('TOPIC_GENERAL — நட்பு', () => {
    it('resolves நட்பு பற்றி திருக்குறள் கூறுக → DS2/A079', () => {
      const ans = svc.resolve(
        '\u0BA8\u0B9F\u0BCD\u0BAA\u0BC1 \u0BAA\u0BB1\u0BCD\u0BB1\u0BBF \u0BA4\u0BBF\u0BB0\u0BC1\u0B95\u0BCD\u0B95\u0BC1\u0BB1\u0BB3\u0BCD \u0B95\u0BC2\u0BB1\u0BC1\u0B95'
      );
      expect(ans.found).toBe(true);
      expect(ans.dataset).toBe('DS2');
      expect(ans.reference).toBe('A079');
      expect(ans.intent).toBe('TOPIC_GENERAL');
      // The match must have happened via ADHIGARAM_NAME (score 100)
      const top = ans.topicMatches?.[0];
      expect(top?.matchedBy).toBe('ADHIGARAM_NAME');
      expect(top?.score).toBe(100);
    });

    it('answer contains the authoritative DS2 short_description', () => {
      const ans = svc.resolve(
        '\u0BA8\u0B9F\u0BCD\u0BAA\u0BC1 \u0BAA\u0BB1\u0BCD\u0BB1\u0BBF \u0BA4\u0BBF\u0BB0\u0BC1\u0B95\u0BCD\u0B95\u0BC1\u0BB1\u0BB3\u0BCD \u0B95\u0BC2\u0BB1\u0BC1\u0B95'
      );
      expect(ans.answer).toContain('\u0BA8\u0B9F\u0BCD\u0BAA\u0BC1'); // நட்பு
    });
  });

  // ── TOPIC_ADHIGARAM ────────────────────────────────────────────────────────
  describe('TOPIC_ADHIGARAM — நட்பு பற்றி எந்த அதிகாரம்', () => {
    it('resolves நட்பு பற்றி எந்த அதிகாரம் பேசுகிறது? → DS2/A079/TOPIC_ADHIGARAM', () => {
      const q =
        '\u0BA8\u0B9F\u0BCD\u0BAA\u0BC1 \u0BAA\u0BB1\u0BCD\u0BB1\u0BBF \u0B8E\u0BA8\u0BCD\u0BA4 \u0B85\u0BA4\u0BBF\u0B95\u0BBE\u0BB0\u0BAE\u0BCD \u0BAA\u0BC7\u0B9A\u0BC1\u0B95\u0BBF\u0BB1\u0BA4\u0BC1';
      const ans = svc.resolve(q);
      expect(ans.found).toBe(true);
      expect(ans.dataset).toBe('DS2');
      expect(ans.reference).toBe('A079');
      expect(ans.intent).toBe('TOPIC_ADHIGARAM');
    });
  });

  // ── TOPIC_KURALS ──────────────────────────────────────────────────────────
  describe('TOPIC_KURALS — நட்பு பற்றி சில குறள்கள்', () => {
    it('resolves to multiple DS1 Kural references from Adhigaram 79', () => {
      const q =
        '\u0BA8\u0B9F\u0BCD\u0BAA\u0BC1 \u0BAA\u0BB1\u0BCD\u0BB1\u0BBF \u0B9A\u0BBF\u0BB2 \u0B95\u0BC1\u0BB1\u0BB3\u0BCD\u0B95\u0BB3\u0BCD \u0B9A\u0BCA\u0BB2\u0BCD\u0BB2\u0BC1\u0B99\u0BCD\u0B95\u0BB3\u0BCD';
      const ans = svc.resolve(q);
      expect(ans.found).toBe(true);
      expect(ans.dataset).toBe('DS1');
      expect(ans.intent).toBe('TOPIC_KURALS');
      expect(ans.references).toBeDefined();
      expect(ans.references!.length).toBeGreaterThan(1);
      // All references must be valid DS1 IDs from adhigaram 79 (K0781–K0790)
      for (const ref of ans.references!) {
        const n = parseInt(ref.substring(1), 10);
        expect(n).toBeGreaterThanOrEqual(781);
        expect(n).toBeLessThanOrEqual(790);
      }
    });
  });

  // ── UNKNOWN topic ──────────────────────────────────────────────────────────
  describe('UNKNOWN — unsupported topic', () => {
    it('returns D001 for a fabricated unsupported topic', () => {
      const q =
        '\u0B85\u0BA3\u0BCD\u0B9F\u0BB5\u0BC6\u0BB3\u0BBF\u0BAF\u0BBF\u0BB2\u0BCD \u0BAA\u0B9A\u0BCD\u0B9A\u0BC8 \u0BAF\u0BBE\u0BA9\u0BC8\u0B95\u0BB3\u0BCD \u0BAA\u0BB1\u0BCD\u0BB1\u0BBF \u0B95\u0BC1\u0BB1\u0BB3\u0BCD \u0B8E\u0BA9\u0BCD\u0BA9 \u0B9A\u0BCA\u0BB2\u0BCD\u0B95\u0BBF\u0BB1\u0BA4\u0BC1';
      const ans = svc.resolve(q);
      expect(ans.found).toBe(false);
      expect(ans.reference).toBe('D001');
      expect(ans.intent).toBe('UNKNOWN');
    });

    it('returns D001 for an empty/nonsense topic', () => {
      const ans = svc.resolve('xyzzzwqe');
      expect(ans.found).toBe(false);
      expect(ans.reference).toBe('D001');
    });
  });

  // ── extractTopic unit tests ────────────────────────────────────────────────
  describe('extractTopic', () => {
    it('strips பற்றி and திருக்குறள் to leave நட்பு', () => {
      const q = '\u0BA8\u0B9F\u0BCD\u0BAA\u0BC1 \u0BAA\u0BB1\u0BCD\u0BB1\u0BBF \u0BA4\u0BBF\u0BB0\u0BC1\u0B95\u0BCD\u0B95\u0BC1\u0BB1\u0BB3\u0BCD \u0B95\u0BC2\u0BB1\u0BC1\u0B95';
      const topic = svc.extractTopic(q);
      expect(topic).toBeTruthy();
      // Topic must contain நட்பு (நட்பு unicode: 0BA8 0B9F\u0BCD 0BAA\u0BC1)
      expect(topic).toContain('\u0BA8\u0B9F\u0BCD\u0BAA\u0BC1');
    });
  });

  // ── detectTopicIntent unit tests ───────────────────────────────────────────
  describe('detectTopicIntent', () => {
    it('detects TOPIC_ADHIGARAM when அதிகாரம் is in query', () => {
      const q = 'xxx \u0B85\u0BA4\u0BBF\u0B95\u0BBE\u0BB0\u0BAE\u0BCD yyy';
      expect(svc.detectTopicIntent(q)).toBe('TOPIC_ADHIGARAM');
    });

    it('detects TOPIC_KURALS when சில is in query', () => {
      const q = '\u0B9A\u0BBF\u0BB2 \u0B95\u0BC1\u0BB1\u0BB3\u0BCD\u0B95\u0BB3\u0BCD';
      expect(svc.detectTopicIntent(q)).toBe('TOPIC_KURALS');
    });

    it('defaults to TOPIC_GENERAL for plain topic query', () => {
      expect(svc.detectTopicIntent('xxx')).toBe('TOPIC_GENERAL');
    });
  });

  // ── Regression: explicit queries must NOT go through topic resolver ─────────
  // (Covered fully in query-parser.service.spec.ts — verifying here at integration level)
  describe('Regression — explicit queries bypass topic resolver', () => {
    it('extractTopic for explicit kural query returns number string (which wont match any adhigaram)', () => {
      // "101வது குறளின் பொருள் என்ன?" — the topic resolver would be called
      // ONLY if the parser returned UNKNOWN (it won't for this query).
      // But if it were called, it should at worst return D001, not a wrong answer.
      const q = '101 \u0BAA\u0BCA\u0BB0\u0BC1\u0BB3\u0BCD'; // just "101 பொருள்"
      const ans = svc.resolve(q);
      // Should not find a real adhigaram for "101"
      expect(['D001', 'A001'].includes(ans.reference ?? '')).toBe(false);
    });
  });
});
