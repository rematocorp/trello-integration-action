import * as axios from 'axios'
import * as core from '@actions/core'
import * as github from '@actions/github'

const { context = {} } = github
const payload = context.payload

console.log('Debug context', JSON.stringify(context))

const githubToken = core.getInput('github-token', { required: true })
const trelloApiKey = core.getInput('trello-api-key', { required: true })
const trelloAuthToken = core.getInput('trello-auth-token', { required: true })
const trelloListIdPrOpen = core.getInput('trello-list-id-pr-open')
const trelloListIdPrClosed = core.getInput('trello-list-id-pr-closed')

async function run(pr) {
	const url = pr.html_url || pr.url

	try {
		const comments = await getPullRequestComments()
		const cardIds = await getCardIds(pr.body, comments)

		if (cardIds.length) {
			console.log('Found card ids', cardIds)

			await addAttachmentToCards(cardIds, url)
			await addLabelToCards(cardIds, pr.head && pr.head.ref)

			if (pr.state === 'open' && pr.mergeable_state !== 'draft' && trelloListIdPrOpen) {
				await moveCardsToList(cardIds, trelloListIdPrOpen)
			} else if (pr.state === 'closed' && trelloListIdPrClosed) {
				await moveCardsToList(cardIds, trelloListIdPrClosed)
			} else {
				console.log(
					'Skipping moving the cards',
					pr.state,
					pr.mergeable_state,
					trelloListIdPrOpen,
					trelloListIdPrClosed,
				)
			}
		} else {
			console.log('Could not find card IDs')
		}
	} catch (error) {
		core.setFailed(error)
	}
}

async function getCardIds(prBody, comments) {
	console.log('Searching for card ids')

	let cardIds = matchCardIds(prBody || '')

	for (const comment of comments) {
		cardIds = [...cardIds, ...matchCardIds(comment.body)]
	}
	return cardIds
}

function matchCardIds(text) {
	const matches = text.match(/(https\:\/\/trello\.com\/c\/(\w+)(\/\S*)?)/g) || []

	return matches
		.map((match) => {
			const result = /(https\:\/\/trello\.com\/c\/(\w+)(\/\S*)?)/.exec(match)

			if (result && result[2]) {
				return result[2]
			}
		})
		.filter((cardId, index, self) => cardId && self.indexOf(cardId) === index)
}

async function getPullRequestComments() {
	const octokit = github.getOctokit(githubToken)

	const response = await octokit.rest.issues.listComments({
		owner: (payload.organization || payload.repository.owner).login,
		repo: payload.repository.name,
		issue_number: (payload.pull_request || payload.issue).number,
	})

	return response.data
}

async function addAttachmentToCards(cardIds, link) {
	cardIds.forEach(async (cardId) => {
		const extantAttachments = await getCardAttachments(cardId)

		if (extantAttachments && extantAttachments.some((it) => it.url.includes(link))) {
			console.log('Found existing attachment, skipping adding attachment', cardId, link)
			return
		}
		console.log('Adding attachment to the card', cardId, link)

		const url = `https://api.trello.com/1/cards/${cardId}/attachments`

		axios
			.post(url, {
				key: trelloApiKey,
				token: trelloAuthToken,
				url: link,
			})
			.catch((error) => {
				console.error(`Error ${error.response.status} ${error.response.statusText}`, url)
			})
	})
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

function moveCardsToList(cardIds, listId) {
	cardIds.forEach((cardId) => {
		console.log('Moving card to a list', cardId, listId)

		const url = `https://api.trello.com/1/cards/${cardId}`

		axios
			.put(url, {
				key: trelloApiKey,
				token: trelloAuthToken,
				idList: listId,
			})
			.catch((error) => {
				console.error(`Error ${error.response.status} ${error.response.statusText}`, url)
			})
	})
}

async function addLabelToCards(cardIds, branchName) {
	console.log('Starting to add label to cards')

	if (!branchName) {
		console.warn('Skipping label adding to cards because PR branchName is missing')
		return
	}

	cardIds.forEach(async (cardId) => {
		const cardInfo = await getCardInfo(cardId)

		if (cardInfo.idLabels.length) {
			console.log('Skipping label adding to a card because card already has labels')
			return
		}

		const boardLabels = await getBoardLabels(cardInfo.idBoard)
		const branchLabel = getBranchLabel(branchName)
		const matchingLabel = findMatchingLabel(branchLabel, boardLabels)

		if (matchingLabel) {
			await addLabelToCard(cardId, matchingLabel.id)
		} else {
			console.log(
				'Skipping label adding to a card because could not find a matching label from the board',
				branchLabel,
				boardLabels,
			)
		}
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
		.then((response) => response.data)
		.catch((error) => {
			console.error(`Error ${error.response.status} ${error.response.statusText}`, url)
		})
}

function getBranchLabel(branchName) {
	const matches = branchName.match(/^([^\/]*)\//)

	if (matches) {
		return matches[1]
	} else {
		console.log('Did not found branch label', branchName)
	}
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
			console.error(`Error ${error.response.status} ${error.response.statusText}`, url)
		})
}

run(payload.pull_request || payload.issue)
