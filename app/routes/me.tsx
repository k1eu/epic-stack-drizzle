import { redirect, type LoaderFunctionArgs } from '@remix-run/node'
import { eq } from 'drizzle-orm'
import { requireUserId, logout } from '#app/utils/auth.server.ts'
import { db } from '#app/utils/db.server.ts'
import { users } from '#drizzle/schema'

export async function loader({ request }: LoaderFunctionArgs) {
	const userId = await requireUserId(request)
	const user = await db.query.users.findFirst({
		where: eq(users.id, userId),
	})
	
	if (!user) {
		const requestUrl = new URL(request.url)
		const loginParams = new URLSearchParams([
			['redirectTo', `${requestUrl.pathname}${requestUrl.search}`],
		])
		const redirectTo = `/login?${loginParams}`
		await logout({ request, redirectTo })
		return redirect(redirectTo)
	}
	return redirect(`/users/${user.username}`)
}
