import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from './app.module';

describe('AppModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
  });

  afterEach(async () => {
    await module.close();
  });

  it('compiles', () => {
    expect(module).toBeDefined();
  });

  it('keeps ConfigModule available', () => {
    expect(module.get(ConfigService)).toBeInstanceOf(ConfigService);
  });
});
