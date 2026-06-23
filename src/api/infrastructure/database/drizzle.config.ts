import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  out: './src/api/infrastructure/database/migrations',
  schema: './src/api/infrastructure/database/model/**/*.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: Bun.env.DATABASE_URL as string,
  },
  casing: 'snake_case',
})
