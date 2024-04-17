import { type Config } from 'drizzle-kit'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
	throw new Error('DATABASE_URL environment variable is missing')
}

export default {
	schema: './drizzle/schema.ts',
	out: './drizzle',
	driver: 'pg',
	dbCredentials: {
		connectionString,
	},
} satisfies Config
