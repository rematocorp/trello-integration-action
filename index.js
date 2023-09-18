import axios from 'axios'
import * as core from '@actions/core'
import * as github from '@actions/github'

const { context = {} } = github
const payload = context.payload

const githubToken = core.getInput('github-token', { required: true })
const githubRequireKeywordPrefix = core.getBooleanInput('github-require-keyword-prefix')
const githubRequireTrelloCard = core.getBooleanInput('github-require-trello-card')
const trelloApiKey = core.getInput('trello-api-key', { required: true })
const trelloAuthToken = core.getInput('trello-auth-token', { required: true })
const trelloOrganizationName = core.getInput('trello-organization-name')
const trelloBoardId = core.getInput('trello-board-id')
const trelloListIdPrDraft = core.getInput('trello-list-id-pr-draft')
const trelloListIdPrOpen = core.getInput('trello-list-id-pr-open')
const trelloListIdPrClosed = core.getInput('trello-list-id-pr-closed')
const trelloConflictingLabels = core.getInput('trello-conflicting-labels')?.split(';')
const trelloCardInBranchName = core.getBooleanInput('trello-card-in-branch-name')

const octokit = github.getOctokit(githubToken)
const repoOwner = (payload.organization || payload.repository.owner).login
const issueNumber = (payload.pull_request || payload.issue).number

async function run(pr) {
	const url = pr.html_url || pr.url

	try {
		const comments = await getPullRequestComments()
		const assignees = await getPullRequestAssignees()
		const cardIds = await getCardIds(pr.head, pr.body, comments)

		if (!cardIds.length) {
			console.log('Could not find card IDs')

			if (githubRequireTrelloCard) {
				core.setFailed('The PR does not contain a link to a Trello card')
			}
			return
		}
		console.log('Found card IDs', cardIds)

		const isDraft = isDraftPr(pr)

		if (pr.state === 'open' && isDraft && trelloListIdPrDraft) {
			await moveCardsToList(cardIds, trelloListIdPrDraft)
			console.log('Moved cards to draft PR list')
		} else if (pr.state === 'open' && !isDraft && trelloListIdPrOpen) {
			await moveCardsToList(cardIds, trelloListIdPrOpen)
			console.log('Moved cards to open PR list')
		} else if (pr.state === 'closed' && trelloListIdPrClosed) {
			await moveCardsToList(cardIds, trelloListIdPrClosed)
			console.log('Moved cards to closed PR list')
		} else {
			console.log('Skipping moving the cards', pr.state, isDraft)
		}
		await addAttachmentToCards(cardIds, url)
		await updateCardMembers(cardIds, assignees)
		await addLabelToCards(cardIds, pr.head)
		await commentCardLink(cardIds, pr.body, comments)
	} catch (error) {
		core.setFailed(error)
	}
}

async function getCardIds(prHead, prBody, comments) {
	console.log('Searching for card ids')

	let cardIds = matchCardIds(prBody || '')

	for (const comment of comments) {
		cardIds = [...cardIds, ...matchCardIds(comment.body)]
	}

	if (cardIds.length) {
		return [...new Set(cardIds)]
	}

	if (trelloCardInBranchName) {
		return getCardIdFromBranch(prHead)
	}

	return []
}

async function getCardIdFromBranch(prHead) {
	console.log('Searching card from branch name')

	const branchName = await getBranchName(prHead)
	const matches = branchName.match(/\d+-\S+/i)

	if (matches) {
		console.log('Querying card id based on branch name', matches[0])

		const url = `https://api.trello.com/1/search`

		return axios
			.get(url, {
				params: {
					key: trelloApiKey,
					token: trelloAuthToken,
					modelTypes: 'cards',
					query: matches[0],
				},
			})
			.then((response) => {
				if (response.data.length) {
					return response.data[0].id
				}
				return
			})
			.catch((error) => {
				console.error(`Error ${error.response.status} ${error.response.statusText}`, url)
			})
	}
}

function matchCardIds(text) {
	const keywords = ['close', 'closes', 'closed', 'fix', 'fixes', 'fixed', 'resolve', 'resolves', 'resolved']
	const keywordsRegExp = githubRequireKeywordPrefix ? '(?:' + keywords.join('|') + ')\\s+' : ''
	const urlRegExp = 'https://trello\\.com/c/(\\w+)(?:/[^\\s,]*)?'
	const closesRegExp = `${keywordsRegExp}${urlRegExp}(?:\\s*,\\s*${urlRegExp})*`

	// Find all “Closes URL, URL…”
	const matches = text.match(new RegExp(closesRegExp, 'gi')) || []

	return Array.from(
		new Set(
			matches.flatMap((match) => {
				// Find URLs
				const urlMatches = match.match(new RegExp(urlRegExp, 'g'))
				// Find cardId in the URL (only capture group in urlRegexp)
				const cardIds = urlMatches.map((url) => url.match(new RegExp(urlRegExp))[1])
				return cardIds
			}),
		),
	)
}

async function getPullRequestComments() {
	console.log('Requesting pull request comments')

	const response = await octokit.rest.issues.listComments({
		owner: repoOwner,
		repo: payload.repository.name,
		issue_number: issueNumber,
	})
	return response.data
}

async function getPullRequestAssignees() {
	console.log('Requesting pull request assignees')

	const response = await octokit.rest.issues.get({
		owner: repoOwner,
		repo: payload.repository.name,
		issue_number: issueNumber,
	})
	return [...response.data.assignees, response.data.user]
}

function isDraftPr(pr) {
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

async function moveCardsToList(cardIds, listId) {
	return Promise.all(
		cardIds.map((cardId) => {
			console.log('Moving card to a list', cardId, listId)

			const url = `https://api.trello.com/1/cards/${cardId}`

			return axios
				.put(url, {
					key: trelloApiKey,
					token: trelloAuthToken,
					idList: listId,
					...(trelloBoardId && { idBoard: trelloBoardId }),
				})
				.catch((error) => {
					console.error(`Error ${error.response.status} ${error.response.statusText}`, url)
				})
		}),
	)
}

async function addAttachmentToCards(cardIds, link) {
	return Promise.all(
		cardIds.map(async (cardId) => {
			const extantAttachments = await getCardAttachments(cardId)

			if (extantAttachments && extantAttachments.some((it) => it.url.includes(link))) {
				console.log('Found existing attachment, skipping adding attachment', cardId, link)
				return
			}
			console.log('Adding attachment to the card', cardId, link)

			const url = `https://api.trello.com/1/cards/${cardId}/attachments`

			return axios
				.post(url, {
					key: trelloApiKey,
					token: trelloAuthToken,
					url: link,
				})
				.catch((error) => {
					console.error(`Error ${error.response.status} ${error.response.statusText}`, url)
				})
		}),
	)
}

async function getCardAttachments(cardId) {
	console.log('Checking existing attachments', cardId)

	const url = `https://api.trello.com/1/cards/${cardId}/attachments`

	return await axios
		.get(url, {
			params: {
				key: trelloApiKey,
				token: trelloAuthToken,
			},
		})
		.then((response) => {
			return response.data
		})
		.catch((error) => {
			console.error(`Error ${error.response.status} ${error.response.statusText}`, url)
			return null
		})
}

async function updateCardMembers(cardIds, assignees) {
	console.log('Starting to update card members')

	if (!assignees.length) {
		console.log('No PR assignees found')
		return
	}
	const result = await Promise.all(assignees.map((assignee) => getTrelloMemberId(assignee.login)))
	const memberIds = result.filter((id) => id)

	if (!memberIds.length) {
		console.log('No Trello members found based on PR assignees')
		return
	}
	cardIds.forEach(async (cardId) => {
		const cardInfo = await getCardInfo(cardId)

		removeUnrelatedMembers(cardInfo, memberIds)
		addNewMembers(cardInfo, memberIds)
	})
}

function getTrelloMemberId(githubUserName) {
	const username = githubUserName.replace('-', '_')

	console.log('Searching Trello member id by username', username)

	const url = `https://api.trello.com/1/members/${username}`

	return axios
		.get(url, {
			params: {
				key: trelloApiKey,
				token: trelloAuthToken,
				organizations: 'all',
			},
		})
		.then((response) => {
			const memberId = response.data.id
			console.log('Found member id by name', memberId, username)

			if (trelloOrganizationName) {
				const hasAccess = response.data.organizations?.some((org) => org.name === trelloOrganizationName)

				if (!hasAccess) {
					console.log('...but the member has no access to the org', trelloOrganizationName)
					return
				}
			}
			return memberId
		})
		.catch((error) => {
			console.error(`Error ${error.response.status} ${error.response.statusText}`, url)
		})
}

function removeUnrelatedMembers(cardInfo, memberIds) {
	const filtered = cardInfo.idMembers.filter((id) => !memberIds.includes(id))

	if (!filtered.length) {
		console.log('Did not find any unrelated members')
		return
	}
	filtered.forEach((unrelatedMemberId) => removeMemberFromCard(cardInfo.id, unrelatedMemberId))
}

function addNewMembers(cardInfo, memberIds) {
	const filtered = memberIds.filter((id) => !cardInfo.idMembers.includes(id))

	if (!filtered.length) {
		console.log('All members are already assigned to the card')
		return
	}
	filtered.forEach((memberId) => addMemberToCard(cardInfo.id, memberId))
}

function removeMemberFromCard(cardId, memberId) {
	console.log('Removing card member', cardId, memberId)

	const url = `https://api.trello.com/1/cards/${cardId}/idMembers/${memberId}`

	axios
		.delete(url, {
			params: {
				key: trelloApiKey,
				token: trelloAuthToken,
			},
		})
		.catch((error) => {
			console.error(`Error ${error.response.status} ${error.response.statusText}`, url)
		})
}

function addMemberToCard(cardId, memberId) {
	console.log('Adding member to a card', cardId, memberId)

	const url = `https://api.trello.com/1/cards/${cardId}/idMembers`

	axios
		.post(url, {
			key: trelloApiKey,
			token: trelloAuthToken,
			value: memberId,
		})
		.catch((error) => {
			console.error(`Error ${error.response.status} ${error.response.statusText}`, url)
		})
}

async function addLabelToCards(cardIds, head) {
	console.log('Starting to add labels to cards')

	const branchLabel = await getBranchLabel(head)

	if (!branchLabel) {
		console.log('Could not find branch label')
		return
	}
	cardIds.forEach(async (cardId) => {
		const cardInfo = await getCardInfo(cardId)
		const hasConflictingLabel = cardInfo.labels.find(
			(label) => trelloConflictingLabels.includes(label.name) || label.name === branchLabel,
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
	})
}

async function getBranchLabel(head) {
	const branchName = await getBranchName(head)
	const matches = branchName.match(/^([^\/]*)\//)

	if (matches) {
		return matches[1]
	} else {
		console.log('Did not found branch label', branchName)
	}
}

async function getBranchName(head) {
	if (head && head.ref) {
		return head.ref
	}
	console.log('Requesting pull request head ref')

	const response = await octokit.rest.pulls.get({
		owner: repoOwner,
		repo: payload.repository.name,
		pull_number: issueNumber,
	})
	return response.data.head.ref
}

async function getBoardLabels(boardId) {
	console.log('Getting board labels', boardId)

	const url = `https://api.trello.com/1/boards/${boardId}/labels`

	return await axios
		.get(url, {
			params: {
				key: trelloApiKey,
				token: trelloAuthToken,
			},
		})
		.then((response) => {
			// Filters out board labels that have no name to avoid assigning them to every PR
			// because 'foo'.startsWith('') is true (partially matching label logic)
			return response.data?.filter((label) => label.name)
		})
		.catch((error) => {
			console.error(`Error ${error.response.status} ${error.response.statusText}`, url)
		})
}

function findMatchingLabel(branchLabel, boardLabels) {
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

async function addLabelToCard(cardId, labelId) {
	console.log('Adding label to a card', cardId, labelId)

	const url = `https://api.trello.com/1/cards/${cardId}/idLabels`

	axios
		.post(url, {
			key: trelloApiKey,
			token: trelloAuthToken,
			value: labelId,
		})
		.catch((error) => {
			console.error(`Error ${error.response.status} ${error.response.statusText}`, url, error)
		})
}

async function commentCardLink(cardIds, prBody, comments) {
	if (!trelloCardInBranchName) {
		return
	}

	if (matchCardIds(prBody || '')?.length) {
		console.log('Card is already linked in the PR description')
		return
	}

	for (const comment of comments) {
		if (matchCardIds(comment.body)?.length) {
			console.log('Card is already linked in the comment')
			return
		}
	}
	console.log('Commenting Trello card URL to PR', cardIds[0])

	const cardInfo = await getCardInfo(cardIds[0])

	await octokit.rest.issues.createComment({
		owner: repoOwner,
		repo: payload.repository.name,
		issue_number: issueNumber,
		body: cardInfo.shortUrl,
	})
}

async function getCardInfo(cardId) {
	console.log('Getting card info', cardId)

	const url = `https://api.trello.com/1/cards/${cardId}`

	return await axios
		.get(url, {
			params: {
				key: trelloApiKey,
				token: trelloAuthToken,
			},
		})
		.then((response) => response.data)
		.catch((error) => {
			console.error(`Error ${error.response.status} ${error.response.statusText}`, url)
		})
}

run(payload.pull_request || payload.issue)
