import { Injectable, Logger, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

@Injectable()
export class TtsService {
  private readonly logger = new Logger(TtsService.name);
  private piperExecutable: string;
  private piperModel: string;

  constructor() {
    this.piperExecutable = process.env.PIPER_EXECUTABLE_PATH || 'piper';
    
    // Resolve relative path if needed based on CWD
    const configuredModelPath = process.env.PIPER_MODEL_PATH;
    if (configuredModelPath) {
        this.piperModel = path.resolve(process.cwd(), configuredModelPath);
    }
  }

  /**
   * Synthesize Tamil text to WAV buffer using Piper TTS.
   */
  async synthesize(text: string): Promise<Buffer> {
    if (!text || text.trim() === '') {
      throw new BadRequestException('Text is required for TTS synthesis');
    }

    if (!this.piperModel) {
      throw new InternalServerErrorException('Piper model path is not configured (PIPER_MODEL_PATH)');
    }

    const start = performance.now();
    const tempDir = os.tmpdir();
    const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const inputTxtPath = path.join(tempDir, `piper_input_${uniqueId}.txt`);
    const outputWavPath = path.join(tempDir, `piper_output_${uniqueId}.wav`);

    try {
      // Write text to a temporary file (UTF-8)
      fs.writeFileSync(inputTxtPath, text, { encoding: 'utf8' });

      // Build the piper command
      // -m model, -i input text file, -f output wav file
      const command = `"${this.piperExecutable}" -m "${this.piperModel}" -i "${inputTxtPath}" -f "${outputWavPath}"`;

      // Execute piper
      await execAsync(command);

      // Verify output file exists
      if (!fs.existsSync(outputWavPath)) {
        throw new Error('Piper executed but WAV file was not created');
      }

      // Read the generated WAV into a buffer
      const wavBuffer = fs.readFileSync(outputWavPath);

      const latency = performance.now() - start;
      this.logger.log(`Piper synthesis completed in ${latency.toFixed(2)}ms. Text length: ${text.length}. Buffer size: ${wavBuffer.length} bytes`);

      return wavBuffer;

    } catch (error) {
      this.logger.error(`Piper synthesis failed: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Speech synthesis failed');
    } finally {
      // Clean up temporary files
      if (fs.existsSync(inputTxtPath)) {
        fs.unlinkSync(inputTxtPath);
      }
      if (fs.existsSync(outputWavPath)) {
        fs.unlinkSync(outputWavPath);
      }
    }
  }
}
