import { Card, Conf, PR } from '../types'
import { getCommits, getPullRequest, getPullRequestRequestedReviewers, getPullRequestReviews } from './api/github'
import { addMemberToCard, getCardInfo, getMemberInfo, removeMemberFromCard } from './api/trello'
import isChangesRequestedInReview from './utils/isChangesRequestedInReview'
import isPullRequestInDraft from './utils/isPullRequestInDraft'
import isPullRequestApproved from './utils/isPullRequestApproved'
import logger from './utils/logger'

export default async function updateCardMembers(conf: Conf, cardIds: string[], pr: PR) {
	if (!conf.trelloAddMembersToCards) {
		return logger.log('Skipping members updating')
	}
	const inReview = await isPullRequestInReview(conf, pr)

	if (inReview) {
		await assignReviewers(conf, cardIds)
	} else {
		await assignContributors(conf, cardIds)
	}
}

async function isPullRequestInReview(conf: Conf, pr: PR) {
	const isInDraft = isPullRequestInDraft(pr)
	const isChangesRequested = await isChangesRequestedInReview()
	const isApproved = await isPullRequestApproved()

	logger.log('Checking if PR is in review', { prState: pr.state, isInDraft, isChangesRequested, isApproved })

	if (!conf.trelloSwitchMembersInReview) {
		return false
	}
	if (pr.state !== 'open') {
		return false
	}
	if (isPullRequestInDraft(pr)) {
		return false
	}
	if (isChangesRequested && conf.trelloListIdPrChangesRequested) {
		return false
	}
	if (!isChangesRequested && isApproved && conf.trelloListIdPrApproved) {
		return false
	}

	return true
}

async function assignReviewers(conf: Conf, cardIds: string[]) {
	const reviewers = await getReviewers()
	const memberIds = await getTrelloMemberIds(conf, reviewers)

	if (memberIds.length) {
		logger.log('Removing contributors and assigning reviewers', { reviewers, memberIds })
	} else {
		logger.log('No Trello members found based on reviewers, but still removing current card members', { reviewers })
	}

	return Promise.all(
		cardIds.map(async (cardId) => {
			const cardInfo = await getCardInfo(cardId)

			await removeMembers(cardId, cardInfo.idMembers)
			await addMembers({ ...cardInfo, idMembers: [] }, memberIds)
		}),
	)
}

async function getReviewers() {
	const reviews = await getPullRequestReviews()
	const requestedReviewers = await getPullRequestRequestedReviewers()

	return [
		...reviews.filter((r) => r.state !== 'PENDING').map((r) => r.user?.login),
		...requestedReviewers?.users?.map((u) => u.login),
	].filter((username) => username) as string[]
}

async function assignContributors(conf: Conf, cardIds: string[]) {
	const contributors = await getPullRequestContributors()

	if (!contributors.length) {
		logger.log('No PR contributors found')

		return
	}
	const memberIds = await getTrelloMemberIds(conf, contributors)

	if (!memberIds.length) {
		logger.log('No Trello members found based on PR contributors')

		return
	}

	return Promise.all(
		cardIds.map(async (cardId) => {
			const cardInfo = await getCardInfo(cardId)

			await addMembers(cardInfo, memberIds)
			await removeUnrelatedMembers(conf, cardInfo, memberIds)
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
		const author = commit.author?.login || commit.committer?.login

		if (author) {
			contributors.add(author)
		}
	}

	return Array.from(contributors)
}

async function getTrelloMemberIds(conf: Conf, githubUsernames: string[]) {
	const memberIds = await Promise.all(
		githubUsernames.map(async (githubUsername) => {
			const username = getTrelloUsername(conf, githubUsername)

			logger.log('Searching Trello member id by username', username)

			const member = await getMemberInfo(username)

			if (!member) {
				return
			}
			logger.log('Found member id by username', { memberId: member.id, username })

			if (conf.trelloOrganizationName) {
				const hasAccess = member.organizations?.some((org) => org.name === conf.trelloOrganizationName)

				if (!hasAccess) {
					logger.log('...but the member has no access to the org', conf.trelloOrganizationName)

					return
				}
			}

			return member.id
		}),
	)

	return memberIds.filter((id) => id) as string[]
}

function getTrelloUsername(conf: Conf, githubUsername?: string) {
	const username = githubUsername?.replace('-', '_')
	const usernamesMap = conf.githubUsersToTrelloUsers?.trim()

	if (!usernamesMap) {
		return username
	}
	logger.log('Mapping Github users to Trello users')

	for (const line of usernamesMap.split(/[\r\n]/)) {
		const parts = line.trim().split(':')

		if (parts.length < 2) {
			logger.error('Mapping of Github user to Trello does not contain 2 usernames separated by ":"', line)
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
		logger.log('All members are already assigned to the card')

		return
	}

	return Promise.all(filtered.map((memberId) => addMemberToCard(cardInfo.id, memberId)))
}

async function removeUnrelatedMembers(conf: Conf, cardInfo: Card, memberIds: string[]) {
	if (!conf.trelloRemoveUnrelatedMembers) {
		return
	}
	logger.log('Starting to remove unrelated members')

	const filtered = cardInfo.idMembers.filter((id: string) => !memberIds.includes(id))

	if (!filtered.length) {
		logger.log('Did not find any unrelated members')

		return
	}

	return removeMembers(cardInfo.id, filtered)
}

async function removeMembers(cardId: string, memberIds: string[]) {
	return Promise.all(memberIds.map((memberId) => removeMemberFromCard(cardId, memberId)))
}
