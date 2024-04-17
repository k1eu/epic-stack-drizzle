import { remember } from '@epic-web/remember'
// import { PrismaClient } from '@prisma/client'
// import chalk from 'chalk'
import { type PostgresJsDatabase, drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '#drizzle/schema'
import 'dotenv/config'

export type ApplicationDatabase = PostgresJsDatabase<typeof schema>

export const db = remember('drizzle', () => {
	// NOTE: if you change anything in this function you'll need to restart
	// the dev server to see your changes.

	// Feel free to change this log threshold to something that makes sense for you
	// const logThreshold = 20
	const queryClient = postgres(process.env.DATABASE_URL)
	const db = drizzle(queryClient, {
		schema,
	})
	return db
})
