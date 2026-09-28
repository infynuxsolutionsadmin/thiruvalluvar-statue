import { Controller, Post, Body, Res, HttpCode, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { TtsService } from './tts.service';

class SynthesizeDto {
  text: string;
}

@Controller('tts')
export class TtsController {
  constructor(private readonly ttsService: TtsService) {}

  @Post('synthesize')
  @HttpCode(HttpStatus.OK)
  async synthesize(@Body() body: SynthesizeDto, @Res() res: Response) {
    const wavBuffer = await this.ttsService.synthesize(body.text);

    res.set({
      'Content-Type': 'audio/wav',
      'Content-Length': wavBuffer.length,
    });
    
    res.send(wavBuffer);
  }
}
