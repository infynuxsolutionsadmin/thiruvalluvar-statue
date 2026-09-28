import { Test, TestingModule } from '@nestjs/testing';
import { TtsService } from './tts.service';
import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import * as fs from 'fs';
import * as child_process from 'child_process';

jest.mock('child_process', () => ({
  exec: jest.fn((cmd, cb) => cb(null, { stdout: '', stderr: '' }))
}));

jest.mock('fs', () => ({
  writeFileSync: jest.fn(),
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  unlinkSync: jest.fn(),
}));

describe('TtsService', () => {
  let service: TtsService;
  const originalEnv = process.env;

  beforeEach(async () => {
    process.env = {
        ...originalEnv,
        PIPER_EXECUTABLE_PATH: 'piper',
        PIPER_MODEL_PATH: 'test_model.onnx'
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [TtsService],
    }).compile();

    service = module.get<TtsService>(TtsService);
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should reject empty text', async () => {
    await expect(service.synthesize('')).rejects.toThrow(BadRequestException);
    await expect(service.synthesize('   ')).rejects.toThrow(BadRequestException);
  });

  it('should execute piper and return buffer', async () => {
    const text = 'திருக்குறள்';
    
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue(Buffer.from('RIFF_FAKE_WAV'));

    const buffer = await service.synthesize(text);

    expect(fs.writeFileSync).toHaveBeenCalled();
    expect(child_process.exec).toHaveBeenCalled();
    expect(fs.readFileSync).toHaveBeenCalled();
    expect(fs.unlinkSync).toHaveBeenCalledTimes(2); // cleanup txt and wav
    
    expect(buffer).toBeDefined();
    expect(buffer.toString()).toBe('RIFF_FAKE_WAV');
  });

  it('should throw InternalServerErrorException if Piper fails to create wav', async () => {
    const text = 'test text';
    
    // Simulate failure where output wav is NOT created
    (fs.existsSync as jest.Mock).mockImplementation((path: any) => {
        if (path.endsWith('.wav')) return false; // output file not found
        if (path.endsWith('.txt')) return true;  // input file found for cleanup
        return false;
    });

    await expect(service.synthesize(text)).rejects.toThrow(InternalServerErrorException);
  });
});
