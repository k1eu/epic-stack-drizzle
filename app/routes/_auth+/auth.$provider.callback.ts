import { redirect, type LoaderFunctionArgs } from '@remix-run/node'
import { and, eq } from 'drizzle-orm'
import {
	authenticator,
	getSessionExpirationDate,
	getUserId,
} from '#app/utils/auth.server.ts'
import { ProviderNameSchema, providerLabels } from '#app/utils/connections.tsx'
import { db } from '#app/utils/db.server.ts'
import { combineHeaders } from '#app/utils/misc.tsx'
import {
	destroyRedirectToHeader,
	getRedirectCookieValue,
} from '#app/utils/redirect-cookie.server.ts'
import {
	createToastHeaders,
	redirectWithToast,
} from '#app/utils/toast.server.ts'
import { verifySessionStorage } from '#app/utils/verification.server.ts'
import { connections, sessions, users } from '#drizzle/schema.js'
import { handleNewSession } from './login.server.ts'
import { onboardingEmailSessionKey } from './onboarding.tsx'
import { prefilledProfileKey, providerIdKey } from './onboarding_.$provider.tsx'

const destroyRedirectTo = { 'set-cookie': destroyRedirectToHeader }

export async function loader({ request, params }: LoaderFunctionArgs) {
	const providerName = ProviderNameSchema.parse(params.provider)
	const redirectTo = getRedirectCookieValue(request)
	const label = providerLabels[providerName]

	const authResult = await authenticator
		.authenticate(providerName, request, { throwOnError: true })
		.then(
			data => ({ success: true, data }) as const,
			error => ({ success: false, error }) as const,
		)

	if (!authResult.success) {
		console.error(authResult.error)
		throw await redirectWithToast(
			'/login',
			{
				title: 'Auth Failed',
				description: `There was an error authenticating with ${label}.`,
				type: 'error',
			},
			{ headers: destroyRedirectTo },
		)
	}

	const { data: profile } = authResult

	const existingConnection = await db.query.connections.findFirst({
		where: and(
			eq(connections.providerName, providerName),
			eq(connections.providerId, profile.id),
		),
	})

	const userId = await getUserId(request)

	if (existingConnection && userId) {
		if (existingConnection.userId === userId) {
			return redirectWithToast(
				'/settings/profile/connections',
				{
					title: 'Already Connected',
					description: `Your "${profile.username}" ${label} account is already connected.`,
				},
				{ headers: destroyRedirectTo },
			)
		} else {
			return redirectWithToast(
				'/settings/profile/connections',
				{
					title: 'Already Connected',
					description: `The "${profile.username}" ${label} account is already connected to another account.`,
				},
				{ headers: destroyRedirectTo },
			)
		}
	}

	// If we're already logged in, then link the account
	if (userId) {
		await db.insert(connections).values({
			providerName,
			providerId: profile.id,
			userId,
		})
		return redirectWithToast(
			'/settings/profile/connections',
			{
				title: 'Connected',
				type: 'success',
				description: `Your "${profile.username}" ${label} account has been connected.`,
			},
			{ headers: destroyRedirectTo },
		)
	}

	// Connection exists already? Make a new session
	if (existingConnection) {
		return makeSession({ request, userId: existingConnection.userId })
	}

	// if the email matches a user in the db, then link the account and
	// make a new session
	const user = await db.query.users.findFirst({
		where: eq(users.email, profile.email.toLowerCase()),
		columns: {
			id: true,
		},
	})

	if (user) {
		await db.insert(connections).values({
			providerName,
			providerId: profile.id,
			userId: user.id,
		})
		return makeSession(
			{ request, userId: user.id },
			{
				headers: await createToastHeaders({
					title: 'Connected',
					description: `Your "${profile.username}" ${label} account has been connected.`,
				}),
			},
		)
	}

	// this is a new user, so let's get them onboarded
	const verifySession = await verifySessionStorage.getSession()
	verifySession.set(onboardingEmailSessionKey, profile.email)
	verifySession.set(prefilledProfileKey, {
		...profile,
		email: profile.email.toLowerCase(),
		username: profile.username?.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase(),
	})
	verifySession.set(providerIdKey, profile.id)
	const onboardingRedirect = [
		`/onboarding/${providerName}`,
		redirectTo ? new URLSearchParams({ redirectTo }) : null,
	]
		.filter(Boolean)
		.join('?')
	return redirect(onboardingRedirect, {
		headers: combineHeaders(
			{ 'set-cookie': await verifySessionStorage.commitSession(verifySession) },
			destroyRedirectTo,
		),
	})
}

async function makeSession(
	{
		request,
		userId,
		redirectTo,
	}: { request: Request; userId: string; redirectTo?: string | null },
	responseInit?: ResponseInit,
) {
	redirectTo ??= '/'
	const [session] = await db
		.insert(sessions)
		.values({
			userId,
			expirationDate: getSessionExpirationDate().toISOString(),
		})
		.returning({
			id: sessions.id,
			userId: sessions.userId,
			expirationDate: sessions.expirationDate,
		})

	const sessionParsed = {
		...session,
		expirationDate: new Date(session.expirationDate),
	}

	return handleNewSession(
		{ request, session: sessionParsed, redirectTo, remember: true },
		{ headers: combineHeaders(responseInit?.headers, destroyRedirectTo) },
	)
}
