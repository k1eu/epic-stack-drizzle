import { faker } from '@faker-js/faker'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { promiseHash } from 'remix-utils/promise'
import * as schema from '#drizzle/schema'
import {
	passwords,
	permissions,
	rolePermissions,
	roles,
	users,
	userImages as userImagesTable,
	noteImages as noteImagesTable,
	userRoles,
	notes,
	connections,
} from '#drizzle/schema'
import {
	cleanupDb,
	createPassword,
	createUser,
	getNoteImages,
	getUserImages,
	img,
} from '#tests/db-utils.ts'
import { insertGitHubUser } from '#tests/mocks/github.ts'

import 'dotenv/config'

async function seed() {
	if (!process.env.DATABASE_URL) {
		throw new Error('DATABASE_URL environment variable is missing')
	}

	console.log({ test: process.env.DATABASE_URL })

	debugger

	const client = postgres(process.env.DATABASE_URL, {
		max: 1,
	})
	const db = drizzle(client, { logger: false, schema })

	console.log('🌱 Seeding...')
	console.time(`🌱 Database has been seeded`)

	console.time('🧹 Cleaned up the database...')
	await cleanupDb(db)

	console.timeEnd('🧹 Cleaned up the database...')

	console.time('🔑 Created permissions...')
	const entities = ['user', 'note']
	const actions = ['create', 'read', 'update', 'delete']
	const accesses = ['own', 'any'] as const
	for (const entity of entities) {
		for (const action of actions) {
			for (const access of accesses) {
				await db.insert(permissions).values({
					entity,
					action,
					access,
				})
			}
		}
	}
	console.timeEnd('🔑 Created permissions...')

	console.time('👑 Created roles...')
	const [adminRole] = await db
		.insert(roles)
		.values({
			name: 'admin',
		})
		.returning()

	const permissionsDataAny = await db.query.permissions.findMany({
		where: eq(permissions.access, 'any'),
	})

	await Promise.all(
		permissionsDataAny.map(async permission => {
			await db.insert(rolePermissions).values({
				roleId: adminRole.id,
				permissionId: permission.id,
			})
		}),
	)

	const [userRole] = await db
		.insert(roles)
		.values({
			name: 'user',
		})
		.returning()

	const permissionsDataOwn = await db.query.permissions.findMany({
		where: eq(permissions.access, 'any'),
	})

	await Promise.all(
		permissionsDataOwn.map(async permission => {
			await db.insert(rolePermissions).values({
				roleId: userRole.id,
				permissionId: permission.id,
			})
		}),
	)

	console.timeEnd('👑 Created roles...')

	const totalUsers = 5
	console.time(`👤 Created ${totalUsers} users...`)
	const noteImages = await getNoteImages()
	const userImages = await getUserImages()

	for (let index = 0; index < totalUsers; index++) {
		const userData = createUser()

		console.log(index, userData)

		const [user] = await db
			.insert(users)
			.values({
				email: userData.email,
				username: userData.username,
				name: userData.name,
			})
			.returning()

		await db.insert(passwords).values({
			userId: user.id,
			...createPassword(userData.username),
		})

		// await db.insert(userImagesTable).values({
		// 	userId: user.id,
		// 	blob: 'string',
		// 	contentType: userImages[index % userImages.length].contentType,
		// })

		await db.insert(userRoles).values({
			roleId: userRole.id,
			userId: user.id,
		})

		const notesNumber = Array.from({
			length: faker.number.int({ min: 1, max: 3 }),
		})

		await Promise.all(
			notesNumber.map(async () => {
				await db.insert(notes).values({
					ownerId: user.id,
					title: faker.lorem.sentence(),
					content: faker.lorem.paragraphs(),
				})
			}),
		)

		// const imagesNumber = Array.from({
		// 	length: faker.number.int({ min: 1, max: 3 }),
		// })

		// await Promise.all(
		// 	imagesNumber.map(async (_,index) => {
		// 		await db.insert(noteImagesTable).values({
		// 			noteId: user.id,
		// 			altText: faker.lorem.sentence(),
		// 			contentType: noteImages[index].contentType,
		// 			blob: noteImages[index].blob,
		// 		})
		// 	}),
		// )

		console.timeEnd(`👤 Created ${totalUsers} users...`)
	}

	const kodyImages = await promiseHash({
		kodyUser: img({ filepath: './tests/fixtures/images/user/kody.png' }),
		cuteKoala: img({
			altText: 'an adorable koala cartoon illustration',
			filepath: './tests/fixtures/images/kody-notes/cute-koala.png',
		}),
		koalaEating: img({
			altText: 'a cartoon illustration of a koala in a tree eating',
			filepath: './tests/fixtures/images/kody-notes/koala-eating.png',
		}),
		koalaCuddle: img({
			altText: 'a cartoon illustration of koalas cuddling',
			filepath: './tests/fixtures/images/kody-notes/koala-cuddle.png',
		}),
		mountain: img({
			altText: 'a beautiful mountain covered in snow',
			filepath: './tests/fixtures/images/kody-notes/mountain.png',
		}),
		koalaCoder: img({
			altText: 'a koala coding at the computer',
			filepath: './tests/fixtures/images/kody-notes/koala-coder.png',
		}),
		koalaMentor: img({
			altText:
				'a koala in a friendly and helpful posture. The Koala is standing next to and teaching a woman who is coding on a computer and shows positive signs of learning and understanding what is being explained.',
			filepath: './tests/fixtures/images/kody-notes/koala-mentor.png',
		}),
		koalaSoccer: img({
			altText: 'a cute cartoon koala kicking a soccer ball on a soccer field ',
			filepath: './tests/fixtures/images/kody-notes/koala-soccer.png',
		}),
	})

	const githubUser = await insertGitHubUser('MOCK_CODE_GITHUB_KODY')
	const [kody] = await db
		.insert(users)
		.values({
			email: 'kody@kcd.dev',
			username: 'kody',
			name: 'Kody',
		})
		.returning()

	await db.insert(passwords).values({
		userId: kody.id,
		...createPassword('kodylovesyou'),
	})

	await db.insert(connections).values({
		providerId: githubUser.profile.id,
		providerName: 'github',
		userId: kody.id,
	})

	await db.insert(userRoles).values([
		{
			roleId: adminRole.id,
			userId: kody.id,
		},
		{
			roleId: userRole.id,
			userId: kody.id,
		},
	])

	await db.insert(notes).values([
		{
			id: 'd27a197e',
			ownerId: kody.id,
			title: 'Basic Koala Facts',
			content:
				'Koalas are found in the eucalyptus forests of eastern Australia. They have grey fur with a cream-coloured chest, and strong, clawed feet, perfect for living in the branches of trees!',
		},
		{
			id: '414f0c09',
			ownerId: kody.id,
			title: 'Koalas like to cuddle',
			content:
				'Cuddly critters, koalas measure about 60cm to 85cm long, and weigh about 14kg.',
		},
		{
			id: '260366b1',
			ownerId: kody.id,
			title: 'Not bears',
			content:
				"Although you may have heard people call them koala 'bears', these awesome animals aren’t bears at all – they are in fact marsupials. A group of mammals, most marsupials have pouches where their newborns develop.",
		},
		{
			id: 'bb79cf45',
			ownerId: kody.id,
			title: 'Snowboarding Adventure',
			content:
				"Today was an epic day on the slopes! Shredded fresh powder with my friends, caught some sick air, and even attempted a backflip. Can't wait for the next snowy adventure!",
		},
		{
			id: '9f4308be',
			ownerId: kody.id,
			title: 'Onewheel Tricks',
			content:
				"Mastered a new trick on my Onewheel today called '180 Spin'. It's exhilarating to carve through the streets while pulling off these rad moves. Time to level up and learn more!",
		},
		{
			id: '306021fb',
			ownerId: kody.id,
			title: 'Coding Dilemma',
			content:
				"Stuck on a bug in my latest coding project. Need to figure out why my function isn't returning the expected output. Time to dig deep, debug, and conquer this challenge!",
		},
		{
			id: '16d4912a',
			ownerId: kody.id,
			title: 'Coding Mentorship',
			content:
				"Had a fantastic coding mentoring session today with Sarah. Helped her understand the concept of recursion, and she made great progress. It's incredibly fulfilling to help others improve their coding skills.",
		},
		{
			id: '3199199e',
			ownerId: kody.id,
			title: 'Koala Fun Facts',
			content:
				"Did you know that koalas sleep for up to 20 hours a day? It's because their diet of eucalyptus leaves doesn't provide much energy. But when I'm awake, I enjoy munching on leaves, chilling in trees, and being the cuddliest koala around!",
		},
		{
			id: '2030ffd3',
			ownerId: kody.id,
			title: 'Skiing Adventure',
			content:
				'Spent the day hitting the slopes on my skis. The fresh powder made for some incredible runs and breathtaking views. Skiing down the mountain at top speed is an adrenaline rush like no other!',
		},
		{
			id: 'f375a804',
			ownerId: kody.id,
			title: 'Code Jam Success',
			content:
				'Participated in a coding competition today and secured the first place! The adrenaline, the challenging problems, and the satisfaction of finding optimal solutions—it was an amazing experience. Feeling proud and motivated to keep pushing my coding skills further!',
		},
		{
			id: '562c541b',
			ownerId: kody.id,
			title: 'Koala Conservation Efforts',
			content:
				"Joined a local conservation group to protect koalas and their habitats. Together, we're planting more eucalyptus trees, raising awareness about their endangered status, and working towards a sustainable future for these adorable creatures. Every small step counts!",
		},
		// extra long note to test scrolling
		{
			id: 'f67ca40b',
			ownerId: kody.id,
			title: 'Game day',
			content:
				"Just got back from the most amazing game. I've been playing soccer for a long time, but I've not once scored a goal. Well, today all that changed! I finally scored my first ever goal.\n\nI'm in an indoor league, and my team's not the best, but we're pretty good and I have fun, that's all that really matters. Anyway, I found myself at the other end of the field with the ball. It was just me and the goalie. I normally just kick the ball and hope it goes in, but the ball was already rolling toward the goal. The goalie was about to get the ball, so I had to charge. I managed to get possession of the ball just before the goalie got it. I brought it around the goalie and had a perfect shot. I screamed so loud in excitement. After all these years playing, I finally scored a goal!\n\nI know it's not a lot for most folks, but it meant a lot to me. We did end up winning the game by one. It makes me feel great that I had a part to play in that.\n\nIn this team, I'm the captain. I'm constantly cheering my team on. Even after getting injured, I continued to come and watch from the side-lines. I enjoy yelling (encouragingly) at my team mates and helping them be the best they can. I'm definitely not the best player by a long stretch. But I really enjoy the game. It's a great way to get exercise and have good social interactions once a week.\n\nThat said, it can be hard to keep people coming and paying dues and stuff. If people don't show up it can be really hard to find subs. I have a list of people I can text, but sometimes I can't find anyone.\n\nBut yeah, today was awesome. I felt like more than just a player that gets in the way of the opposition, but an actual asset to the team. Really great feeling.\n\nAnyway, I'm rambling at this point and really this is just so we can have a note that's pretty long to test things out. I think it's long enough now... Cheers!",
		},
	])

	console.timeEnd(`🐨 Created admin user "kody"`)

	await client.end()
}

await seed().catch(e => {
	console.error(e)
	process.exit(1)
})
