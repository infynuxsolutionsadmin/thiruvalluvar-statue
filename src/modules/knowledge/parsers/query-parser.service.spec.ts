import { QueryParserService } from './query-parser.service';
import { Ds4ParserService } from './ds4.parser';

describe('QueryParserService', () => {
  let svc: QueryParserService;
  let mockDs4: Partial<Ds4ParserService>;

  beforeEach(() => {
    mockDs4 = {
      getReference: jest.fn().mockReturnValue(null),
    };
    svc = new QueryParserService(mockDs4 as Ds4ParserService);
  });

  // ── DS1 Kural text ──────────────────────────────────────────────────────
  describe('DS1 — Kural text', () => {
    const textCases: [string, string][] = [
      ['101வது குறள் என்ன?',        'K0101'],
      ['101வது குறளை சொல்லுங்க',    'K0101'],
      ['854வது குறள் என்ன?',        'K0854'],
      ['1330வது குறள் என்ன?',       'K1330'],
      ['குறள் 101',                  'K0101'],
      ['குறள் எண் 101',              'K0101'],
      ['1வது குறள் என்ன?',          'K0001'],
    ];

    test.each(textCases)('%s → %s (KURAL_TEXT)', (query, ref) => {
      const r = svc.parse(query);
      expect(r.dataset).toBe('DS1');
      expect(r.reference).toBe(ref);
      expect(r.intent).toBe('KURAL_TEXT');
    });
  });

  // ── DS1 Kural meaning ───────────────────────────────────────────────────
  describe('DS1 — Kural meaning', () => {
    const meaningCases: [string, string][] = [
      ['101வது குறளின் பொருள் என்ன?',  'K0101'],
      ['101ம் குறள் என்ன சொல்லுது?',  'K0101'],
      ['101வது குறளின் கருத்து என்ன?', 'K0101'],
      ['854வது குறளின் பொருள் என்ன?',  'K0854'],
    ];

    test.each(meaningCases)('%s → %s (MEANING)', (query, ref) => {
      const r = svc.parse(query);
      expect(r.dataset).toBe('DS1');
      expect(r.reference).toBe(ref);
      expect(r.intent).toBe('MEANING');
    });
  });

  // ── DS1 Kural explanation ───────────────────────────────────────────────
  describe('DS1 — Kural explanation', () => {
    const explCases: [string, string][] = [
      ['101வது குறளை விளக்குங்க',              'K0101'],
      ['101வது குறளை கொஞ்சம் விளக்குங்க',     'K0101'],
      ['101வது குறளின் விளக்கம் என்ன?',       'K0101'],
      ['101ம் குறளை எளிமையாக விளக்குங்க',    'K0101'],
    ];

    test.each(explCases)('%s → %s (EXPLANATION)', (query, ref) => {
      const r = svc.parse(query);
      expect(r.dataset).toBe('DS1');
      expect(r.reference).toBe(ref);
      expect(r.intent).toBe('EXPLANATION');
    });
  });

  // ── Invalid Kural numbers ───────────────────────────────────────────────
  describe('DS1 — Invalid Kural numbers', () => {
    const invalidCases = [
      '1331வது குறள் என்ன?',
      '9999வது குறள் என்ன?',
      '0வது குறள் என்ன?',
    ];

    test.each(invalidCases)('%s → UNKNOWN', (query) => {
      const r = svc.parse(query);
      expect(r.dataset).not.toBe('DS1');
    });
  });

  // ── DS2 Adhigaram ───────────────────────────────────────────────────────
  describe('DS2 — Adhigaram', () => {
    it('numeric adhigaram → correct reference', () => {
      const r = svc.parse('79வது அதிகாரம் பற்றி சொல்லுங்க');
      expect(r.dataset).toBe('DS2');
      expect(r.reference).toBe('A079');
      expect(r.intent).toBe('ADHIGARAM');
    });

    it('named adhigaram → DS2 with null reference (resolved by DS2Resolver)', () => {
      const r = svc.parse('செய்ந்நன்றியறிதல் அதிகாரம் பற்றி சொல்லுங்க');
      expect(r.dataset).toBe('DS2');
      expect(r.intent).toBe('ADHIGARAM');
      // reference may be null here; DS2Resolver resolves by name
    });

    it('first adhigaram', () => {
      const r = svc.parse('1வது அதிகாரம் என்ன?');
      expect(r.dataset).toBe('DS2');
      expect(r.reference).toBe('A001');
    });

    it('133rd adhigaram', () => {
      const r = svc.parse('133வது அதிகாரம் என்ன?');
      expect(r.dataset).toBe('DS2');
      expect(r.reference).toBe('A133');
    });
  });

  // ── DS3 Biography ───────────────────────────────────────────────────────
  describe('DS3 — Biography', () => {
    const bioCases = [
      'திருவள்ளுவரைப் பற்றி சொல்லுங்க',
      'திருவள்ளுவர் யார்',
      'திருவள்ளுவரைப் பற்றிச் சொல்லுங்க',
      'திருவள்ளுவரின் வாழ்க்கை வரலாறு',
    ];

    test.each(bioCases)('%s → DS3/BIO001', (query) => {
      const r = svc.parse(query);
      expect(r.dataset).toBe('DS3');
      expect(r.reference).toBe('BIO001');
      expect(r.intent).toBe('BIOGRAPHY');
    });

    const falsePositiveCases = [
      'அன்பைப் பற்றித் திருவள்ளுவர் என்ன சொல்கிறார்',
      'பற்றி திருவள்ளுவர் என்ன கூறுகிறார்',
      'திருவள்ளுவர் எந்தக் காலத்தில் வாழ்ந்தவர்',
      'கல்வியைப் பற்றி திருவள்ளுவர் என்ன கூறுகிறார்',
      'நட்பைப் பற்றி திருவள்ளுவர் என்ன கூறுகிறார்',
    ];

    test.each(falsePositiveCases)('%s → UNKNOWN (Must not be BIO001)', (query) => {
      const r = svc.parse(query);
      expect(r.dataset).not.toBe('DS3');
      expect(r.reference).not.toBe('BIO001');
    });
  });

  // ── DS7 Fixed facts ─────────────────────────────────────────────────────
  describe('DS7 — Fixed facts', () => {
    it('total Kurals → F001', () => {
      const r = svc.parse('திருக்குறளில் மொத்தம் எத்தனை குறள்கள்?');
      expect(r.dataset).toBe('DS7');
      expect(r.reference).toBe('F001');
      expect(r.intent).toBe('TOTAL_KURALS');
    });

    it('total Adhigarams → F002', () => {
      const r = svc.parse('திருக்குறளில் எத்தனை அதிகாரங்கள்?');
      expect(r.dataset).toBe('DS7');
      expect(r.reference).toBe('F002');
      expect(r.intent).toBe('TOTAL_ADHIGARAMS');
    });

    it('total Paals → F003', () => {
      const r = svc.parse('திருக்குறளில் எத்தனை பால்?');
      expect(r.dataset).toBe('DS7');
      expect(r.reference).toBe('F003');
      expect(r.intent).toBe('TOTAL_PAALS');
    });

    it('author → F004', () => {
      const r = svc.parse('திருக்குறளை எழுதியவர் யார்?');
      expect(r.dataset).toBe('DS7');
      expect(r.reference).toBe('F004');
      expect(r.intent).toBe('AUTHOR');
    });

    it('author variant → F004', () => {
      const r = svc.parse('திருக்குறளின் ஆசிரியர் யார்?');
      expect(r.dataset).toBe('DS7');
      expect(r.reference).toBe('F004');
    });
  });

  // ── Unknown ─────────────────────────────────────────────────────────────
  describe('UNKNOWN queries', () => {
    const unknownCases = ['xyzzzwqe', 'hello world', '!@#$%'];

    test.each(unknownCases)('%s → UNKNOWN', (query) => {
      const r = svc.parse(query);
      expect(r.dataset).toBe('UNKNOWN');
      expect(r.intent).toBe('UNKNOWN');
      expect(r.reference).toBe('D001');
      expect(r.confidence).toBe(0);
    });
  });

  // ── extractKuralNumber unit test ────────────────────────────────────────
  describe('extractKuralNumber', () => {
    it('101வது குறள்', () => expect(svc.extractKuralNumber('101வது குறள் என்ன?')).toBe(101));
    it('101ம் குறள்',  () => expect(svc.extractKuralNumber('101ம் குறள் என்ன?')).toBe(101));
    it('குறள் 101',    () => expect(svc.extractKuralNumber('குறள் 101')).toBe(101));
    it('குறள் எண் 101',() => expect(svc.extractKuralNumber('குறள் எண் 101')).toBe(101));
    it('1330 valid',   () => expect(svc.extractKuralNumber('1330வது குறள் என்ன?')).toBe(1330));
    it('1331 invalid', () => expect(svc.extractKuralNumber('1331வது குறள் என்ன?')).toBeNull());
    it('0 invalid',    () => expect(svc.extractKuralNumber('0வது குறள் என்ன?')).toBeNull());
    it('முதல் குறள்',  () => expect(svc.extractKuralNumber('முதல் குறள் என்ன?')).toBe(1));
    it('பத்தாவது குறள்', () => expect(svc.extractKuralNumber('பத்தாவது குறள் என்ன?')).toBe(10));
    it('நூறாவது குறள்', () => expect(svc.extractKuralNumber('நூறாவது குறள் என்ன?')).toBe(100));
    it('நூற்றி இரண்டாவது குறள்', () => expect(svc.extractKuralNumber('நூற்றி இரண்டாவது குறள் என்ன?')).toBe(102));
    
    // Phonetic errors from STT
    it('நூறாவது குரல்', () => expect(svc.extractKuralNumber('நூறாவது குரல் என்ன?')).toBe(100));
    it('முதல் குரல்',  () => expect(svc.extractKuralNumber('முதல் குரல் என்ன?')).toBe(1));
    it('அம்பதாவது', () => expect(svc.extractKuralNumber('அம்பதாவது குறள்')).toBe(50));
    it('நூற்றி அம்பதாவது', () => expect(svc.extractKuralNumber('நூற்றி அம்பதாவது குறள்')).toBe(150));
    it('ஐநூற்று இருபத்தி ஒன்பதாவது', () => expect(svc.extractKuralNumber('ஐநூற்று இருபத்தி ஒன்பதாவது குறள்')).toBe(529));
    it('ஆயிரத்து முன்னூற்று முப்பதாவது', () => expect(svc.extractKuralNumber('ஆயிரத்து முன்னூற்று முப்பதாவது குறள்')).toBe(1330));
    it('ஆயிரத்தி முன்னூத்தி இருபதாவது', () => expect(svc.extractKuralNumber('ஆயிரத்தி முன்னூத்தி இருபதாவது குறள்')).toBe(1320));
    it('எழுநூத்தி முப்பதாவது', () => expect(svc.extractKuralNumber('எழுநூத்தி முப்பதாவது குறள்')).toBe(730));
    it('எட்நூற்று இருபத்தி ஒன்பதாவது', () => expect(svc.extractKuralNumber('எட்நூற்று இருபத்தி ஒன்பதாவது குறள்')).toBe(829));
  });
});
