import { setFailed } from '@actions/core'
import {
	createComment,
	getBranchName,
	getPullRequestAssignees,
	getPullRequestComments,
	updatePullRequestBody,
} from './githubRequests'
import {
	addAttachmentToCard,
	addLabelToCard,
	addMemberToCard,
	createCard,
	getBoardLabels,
	getBoardLists,
	getCardAttachments,
	getCardInfo,
	getMemberInfo,
	moveCardToList,
	removeMemberFromCard,
	searchTrelloCards,
} from './trelloRequests'
import { BoardLabel, Conf, PR, PRHead } from './types'

export async function run(pr: PR, conf: Conf = {}) {
	try {
		const created = await createNewCard(conf, pr)
		if (created) {
			console.log('Exiting early as automatic PR body change will retrigger the action')

			return
		}

		const comments = await getPullRequestComments()
		const cardIds = await getCardIds(conf, pr.head, pr.body, comments)

		if (cardIds.length) {
			console.log('Found card IDs', cardIds)

			const linked = await addCardLinkToPR(conf, cardIds, pr.body, comments)
			if (linked) {
				console.log('Exiting early as automatic comment will retrigger the action')

				return
			}

			await moveCards(conf, cardIds, pr)
			await addPRLinkToCards(cardIds, pr.html_url || pr.url)
			await updateCardMembers(conf, cardIds)
			await addLabelToCards(conf, cardIds, pr.head)
		}
	} catch (error: any) {
		setFailed(error)
		throw error
	}
}

async function createNewCard(conf: Conf, pr: PR) {
	if (!conf.trelloEnableNewCardCommand) {
		return false
	}
	const isDraft = isDraftPr(pr)
	const listId = pr.state === 'open' && isDraft ? conf.trelloListIdPrDraft : conf.trelloListIdPrOpen

	if (listId && pr.body?.includes('/new-trello-card')) {
		const card = await createCard(listId, pr.title, pr.body)
		await updatePullRequestBody(pr.body.replace('/new-trello-card', card.url))

		return true
	}

	return false
}

async function getCardIds(conf: Conf, prHead: PRHead, prBody: string = '', comments: { body?: string }[]) {
	console.log('Searching for card ids')

	let cardIds = matchCardIds(conf, prBody || '')

	if (conf.githubIncludePrComments) {
		for (const comment of comments) {
			cardIds = [...cardIds, ...matchCardIds(conf, comment.body)]
		}
	}

	if (cardIds.length) {
		return [...new Set(cardIds)]
	}

	if (conf.githubIncludePrBranchName) {
		const cardId = await getCardIdFromBranch(prHead)

		if (cardId) {
			return [cardId]
		}
	}

	if (!cardIds.length) {
		console.log('Could not find card IDs')

		if (conf.githubRequireTrelloCard) {
			setFailed('The PR does not contain a link to a Trello card')
		}
	}

	return []
}

function matchCardIds(conf: Conf, text?: string) {
	const keywords = ['close', 'closes', 'closed', 'fix', 'fixes', 'fixed', 'resolve', 'resolves', 'resolved']
	const keywordsRegExp = conf.githubRequireKeywordPrefix ? '(?:' + keywords.join('|') + ')\\s+' : ''
	const urlRegExp = 'https://trello\\.com/c/(\\w+)(?:/[^\\s,]*)?'
	const closesRegExp = `${keywordsRegExp}${urlRegExp}(?:\\s*,\\s*${urlRegExp})*`

	// Find all “Closes URL, URL…”
	const matches = text?.match(new RegExp(closesRegExp, 'gi')) || []

	return Array.from(
		new Set(
			matches.flatMap((match) => {
				// Find URLs
				const urlMatches = match.match(new RegExp(urlRegExp, 'g')) || []
				// Find cardId in the URL (only capture group in urlRegexp)
				const cardIds = urlMatches.map((url) => url?.match(new RegExp(urlRegExp))?.[1] || '')

				return cardIds
			}),
		),
	)
}

async function getCardIdFromBranch(prHead?: PRHead) {
	console.log('Searching card from branch name')

	const branchName = prHead?.ref || (await getBranchName())
	const matches = branchName.match(/(\d+)-\S+/i)

	if (matches) {
		const cardsWithExactMatch = await searchTrelloCards(matches[0])

		if (cardsWithExactMatch?.length) {
			return cardsWithExactMatch[0].id
		}

		console.log('Could not find Trello card with branch name, trying only with card number')

		const cardNumber = matches[1]
		const cardsWithNumberMatch = await searchTrelloCards(cardNumber)

		return cardsWithNumberMatch
			.sort((a, b) => new Date(b.dateLastActivity).getTime() - new Date(a.dateLastActivity).getTime())
			.find((card) => card.idShort === parseInt(cardNumber))?.id
	}
}

async function moveCards(conf: Conf, cardIds: string[], pr: PR) {
	const isDraft = isDraftPr(pr)

	if (pr.state === 'open' && isDraft && conf.trelloListIdPrDraft) {
		await moveCardsToList(cardIds, conf.trelloListIdPrDraft, conf.trelloBoardId)
		console.log('Moved cards to draft PR list')
	} else if (pr.state === 'open' && !isDraft && conf.trelloListIdPrOpen) {
		await moveCardsToList(cardIds, conf.trelloListIdPrOpen, conf.trelloBoardId)
		console.log('Moved cards to open PR list')
	} else if (pr.state === 'closed' && conf.trelloListIdPrClosed) {
		await moveCardsToList(cardIds, conf.trelloListIdPrClosed, conf.trelloBoardId)
		console.log('Moved cards to closed PR list')
	} else {
		console.log('Skipping moving the cards', pr.state, isDraft)
	}
}

function isDraftPr(pr: any) {
	// Treat PRs with “draft” or “wip” in brackets at the start or
	// end of the titles like drafts. Useful for orgs on unpaid
	// plans which doesn’t support PR drafts.
	const titleDraftRegExp = /^(?:\s*[\[(](?:wip|draft)[\])]\s+)|(?:\s+[\[(](?:wip|draft)[\])]\s*)$/i
	const isRealDraft = pr.draft === true
	const isFauxDraft = Boolean(pr.title.match(titleDraftRegExp))

	if (isFauxDraft) {
		console.log('This PR is in faux draft')
	}

	return isRealDraft || isFauxDraft
}

async function moveCardsToList(cardIds: string[], listId: string, boardId?: string) {
	const listIds = listId.split(';')

	return Promise.all(
		cardIds.map(async (cardId) => {
			if (listIds.length > 1) {
				const { idBoard } = await getCardInfo(cardId)
				const boardLists = await getBoardLists(idBoard)

				// Moves to the list on the board where the card is currently located
				await moveCardToList(
					cardId,
					listIds.find((listId) => boardLists.some((list) => list.id === listId)) || listIds[0],
				)
			} else {
				await moveCardToList(cardId, listId, boardId)
			}
		}),
	)
}

async function addPRLinkToCards(cardIds: string[], link: string) {
	return Promise.all(
		cardIds.map(async (cardId) => {
			const existingAttachments = await getCardAttachments(cardId)

			if (existingAttachments?.some((it) => it.url.includes(link))) {
				console.log('Found existing attachment, skipping adding attachment', cardId, link)

				return
			}

			return addAttachmentToCard(cardId, link)
		}),
	)
}

async function addCardLinkToPR(conf: Conf, cardIds: string[], prBody: string = '', comments: { body?: string }[] = []) {
	if (!conf.githubIncludePrBranchName) {
		return false
	}

	if (matchCardIds(conf, prBody || '')?.length) {
		console.log('Card is already linked in the PR description')

		return false
	}

	for (const comment of comments) {
		if (matchCardIds(conf, comment.body)?.length) {
			console.log('Card is already linked in the comment')

			return false
		}
	}
	console.log('Commenting Trello card URL to PR', cardIds[0])

	const cardInfo = await getCardInfo(cardIds[0])

	await createComment(cardInfo.shortUrl)

	return true
}

async function updateCardMembers(conf: Conf, cardIds: string[]) {
	const assignees = await getPullRequestAssignees()

	console.log('Starting to update card members')

	if (!assignees?.length) {
		console.log('No PR assignees found')

		return
	}
	const result = await Promise.all(assignees.map((assignee) => getTrelloMemberId(conf, assignee?.login)))
	const memberIds = result.filter((id) => id) as string[]

	if (!memberIds.length) {
		console.log('No Trello members found based on PR assignees')

		return
	}

	return Promise.all(
		cardIds.map(async (cardId) => {
			const cardInfo = await getCardInfo(cardId)

			if (conf.trelloRemoveUnrelatedMembers) {
				await removeUnrelatedMembers(cardInfo, memberIds)
			}

			return addNewMembers(cardInfo, memberIds)
		}),
	)
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

async function addLabelToCards(conf: Conf, cardIds: string[], head: PRHead) {
	if (!conf.trelloAddLabelsToCards) {
		console.log('Skipping label adding')

		return
	}
	console.log('Starting to add labels to cards')

	const branchLabel = await getBranchLabel(head)

	if (!branchLabel) {
		console.log('Could not find branch label')

		return
	}

	return Promise.all(
		cardIds.map(async (cardId) => {
			const cardInfo = await getCardInfo(cardId)
			const hasConflictingLabel = cardInfo.labels.find(
				(label) => conf.trelloConflictingLabels?.includes(label.name) || label.name === branchLabel,
			)

			if (hasConflictingLabel) {
				console.log('Skipping label adding to a card because it has a conflicting label', cardInfo.labels)

				return
			}
			const boardLabels = await getBoardLabels(cardInfo.idBoard)
			const matchingLabel = findMatchingLabel(branchLabel, boardLabels)

			if (matchingLabel) {
				await addLabelToCard(cardId, matchingLabel.id)
			} else {
				console.log('Could not find a matching label from the board', branchLabel, boardLabels)
			}
		}),
	)
}

async function getBranchLabel(prHead?: PRHead) {
	const branchName = prHead?.ref || (await getBranchName())
	const matches = branchName.match(/^([^\/]*)\//)

	if (matches) {
		return matches[1]
	} else {
		console.log('Did not find branch label', branchName)
	}
}

function findMatchingLabel(branchLabel: string, boardLabels: BoardLabel[]) {
	if (!branchLabel) {
		return
	}
	const match = boardLabels.find((label) => label.name === branchLabel)

	if (match) {
		return match
	}
	console.log('Could not match the exact label name, trying to find partially matching label')

	return boardLabels.find((label) => branchLabel.startsWith(label.name))
}
