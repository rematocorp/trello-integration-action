import { Conf, PR } from '../types'
import { getCommits, getPullRequest, getPullRequestRequestedReviewers, getPullRequestReviews } from './api/github'
import { addMemberToCard, getCardInfo, getMemberInfo, removeMemberFromCard } from './api/trello'
import isChangesRequestedInReview from './utils/isChangesRequestedInReview'
import isPullRequestInDraft from './utils/isPullRequestInDraft'
import isPullRequestApproved from './utils/isPullRequestApproved'
import logger from './utils/logger'

export default async function updateCardMembers(conf: Conf, cardIds: string[], pr: PR) {
	if (!conf.trelloAddMembersToCards) {
		return
	}
	logger.log('👩‍💻 UPDATE CARD MEMBERS')

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

	logger.log('Removing contributors and assigning reviewers', { reviewers, memberIds })

	return Promise.all(
		cardIds.map(async (cardId) => {
			const cardInfo = await getCardInfo(cardId)

			await removeMembers(cardId, cardInfo.idMembers)
			await addMembers(cardId, memberIds)
		}),
	)
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
			await addMembers(cardId, memberIds)
			await removeUnrelatedMembers(conf, cardId, memberIds)
			await removeReviewers(conf, cardId)
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

async function addMembers(cardId: CardId, memberIds: string[]) {
	const cardInfo = await getCardInfo(cardId)
	const filtered = memberIds.filter((id) => !cardInfo.idMembers.includes(id))

	if (!filtered.length) {
		logger.log('All members are already assigned to the card')

		return
	}

	return Promise.all(filtered.map((memberId) => addMemberToCard(cardInfo.id, memberId)))
}

async function removeUnrelatedMembers(conf: Conf, cardId: CardId, memberIds: string[]) {
	if (!conf.trelloRemoveUnrelatedMembers) {
		return
	}
	logger.log('Starting to remove unrelated members')

	const cardInfo = await getCardInfo(cardId)
	const filtered = cardInfo.idMembers.filter((id) => !memberIds.includes(id))

	if (!filtered.length) {
		logger.log('Did not find any unrelated members')

		return
	}

	return removeMembers(cardInfo.id, filtered)
}

async function removeReviewers(conf: Conf, cardId: CardId) {
	if (!conf.trelloSwitchMembersInReview) {
		return
	}

	logger.log('Starting to remove reviewers from the card')

	const reviewers = await getReviewers()
	const memberIds = await getTrelloMemberIds(conf, reviewers)
	const cardInfo = await getCardInfo(cardId)
	const filtered = memberIds.filter((id) => cardInfo.idMembers.includes(id))

	if (!filtered.length) {
		logger.log('Did not find any reviewers assigned to the card')

		return
	}

	return removeMembers(cardInfo.id, filtered)
}

async function removeMembers(cardId: CardId, memberIds: string[]) {
	return Promise.all(memberIds.map((memberId) => removeMemberFromCard(cardId, memberId)))
}

async function getReviewers() {
	const reviews = await getPullRequestReviews()
	const requestedReviewers = await getPullRequestRequestedReviewers()

	return [
		...reviews.filter((r) => r.state !== 'PENDING').map((r) => r.user?.login),
		...requestedReviewers.users?.map((u) => u.login),
	].filter((username) => username) as string[]
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
					logger.log('The member has no access to the org', {
						orgName: conf.trelloOrganizationName,
						memberId: member.id,
						username,
					})

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
