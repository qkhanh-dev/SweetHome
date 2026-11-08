import { ApiProperty } from '@nestjs/swagger';

export class HealthDataDto {
  @ApiProperty({ example: 'UP' })
  status!: 'UP';

  @ApiProperty({ example: 'CONNECTED' })
  database!: 'CONNECTED';

  @ApiProperty({ example: '2.0.0' })
  version!: '2.0.0';
}

export class HealthResponseDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 200 })
  statusCode!: 200;

  @ApiProperty({ example: 'SweetHome Backend v2 is healthy' })
  message!: 'SweetHome Backend v2 is healthy';

  @ApiProperty({ type: HealthDataDto })
  data!: HealthDataDto;

  @ApiProperty({ example: '2026-11-06T08:00:00.000Z', format: 'date-time' })
  timestamp!: string;
}
