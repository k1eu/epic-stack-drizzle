import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { eq } from 'drizzle-orm'
import { requireUserId } from '#app/utils/auth.server.ts'
import { db } from '#app/utils/db.server.ts'
import { getDomainUrl } from '#app/utils/misc.tsx'
import { users } from '#drizzle/schema.js'

export async function loader({ request }: LoaderFunctionArgs) {
	const userId = await requireUserId(request)

	const user = await db.query.users.findFirst({
		where: eq(users.id, userId),
		columns: {
			id: true,
			name: true,
			username: true,
			email: true,
		},
		with: {
			image: {
				columns: {
					id: true,
					createdAt: true,
					updatedAt: true,
					contentType: true,
				},
			},
			notes: {
				with: {
					images: {
						columns: {
							id: true,
							createdAt: true,
							updatedAt: true,
							contentType: true,
						},
					},
				},
			},
			sessions: true,
			roles: {
				with: {
					role: true,
				},
			},
		},
	})

	if (!user) {
		throw new Error('User not found')
	}

	const domain = getDomainUrl(request)

	return json({
		user: {
			...user,
			image: user.image
				? {
						...user.image,
						url: `${domain}/resources/user-images/${user.image.id}`,
					}
				: null,
			notes: user.notes.map(note => ({
				...note,
				images: note.images.map(image => ({
					...image,
					url: `${domain}/resources/note-images/${image.id}`,
				})),
			})),
		},
	})
}
