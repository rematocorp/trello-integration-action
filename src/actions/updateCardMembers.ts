import { Conf } from '../types'
import { getCommits, getPullRequest } from './api/github'
import { addMemberToCard, getCardInfo, getMemberInfo, removeMemberFromCard } from './api/trello'

export default async function updateCardMembers(conf: Conf, cardIds: string[]) {
	console.log('Starting to update card members')

	const contributors = await getPullRequestContributors()

	if (!contributors.length) {
		console.log('No PR contributors found')

		return
	}
	const result = await Promise.all(contributors.map((member) => getTrelloMemberId(conf, member)))
	const memberIds = result.filter((id) => id) as string[]

	if (!memberIds.length) {
		console.log('No Trello members found based on PR contributors')

		return
	}

	return Promise.all(
		cardIds.map(async (cardId) => {
			const cardInfo = await getCardInfo(cardId)

			await addNewMembers(cardInfo, memberIds)

			if (conf.trelloRemoveUnrelatedMembers) {
				await removeUnrelatedMembers(cardInfo, memberIds)
			}
		}),
	)
}

async function getPullRequestContributors() {
	const pr = await getPullRequest()

	if (!pr) {
		return []
	}
	const contributors = new Set<string>()

	for (const member of [...(pr.assignees || []), pr.user]) {
		if (member) {
			contributors.add(member.login)
		}
	}
	const commits = await getCommits()

	for (const commit of commits || []) {
		const author = commit.author?.login
		const committer = commit.committer?.login

		if (author) {
			contributors.add(author)
		}
		if (committer) {
			contributors.add(committer)
		}
	}

	return Array.from(contributors)
}

async function getTrelloMemberId(conf: Conf, githubUserName?: string) {
	let username = githubUserName?.replace('-', '_')

	if (conf.githubUsersToTrelloUsers?.trim()) {
		username = getTrelloUsernameFromInputMap(conf, githubUserName) || username
	}

	console.log('Searching Trello member id by username', username)

	const member = await getMemberInfo(username)

	if (!member) {
		return
	}
	console.log('Found member id by name', member.id, username)

	if (conf.trelloOrganizationName) {
		const hasAccess = member.organizations?.some((org) => org.name === conf.trelloOrganizationName)

		if (!hasAccess) {
			console.log('...but the member has no access to the org', conf.trelloOrganizationName)

			return
		}
	}

	return member.id
}

function getTrelloUsernameFromInputMap(conf: Conf, githubUserName?: string) {
	console.log('Mapping Github users to Trello users')

	const users = conf.githubUsersToTrelloUsers || ''

	for (const line of users.split(/[\r\n]/)) {
		const parts = line.trim().split(':')

		if (parts.length < 2) {
			console.error('Mapping of Github user to Trello does not contain 2 usernames separated by ":"', line)
			continue
		}
		if (parts[0].trim() === githubUserName && parts[1].trim() !== '') {
			return parts[1].trim()
		}
	}
}

async function removeUnrelatedMembers(cardInfo: any, memberIds: string[]) {
	const filtered = cardInfo.idMembers.filter((id: string) => !memberIds.includes(id))

	if (!filtered.length) {
		console.log('Did not find any unrelated members')

		return
	}

	return Promise.all(
		filtered.map((unrelatedMemberId: string) => removeMemberFromCard(cardInfo.id, unrelatedMemberId)),
	)
}

async function addNewMembers(cardInfo: any, memberIds: string[]) {
	const filtered = memberIds.filter((id) => !cardInfo.idMembers.includes(id))

	if (!filtered.length) {
		console.log('All members are already assigned to the card')

		return
	}

	return Promise.all(filtered.map((memberId) => addMemberToCard(cardInfo.id, memberId)))
}
