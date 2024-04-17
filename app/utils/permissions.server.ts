import { json } from '@remix-run/node'
import { and, eq, inArray } from 'drizzle-orm'
import { permissions, roles, users } from '#drizzle/schema.js'
import { requireUserId } from './auth.server.ts'
import { db } from './db.server.ts'
import { type PermissionString, parsePermissionString } from './user.ts'

export async function requireUserWithPermission(
	request: Request,
	permission: PermissionString,
) {
	const userId = await requireUserId(request)
	const permissionData = parsePermissionString(permission)

	const user = await db.query.users.findFirst({
		columns: {
			id: true,
		},
		with: {
			roles: {
				with: {
					role: {
						with: {
							permissions: true,
						},
					},
				},
			},
		},
		where: and(
			eq(users.id, userId),
			eq(permissions.action, permissionData.action),
			eq(permissions.entity, permissionData.entity),
			permissionData.access
				? inArray(permissions.access, permissionData.access)
				: undefined,
		),
	})

	if (!user || user.roles.some(role => role.role.permissions.length)) {
		throw json(
			{
				error: 'Unauthorized',
				requiredPermission: permissionData,
				message: `Unauthorized: required permissions: ${permission}`,
			},
			{ status: 403 },
		)
	}
	return user.id
}

export async function requireUserWithRole(request: Request, name: string) {
	const userId = await requireUserId(request)

	const user = await db.query.users.findFirst({
		columns: {
			id: true,
		},
		with: {
			roles: {
				with: {
					role: true,
				},
			},
		},
		where: and(eq(users.id, userId), eq(roles.name, name)),
	})

	console.log({ user })
	if (!user) {
		throw json(
			{
				error: 'Unauthorized',
				requiredRole: name,
				message: `Unauthorized: required role: ${name}`,
			},
			{ status: 403 },
		)
	}
	return user.id
}
