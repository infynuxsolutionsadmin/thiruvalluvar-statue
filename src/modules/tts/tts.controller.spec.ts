import { Test, TestingModule } from '@nestjs/testing';
import { TtsController } from './tts.controller';
import { TtsService } from './tts.service';
import type { Response } from 'express';

describe('TtsController', () => {
  let controller: TtsController;
  let ttsService: TtsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TtsController],
      providers: [
        {
          provide: TtsService,
          useValue: {
            synthesize: jest.fn().mockResolvedValue(Buffer.from('WAV_DATA')),
          },
        },
      ],
    }).compile();

    controller = module.get<TtsController>(TtsController);
    ttsService = module.get<TtsService>(TtsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return wav buffer and set correct headers', async () => {
    const res = {
      set: jest.fn(),
      send: jest.fn(),
    } as unknown as Response;

    await controller.synthesize({ text: 'test' }, res);

    expect(ttsService.synthesize).toHaveBeenCalledWith('test');
    expect(res.set).toHaveBeenCalledWith({
      'Content-Type': 'audio/wav',
      'Content-Length': Buffer.from('WAV_DATA').length,
    });
    expect(res.send).toHaveBeenCalledWith(Buffer.from('WAV_DATA'));
  });
});
