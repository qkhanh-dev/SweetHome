/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { Body, Controller, INestApplication, Post } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Type } from 'class-transformer';
import { IsEmail, IsInt } from 'class-validator';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureHttpApp, setupSwagger } from '../src/config/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';

class ValidationTestDto {
  @IsEmail()
  email!: string;

  @Type(() => Number)
  @IsInt()
  age!: number;
}

@Controller('test-internal')
class TestOnlyController {
  @Post('validation')
  validate(@Body() dto: ValidationTestDto): ValidationTestDto {
    return dto;
  }
}

describe('global HTTP configuration', () => {
  let app: INestApplication;
  const allowedOrigin = 'http://localhost:3000';

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [TestOnlyController],
    })
      .overrideProvider(PrismaService)
      .useValue({ $disconnect: jest.fn().mockResolvedValue(undefined) })
      .compile();

    app = module.createNestApplication();
    configureHttpApp(app, { apiPrefix: 'api', corsOrigin: allowedOrigin });
    setupSwagger(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('accepts a valid DTO and transforms values', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/test-internal/validation')
      .send({ email: 'guest@example.com', age: '21' })
      .expect(201);

    expect(response.body).toEqual(
      expect.objectContaining({
        success: true,
        statusCode: 201,
        data: { email: 'guest@example.com', age: 21 },
      }),
    );
  });

  it('rejects invalid and non-whitelisted DTO fields with the Contract error envelope', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/test-internal/validation')
      .send({ email: 'invalid-email', age: 'not-a-number', unexpected: true })
      .expect(400);

    expect(response.body).toEqual(
      expect.objectContaining({
        success: false,
        statusCode: 400,
        message: 'Dữ liệu đầu vào không hợp lệ',
        path: '/api/test-internal/validation',
        details: expect.arrayContaining([
          'property unexpected should not exist',
          'email must be an email',
          'age must be an integer number',
        ]),
      }),
    );
  });

  it('serves Swagger at /api/docs without a duplicated prefix', async () => {
    const uiResponse = await request(app.getHttpServer()).get('/api/docs').expect(200);
    const documentResponse = await request(app.getHttpServer()).get('/api/docs-json').expect(200);
    await request(app.getHttpServer()).get('/api/api/docs').expect(404);

    expect(uiResponse.text).toContain('swagger-ui');
    expect(documentResponse.body.info.title).toBe('SweetHome API');
    expect(documentResponse.body.info.version).toBe('2.0.0');
  });

  it('sends CORS headers only for an allowed origin', async () => {
    const allowedResponse = await request(app.getHttpServer())
      .get('/api/docs')
      .set('Origin', allowedOrigin)
      .expect(200);
    const disallowedResponse = await request(app.getHttpServer())
      .get('/api/docs')
      .set('Origin', 'https://untrusted.example')
      .expect(200);

    expect(allowedResponse.headers['access-control-allow-origin']).toBe(allowedOrigin);
    expect(allowedResponse.headers['access-control-allow-credentials']).toBe('true');
    expect(disallowedResponse.headers['access-control-allow-origin']).toBeUndefined();
  });
});
