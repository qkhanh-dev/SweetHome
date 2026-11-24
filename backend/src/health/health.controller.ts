import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { HealthResponseDto } from './dto/health-response.dto';
import { HealthService } from './health.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Kiểm tra trạng thái Backend và Database' })
  @ApiOkResponse({
    description: 'Backend và Database hoạt động bình thường.',
    type: HealthResponseDto,
  })
  @ApiServiceUnavailableResponse({
    description: 'Database không khả dụng. Response dùng global error envelope.',
  })
  async getHealth(): Promise<HealthResponseDto> {
    return {
      success: true,
      statusCode: HttpStatus.OK,
      message: 'SweetHome Backend v2 is healthy',
      data: await this.healthService.check(),
      timestamp: new Date().toISOString(),
    };
  }
}
