import { invariant } from '@epic-web/invariant'
import * as E from '@react-email/components'
import { json } from '@remix-run/node'
import { eq } from 'drizzle-orm'
import {
	requireRecentVerification,
	type VerifyFunctionArgs,
} from '#app/routes/_auth+/verify.server.ts'
import { db } from '#app/utils/db.server.ts'
import { sendEmail } from '#app/utils/email.server.ts'
import { redirectWithToast } from '#app/utils/toast.server.ts'
import { verifySessionStorage } from '#app/utils/verification.server.ts'
import { users } from '#drizzle/schema.js'
import { newEmailAddressSessionKey } from './profile.change-email'

export async function handleVerification({
	request,
	submission,
}: VerifyFunctionArgs) {
	await requireRecentVerification(request)
	invariant(
		submission.status === 'success',
		'Submission should be successful by now',
	)

	const verifySession = await verifySessionStorage.getSession(
		request.headers.get('cookie'),
	)
	const newEmail = verifySession.get(newEmailAddressSessionKey)
	if (!newEmail) {
		return json(
			{
				result: submission.reply({
					formErrors: [
						'You must submit the code on the same device that requested the email change.',
					],
				}),
			},
			{ status: 400 },
		)
	}

	const preUpdateUser = await db.query.users.findFirst({
		where: eq(users.id, submission.value.target),
		columns: { email: true },
	})

	if (!preUpdateUser) {
		throw new Error('User not found')
	}

	const [user] = await db
		.update(users)
		.set({ email: newEmail })
		.where(eq(users.id, submission.value.target))
		.returning({
			id: users.id,
			email: users.email,
			username: users.username,
		})

	if (!user) {
		throw new Error('User not found')
	}

	void sendEmail({
		to: preUpdateUser.email,
		subject: 'Epic Stack email changed',
		react: <EmailChangeNoticeEmail userId={user.id} />,
	})

	return redirectWithToast(
		'/settings/profile',
		{
			title: 'Email Changed',
			type: 'success',
			description: `Your email has been changed to ${user.email}`,
		},
		{
			headers: {
				'set-cookie': await verifySessionStorage.destroySession(verifySession),
			},
		},
	)
}

export function EmailChangeEmail({
	verifyUrl,
	otp,
}: {
	verifyUrl: string
	otp: string
}) {
	return (
		<E.Html lang="en" dir="ltr">
			<E.Container>
				<h1>
					<E.Text>Epic Notes Email Change</E.Text>
				</h1>
				<p>
					<E.Text>
						Here's your verification code: <strong>{otp}</strong>
					</E.Text>
				</p>
				<p>
					<E.Text>Or click the link:</E.Text>
				</p>
				<E.Link href={verifyUrl}>{verifyUrl}</E.Link>
			</E.Container>
		</E.Html>
	)
}

function EmailChangeNoticeEmail({ userId }: { userId: string }) {
	return (
		<E.Html lang="en" dir="ltr">
			<E.Container>
				<h1>
					<E.Text>Your Epic Notes email has been changed</E.Text>
				</h1>
				<p>
					<E.Text>
						We're writing to let you know that your Epic Notes email has been
						changed.
					</E.Text>
				</p>
				<p>
					<E.Text>
						If you changed your email address, then you can safely ignore this.
						But if you did not change your email address, then please contact
						support immediately.
					</E.Text>
				</p>
				<p>
					<E.Text>Your Account ID: {userId}</E.Text>
				</p>
			</E.Container>
		</E.Html>
	)
}
