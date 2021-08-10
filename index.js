import * as axios from 'axios'
import * as core from '@actions/core'
import * as github from '@actions/github'

const { context = {} } = github
const payload = context.payload

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

			if (pr.state === 'open' && pr.mergeable_state !== 'draft' && trelloListIdPrOpen) {
				await moveCardsToList(cardIds, trelloListIdPrOpen)
			} else if (pr.state === 'closed' && trelloListIdPrClosed) {
				await moveCardsToList(cardIds, trelloListIdPrClosed)
			}
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

		if (listId && listId.length > 0) {
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
		}
	})
}

run(payload.pull_request || payload.issue)
