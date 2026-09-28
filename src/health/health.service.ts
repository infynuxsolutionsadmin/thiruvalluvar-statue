import { Injectable } from '@nestjs/common';

@Injectable()
export class HealthService {
  check() {
    return {
      status: 'ok',
      service: 'thiruvalluvar-backend',
      version: '1.0.0',
    };
  }
}
