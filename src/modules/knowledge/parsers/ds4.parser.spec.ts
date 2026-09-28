import { Test, TestingModule } from '@nestjs/testing';
import { Ds4ParserService } from './ds4.parser';

describe('Ds4ParserService Robustness', () => {
  let service: Ds4ParserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [Ds4ParserService],
    }).compile();

    service = module.get<Ds4ParserService>(Ds4ParserService);
    service.onModuleInit();
  });

  it('should match STT output with punctuation', () => {
    const stt = 'அன்பைப் பற்றித் திருவள்ளுவர் என்ன கூறுகிறார்?';
    expect(service.getReference(stt)).toBe('A008');
  });

  it('should match STT output with zero-width joiners', () => {
    const stt = 'அன்பைப் பற்றித்\u200D திருவள்ளுவர் என்ன கூறுகிறார்';
    expect(service.getReference(stt)).toBe('A008');
  });

  it('should match STT output with NFC vs NFD differences', () => {
    const stt = 'அன்பைப் பற்றித் திருவள்ளுவர் என்ன கூறுகிறார்'.normalize('NFD');
    expect(service.getReference(stt)).toBe('A008');
  });
});
