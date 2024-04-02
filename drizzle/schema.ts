import { createId } from '@paralleldrive/cuid2'
import { relations, sql } from 'drizzle-orm'
import { text, integer, pgTable, timestamp } from 'drizzle-orm/pg-core'

const createdAt = {
	createdAt: timestamp('created_at', {
		withTimezone: true,
		precision: 3,
		mode: 'string',
	})
		.notNull()
		.default(sql`now()`),
}

const updatedAt = {
	updatedAt: timestamp('updated_at', {
		withTimezone: true,
		precision: 3,
		mode: 'string',
	}),
}

export const users = pgTable('users', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => createId()),
	email: text('email').unique().notNull(),
	username: text('username').unique().notNull(),
	name: text('name'),

	...createdAt,
	...updatedAt,
})

export const userRelations = relations(users, ({ one, many }) => ({
	image: one(userImages, {
		fields: [users.id],
		references: [userImages.userId],
	}),
	password: one(passwords, {
		fields: [users.id],
		references: [passwords.userId],
	}),
	notes: many(notes),
	roles: many(userRoles),
	sessions: many(sessions),
	connections: many(connections),
}))

export const notes = pgTable('notes', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => createId()),
	title: text('title').notNull(),
	content: text('content').notNull(),

	ownerId: text('owner_id').references(() => users.id),

	...createdAt,
	...updatedAt,
})

export const noteRelations = relations(notes, ({ one, many }) => ({
	owner: one(users),
	images: many(noteImages),
}))

export const noteImages = pgTable('note_images', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => createId()),
	altText: text('alt_text'),
	contentType: text('content_type').notNull(),
	blob: text('blob').notNull(),

	...createdAt,
	...updatedAt,

	noteId: text('note_id')
		.notNull()
		.references(() => notes.id),
})

export const userImages = pgTable('user_images', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => createId()),
	userId: text('user_id').references(() => users.id, {
		onDelete: 'cascade',
	}),
	altText: text('alt_text'),
	contentType: text('content_type').notNull(),
	blob: text('blob').notNull(),

	...createdAt,
	...updatedAt,
})

export const passwords = pgTable('passwords', {
	hash: text('hash').notNull(),

	userId: text('user_id').references(() => users.id),
})

export const sessions = pgTable('sessions', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => createId()),
	expirationDate: timestamp('expires_at', {
		withTimezone: true,
		precision: 3,
		mode: 'string',
	}).notNull(),
	...createdAt,
	...updatedAt,

	userId: text('user_id')
		.notNull()
		.references(() => users.id),
})

export const sessionRelations = relations(sessions, ({ one }) => ({
	user: one(users),
}))

export const permissions = pgTable('permissions', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => createId()),
	action: text('action').notNull(),
	entity: text('entity').notNull(),
	access: text('access').notNull(),
	description: text('description').notNull().default(''),

	...createdAt,
	...updatedAt,
})

export const roles = pgTable('roles', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => createId()),
	name: text('name').unique().notNull(),
	description: text('description').notNull().default(''),

	...createdAt,
	...updatedAt,
})

export const rolePermissions = pgTable('role_permissions', {
	roleId: text('role_id')
		.notNull()
		.references(() => roles.id),
	permissionId: text('permission_id')
		.notNull()
		.references(() => permissions.id),
})

export const rolePermissionRelations = relations(
	rolePermissions,
	({ one }) => ({
		role: one(roles, {
			fields: [rolePermissions.roleId],
			references: [roles.id],
		}),
		permission: one(permissions, {
			fields: [rolePermissions.permissionId],
			references: [permissions.id],
		}),
	}),
)

export const roleRelations = relations(roles, ({ many }) => ({
	permissions: many(rolePermissions),
	users: many(userRoles),
}))

export const userRoles = pgTable('user_roles', {
	userId: text('user_id')
		.notNull()
		.references(() => users.id, {
			onDelete: 'cascade',
		}),
	roleId: text('role_id')
		.notNull()
		.references(() => roles.id, {
			onDelete: 'cascade',
		}),
})

export const userRolesRelations = relations(userRoles, ({ one }) => ({
	user: one(users, {
		fields: [userRoles.userId],
		references: [users.id],
	}),
	role: one(roles, {
		fields: [userRoles.roleId],
		references: [roles.id],
	}),
}))

export const verifications = pgTable('verifications', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => createId()),
	...createdAt,

	type: text('type').notNull(),
	secret: text('secret').notNull(),
	algorithm: text('algorithm').notNull(),
	digits: integer('digits').notNull(),
	period: integer('period').notNull(),
	charSet: text('char_set').notNull(),
	expiresAt: timestamp('expires_at', {
		withTimezone: true,
		precision: 3,
		mode: 'string',
	}),
})

export const connections = pgTable('connections', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => createId()),
	...createdAt,
	...updatedAt,

	providerName: text('provider_name').notNull(),
	providerId: text('provider_id').notNull(),

	userId: text('user_id')
		.notNull()
		.references(() => users.id),
})

export const connectionRelations = relations(connections, ({ one }) => ({
	user: one(users),
}))
