/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { configureHttpApp, setupSwagger } from '../src/config/app.setup';

interface OpenApiSchema {
  $ref?: string;
  properties?: Record<string, OpenApiSchema>;
}

function resolveSchema(
  schema: OpenApiSchema,
  schemas: Record<string, OpenApiSchema>,
): OpenApiSchema {
  if (!schema.$ref) {
    return schema;
  }

  const schemaName = schema.$ref.split('/').at(-1);
  if (!schemaName || !schemas[schemaName]) {
    throw new Error(`Unable to resolve OpenAPI schema reference: ${schema.$ref}`);
  }

  return schemas[schemaName];
}

describe('health endpoint', () => {
  let app: INestApplication;
  const queryRaw = jest.fn();

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({ $queryRaw: queryRaw })
      .compile();

    app = module.createNestApplication();
    configureHttpApp(app, { apiPrefix: 'api', corsOrigin: 'http://localhost:3000' });
    setupSwagger(app);
    await app.init();
  });

  beforeEach(() => {
    queryRaw.mockReset();
  });

  afterAll(async () => {
    await app.close();
  });

  it('is public and returns the exact successful Contract envelope without double wrapping', async () => {
    queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    const response = await request(app.getHttpServer()).get('/api/health').expect(200);

    expect(response.body).toEqual({
      success: true,
      statusCode: 200,
      message: 'SweetHome Backend v2 is healthy',
      data: {
        status: 'UP',
        database: 'CONNECTED',
        version: '2.0.0',
      },
      timestamp: expect.any(String),
    });
    expect(response.body.data.data).toBeUndefined();
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it('returns a safe 503 envelope when the database is unavailable', async () => {
    const databaseUrl = 'postgresql://sweethome_user:secret@db.internal:5432/sweethome';
    queryRaw.mockRejectedValue(new Error(`Connection refused: ${databaseUrl}`));

    const response = await request(app.getHttpServer()).get('/api/health').expect(503);

    expect(response.body).toEqual(
      expect.objectContaining({
        success: false,
        statusCode: 503,
        error: 'Internal Server Error',
        message: 'Đã xảy ra lỗi nội bộ. Vui lòng thử lại sau.',
        details: [],
        path: '/api/health',
        timestamp: expect.any(String),
      }),
    );
    expect(JSON.stringify(response.body)).not.toContain(databaseUrl);
  });

  it('documents the Contract response schemas and 503 response in Swagger', async () => {
    const response = await request(app.getHttpServer()).get('/api/docs-json').expect(200);
    const operation = response.body.paths['/api/health'].get;
    const schemas = response.body.components.schemas as Record<string, OpenApiSchema>;
    const responseSchema = resolveSchema(
      operation.responses['200'].content['application/json'].schema as OpenApiSchema,
      schemas,
    );
    const dataSchema = resolveSchema(responseSchema.properties?.data as OpenApiSchema, schemas);

    expect(operation.responses).toEqual(
      expect.objectContaining({
        '200': expect.any(Object),
        '503': expect.any(Object),
      }),
    );
    expect(schemas.HealthResponseDto).toBeDefined();
    expect(responseSchema).toEqual(schemas.HealthResponseDto);
    expect(responseSchema.properties).toEqual(
      expect.objectContaining({
        success: expect.any(Object),
        statusCode: expect.any(Object),
        message: expect.any(Object),
        data: expect.any(Object),
        timestamp: expect.any(Object),
      }),
    );
    expect(schemas.HealthDataDto).toBeDefined();
    expect(dataSchema).toEqual(schemas.HealthDataDto);
    expect(dataSchema.properties).toEqual(
      expect.objectContaining({
        status: expect.any(Object),
        database: expect.any(Object),
        version: expect.any(Object),
      }),
    );
  });
});
