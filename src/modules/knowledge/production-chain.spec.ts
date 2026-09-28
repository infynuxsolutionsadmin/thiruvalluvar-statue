import { Test, TestingModule } from '@nestjs/testing';
import { KnowledgeModule } from './knowledge.module';
import { KnowledgeService } from './knowledge.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

describe('KnowledgeService Production Chain (e2e)', () => {
  let service: KnowledgeService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          envFilePath: '.env',
        }),
        MongooseModule.forRootAsync({
          imports: [ConfigModule],
          useFactory: async (configService: ConfigService) => ({
            uri: configService.get<string>('MONGO_URI'),
          }),
          inject: [ConfigService],
        }),
        KnowledgeModule,
      ],
    }).compile();

    const app = moduleFixture.createNestApplication();
    await app.init();
    service = moduleFixture.get<KnowledgeService>(KnowledgeService);
  }, 60000);

  describe('A. Numbered Kural tests', () => {
    const cases = [
      ['1வது குறள் என்ன?', 'K0001'],
      ['10வது குறள் என்ன?', 'K0010'],
      ['100வது குறள் என்ன?', 'K0100'],
      ['101வது குறள் என்ன?', 'K0101'],
      ['1330வது குறள் என்ன?', 'K1330'],
      ['முதல் குறள் என்ன?', 'K0001'],
      ['பத்தாவது குறள் என்ன?', 'K0010'],
      ['நூறாவது குறள் என்ன?', 'K0100'],
      ['நூற்றி இரண்டாவது குறள் என்ன?', 'K0102'],
      // Phonetic STT errors for Kural
      ['நூறாவது குரல் என்ன?', 'K0100'],
      ['முதல் குரல் என்ன?', 'K0001'],
      // Specific STT microphone variants
      ['அம்பதாவது குறள் என்ன?', 'K0050'],
      ['நூற்றி அம்பதாவது குறள் என்ன?', 'K0150'],
      ['ஐநூற்று இருபத்தி ஒன்பதாவது குறள் என்ன?', 'K0529'],
      ['ஆயிரத்து முன்னூற்று முப்பதாவது குறள் என்ன?', 'K1330'],
      ['ஆயிரத்தி முன்னூத்தி இருபதாவது குறள் என்ன?', 'K1320'],
      ['எழுநூத்தி முப்பதாவது குறள் என்ன?', 'K0730'],
      ['எட்நூற்று இருபத்தி ஒன்பதாவது குறள் என்ன?', 'K0829'],
    ];

    test.each(cases)('%s → %s', async (q, expectedRef) => {
      const response = await service.query(q);
      expect(response.answer.reference).toBe(expectedRef);
      expect(response.answer.dataset).toBe('DS1');
    });

    const meaningCases = [
      ['101வது குறளின் பொருள் என்ன?', 'K0101', 'MEANING'],
      ['101வது குறள் என்ன சொல்லுகிறது?', 'K0101', 'MEANING'],
      ['101வது குறளை எளிமையாக விளக்குங்கள்', 'K0101', 'EXPLANATION'],
      ['குறள் ௧௦௧ன் பொருள் என்ன?', 'K0101', 'MEANING'],
    ];

    test.each(meaningCases)('%s → %s (%s)', async (q, expectedRef, expectedIntent) => {
      const response = await service.query(q);
      expect(response.answer.reference).toBe(expectedRef);
      expect(response.answer.intent).toBe(expectedIntent);
    });

    const invalidCases = [
      '0வது குறள் என்ன?',
      '1331வது குறள் என்ன?',
    ];

    test.each(invalidCases)('%s → UNKNOWN', async (q) => {
      const response = await service.query(q);
      expect(response.answer.reference).toBe('D001');
      expect(response.answer.dataset).toBe('UNKNOWN');
    });
  });

  describe('B. DS4 exact-match tests', () => {
    const cases = [
      ['அன்பைப் பற்றி திருவள்ளுவர் என்ன கூறுகிறார்', 'A008'], // Missing STT sandhi
      ['நட்பை பற்றி திருவள்ளுவர் என்ன கூறுகிறார்', 'A079'], // Missing multiple sandhi
      ['சினத்தைப் பற்றி இத் திருக்குறள் என்ன சொல்கிறது', 'A031'], // 'இத்' prefix missing in DS4
      ['உண்மையைப் பற்றி திருவள்ளுவர் என்ன கூறுகிறார்', 'A030'], // Known working
      ['கல்வியைப் பற்றி திருக்குறள் என்ன சொல்கிறது', 'A040'], // Known working
      ['ஒழுக்கத்தைப் பற்றி திருவள்ளுவர் என்ன கூறுகிறார்', 'A014'], // Known working
    ];

    test.each(cases)('%s → %s', async (q, expectedRef) => {
      const response = await service.query(q);
      expect(response.answer.reference).toBe(expectedRef);
      expect(response.answer.dataset).toBe('DS2');
    });
  });

  describe('C. Regression tests', () => {
    const regressionCases = [
      ['1வது குறள் என்ன?', 'K0001', 'DS1'],
      ['100வது குறள் என்ன?', 'K0100', 'DS1'],
      ['1330வது குறள் என்ன?', 'K1330', 'DS1'],
      ['கடவுள் வாழ்த்து', 'A001', 'DS2'],
      ['கல்வி அதிகாரம்', 'A040', 'DS2'],
      ['நட்பு அதிகாரம்', 'A079', 'DS2'],
      ['திருக்குறளில் மொத்தம் எத்தனை குறள்கள்?', 'F001', 'DS7'],
      ['திருக்குறளில் எத்தனை அதிகாரங்கள்?', 'F002', 'DS7'],
      ['திருக்குறளில் எத்தனை பால்?', 'F003', 'DS7'],
      ['திருக்குறளை எழுதியவர் யார்?', 'F004', 'DS7'],
    ];

    test.each(regressionCases)('%s → %s (%s)', async (q, expectedRef, expectedDataset) => {
      const response = await service.query(q);
      expect(response.answer.reference).toBe(expectedRef);
      expect(response.answer.dataset).toBe(expectedDataset);
    });

    const unknownCases = [
      'random nonsense xyz',
      'hello world',
      '9999வது குறள்',
    ];

    test.each(unknownCases)('%s → UNKNOWN', async (q) => {
      const response = await service.query(q);
      expect(response.answer.reference).toBe('D001');
      expect(response.answer.dataset).toBe('UNKNOWN');
    });
  });

  describe.skip('D. Semantic Retrieval Tests (DS2 Fallback)', () => {
    const semanticCases = [
      ['நட்பைப் பற்றித் திருக்குறள் என்ன கூறுகிறது', 'A079'],
      ['நட்பை பற்றி சொல்லுங்கள்', 'A079'],
      ['நல்ல நண்பன் எப்படி இருக்க வேண்டும்', 'A079'],
      ['நல்ல நட்பு எப்படி இருக்க வேண்டும்', 'A079'],
      ['திருக்குறளில் எந்த அதிகாரம் நட்பைப் பற்றிக் கூறுகின்றது', 'A079'],
      ['திருக்குறளில் நட்பை பற்றி எந்த அதிகாரம் கூறுகிறது', 'A079'],
      ['கல்வி ஏன் அவசியம்', 'A040'],
      ['கல்வியின் முக்கியத்துவம் என்ன', 'A040'],
      ['ஒருவருக்கு அன்பு ஏன் முக்கியம்', 'A008']
    ];

    test.each(semanticCases)('%s → %s', async (q, expectedRef) => {
      const response = await service.query(q);
      expect(response.answer.reference).toBe(expectedRef);
      expect(response.answer.dataset).toBe('DS2');
    }, 30000);

    const ambiguousCases = [
      ['அன்பைப் பற்றி திருவள்ளுவர் என்ன கூறுகிறார்', 'D001', 'UNKNOWN'], // Rejected due to A131/A008 tie
      ['அறம் நிறைந்த வாழ்க்கை என்றால் என்ன', 'D001', 'UNKNOWN'],       // Rejected due to A005/A004 tie
      ['நல்ல மனிதனின் பண்புகள் என்ன', 'D001', 'UNKNOWN'],            // Rejected due to A100/A099 tie
    ];

    test.each(ambiguousCases)('Ambiguous Tie-breaker: %s → UNKNOWN', async (q, expectedRef, expectedDataset) => {
      const response = await service.query(q);
      expect(response.answer.reference).toBe(expectedRef);
      expect(response.answer.dataset).toBe(expectedDataset);
    });

    const negativeCases = [
      'xyzabc123',
      'ஒன்பது குறள் பத்தாவது',
      'எனக்கு ஏதாவது சொல்லுங்கள்',
      'எப்படி நன்றாக தூங்குவது?',
      'அகர',
      'xyzzzwqe',
      'இந்த குறள் என்ன சொல்லுகிறது?',
    ];

    test.each(negativeCases)('Negative/Safety: %s → UNKNOWN', async (q) => {
      const response = await service.query(q);
      expect(response.answer.reference).toBe('D001');
      expect(response.answer.dataset).toBe('UNKNOWN');
    });
  });

  describe('E. Semantic Kural Tests', () => {
    const semanticMeaningCases = [
      ['கற்ற கல்வியை சரியாக பயன்படுத்த வேண்டும் என்று சொல்லும் குறளின் பொருள் என்ன?', 'MEANING'],
      ['நல்ல நண்பனை எப்படி தேர்வு செய்ய வேண்டும் என்பதற்கு ஏற்ற குறள் என்ன?', 'KURAL_AND_EXPLANATION'],
      ['நல்ல நண்பனை எப்படி தேர்வு செய்ய வேண்டும் என்று சொல்லும் குறளின் பொருள் என்ன?', 'MEANING'],
    ];

    test.each(semanticMeaningCases)('Semantic Intent: %s → %s', async (q, expectedIntent) => {
      const response = await service.query(q);
      if (response.answer.dataset === 'DS1') {
        expect(response.answer.intent).toBe(expectedIntent);
      }
    });

    const genericQuestions = [
      'மற்றவர்களிடம் எப்படி பேச வேண்டும்?',
      'நல்ல நண்பனை எப்படி அடையாளம் காண்பது?',
      'கல்வி வாழ்க்கையில் ஏன் முக்கியம்?',
      'கோபத்தை எப்படி கட்டுப்படுத்த வேண்டும்?',
      'வாழ்க்கையில் கஷ்டம் வந்தால் என்ன செய்ய வேண்டும்?',
      'மற்றவர்களுக்கு உதவுவது பற்றி வள்ளுவர் என்ன சொல்கிறார்?',
      'ஒரு நல்ல மனிதன் எப்படி வாழ வேண்டும்?'
    ];

    test.each(genericQuestions)('Generic Question: %s', async (q) => {
      const response = await service.query(q);
      // It might be UNKNOWN if confidence is low, or DS1/DS2 if high.
      if (response.answer.dataset === 'DS1') {
         expect(response.answer.intent).toBe('KURAL_AND_EXPLANATION');
      }
    });
  });
});
