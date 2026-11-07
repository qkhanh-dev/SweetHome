import path from 'path';
import dotenv from 'dotenv';
import { defineConfig } from 'prisma/config';

dotenv.config({ path: [path.resolve(__dirname, '../.env'), path.resolve(__dirname, '.env')] });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL || 'postgresql://sweethome_user:sweethome_secret_2026@localhost:5432/sweethome_db?schema=public',
  },
});
