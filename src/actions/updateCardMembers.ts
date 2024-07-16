import { Card, Conf, PR } from '../types'
import { getCommits, getPullRequest, getPullRequestRequestedReviewers, getPullRequestReviews } from './api/github'
import { addMemberToCard, getCardInfo, getMemberInfo, removeMemberFromCard } from './api/trello'
import isChangesRequestedInReview from './utils/isChangesRequestedInReview'
import isPullRequestInDraft from './utils/isPullRequestInDraft'
import isPullRequestApproved from './utils/isPullRequestApproved'

export default async function updateCardMembers(conf: Conf, cardIds: string[], pr: PR) {
	if (!conf.trelloAddMembersToCards) {
		console.log('Skipping members updating')

		return
	}
	console.log('Starting to update card members')

	// Assigns PR reviewers to the card when the PR is in review
	if (conf.trelloSwitchMembersInReview) {
		console.log('Checking if in review')
		const inReview = await isPullRequestInReview(conf, pr)

		if (inReview) {
			console.log('Is in review')
			await switchCardMembersToReviewers(conf, cardIds)

			return
		}
	}

	// Assigns PR author, committers and assignees to the PR
	const contributors = await getPullRequestContributors()

	if (!contributors.length) {
		console.log('No PR contributors found')

		return
	}
	const memberIds = await getTrelloMemberIds(conf, contributors)

	if (!memberIds.length) {
		console.log('No Trello members found based on PR contributors')

		return
	}

	return Promise.all(
		cardIds.map(async (cardId) => {
			const cardInfo = await getCardInfo(cardId)

			await addMembers(cardInfo, memberIds)

			if (conf.trelloRemoveUnrelatedMembers) {
				await removeUnrelatedMembers(cardInfo, memberIds)
			}
		}),
	)
}

async function isPullRequestInReview(conf: Conf, pr: PR) {
	if (pr.state !== 'open') {
		return false
	}
	if (isPullRequestInDraft(pr)) {
		return false
	}
	const isChangesRequested = await isChangesRequestedInReview()
	const isApproved = await isPullRequestApproved()

	if (isChangesRequested && conf.trelloListIdPrChangesRequested) {
		return false
	}
	if (!isChangesRequested && isApproved && conf.trelloListIdPrApproved) {
		return false
	}

	return true
}

async function switchCardMembersToReviewers(conf: Conf, cardIds: string[]) {
	const reviewers = await getReviewers()

	return Promise.all(
		cardIds.map(async (cardId) => {
			const cardInfo = await getCardInfo(cardId)

			// Removes all current members from the card
			await Promise.all(cardInfo.idMembers.map((memberId: string) => removeMemberFromCard(cardInfo.id, memberId)))

			// Assigns PR reviewers to the Trello card
			const memberIds = await getTrelloMemberIds(conf, reviewers)
			await addMembers(cardInfo, memberIds)
		}),
	)
}

async function getReviewers() {
	const reviews = await getPullRequestReviews()
	const requestedReviewers = await getPullRequestRequestedReviewers()
	const allReviewers = [
		...reviews.filter((r) => r.state !== 'PENDING').map((r) => r.user?.login),
		...requestedReviewers?.users?.map((u) => u.login),
	].filter((username) => username !== undefined)

	return allReviewers as string[]
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
		const author = commit.author?.login || commit.committer?.login

		if (author) {
			contributors.add(author)
		}
	}

	return Array.from(contributors)
}

async function getTrelloMemberIds(conf: Conf, githubUsernames: string[]) {
	const result = await Promise.all(
		githubUsernames.map(async (githubUsername) => {
			const username = getTrelloUsername(conf, githubUsername)

			console.log('Searching Trello member id by username', username)

			const member = await getMemberInfo(username)

			if (!member) {
				return
			}
			console.log('Found member id by username', member.id, username)

			if (conf.trelloOrganizationName) {
				const hasAccess = member.organizations?.some((org) => org.name === conf.trelloOrganizationName)

				if (!hasAccess) {
					console.log('...but the member has no access to the org', conf.trelloOrganizationName)

					return
				}
			}

			return member.id
		}),
	)

	return result.filter((id) => id) as string[]
}

function getTrelloUsername(conf: Conf, githubUsername?: string) {
	const username = githubUsername?.replace('-', '_')
	const usernamesMap = conf.githubUsersToTrelloUsers?.trim()

	if (!usernamesMap) {
		return username
	}
	console.log('Mapping Github users to Trello users')

	for (const line of usernamesMap.split(/[\r\n]/)) {
		const parts = line.trim().split(':')

		if (parts.length < 2) {
			console.error('Mapping of Github user to Trello does not contain 2 usernames separated by ":"', line)
			continue
		}
		if (parts[0].trim() === githubUsername && parts[1].trim() !== '') {
			return parts[1].trim()
		}
	}

	return username
}

async function addMembers(cardInfo: Card, memberIds: string[]) {
	const filtered = memberIds.filter((id) => !cardInfo.idMembers.includes(id))

	if (!filtered.length) {
		console.log('All members are already assigned to the card')

		return
	}

	return Promise.all(filtered.map((memberId) => addMemberToCard(cardInfo.id, memberId)))
}

async function removeUnrelatedMembers(cardInfo: Card, memberIds: string[]) {
	const filtered = cardInfo.idMembers.filter((id: string) => !memberIds.includes(id))

	if (!filtered.length) {
		console.log('Did not find any unrelated members')

		return
	}

	return Promise.all(
		filtered.map((unrelatedMemberId: string) => removeMemberFromCard(cardInfo.id, unrelatedMemberId)),
	)
}
