import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { KnowledgeService } from './knowledge.service';

class QueryDto {
  query: string;
}

@Controller({ path: 'knowledge', version: '1' })
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  /**
   * POST /api/v1/knowledge/query
   * Body: { "query": "101வது குறளின் பொருள் என்ன?" }
   */
  @Post('query')
  @HttpCode(200)
  async query(@Body() dto: QueryDto) {
    return await this.knowledgeService.query(dto.query ?? '');
  }
}
