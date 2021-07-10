import * as axios from 'axios'
import * as core from '@actions/core'
import * as github from '@actions/github'

const { context = {} } = github
const { pull_request } = context.payload

const trelloApiKey = core.getInput('trello-api-key', { required: true })
const trelloAuthToken = core.getInput('trello-auth-token', { required: true })
const trelloListIdPullRequestOpen = core.getInput('trello-list-id-pr-open')
const trelloListIdPullRequestClosed = core.getInput('trello-list-id-pr-closed')

async function run(pr) {
	const url = pr.html_url || pr.url
	const cardId = getCardId(pr.body)

	if (cardId && cardId.length > 0) {
		console.log('Found card id', cardId)

		await addAttachmentToCard(cardId, url)

		if (pr.state == 'open' && trelloListIdPullRequestOpen && trelloListIdPullRequestOpen.length > 0) {
			await moveCardToList(cardId, trelloListIdPullRequestOpen)
		} else if (pr.state == 'closed' && trelloListIdPullRequestClosed && trelloListIdPullRequestClosed.length > 0) {
			await moveCardToList(cardId, trelloListIdPullRequestClosed)
		}
	}
}

function getCardId(prBody) {
	console.log('Searching for card id')

	const linkRegex = /^\s*(https\:\/\/trello\.com\/c\/(\w+)(\/\S*)?)?\s*$/
	const lines = prBody.split('\r\n')

	for (const line of lines) {
		const matches = linkRegex.exec(line)

		if (matches && matches[2]) {
			return matches[2]
		}
	}
}

async function addAttachmentToCard(cardId, link) {
	console.log('Adding attachment to the card', cardId, link)

	const url = `https://api.trello.com/1/cards/${cardId}/attachments`

	return await axios
		.post(url, {
			key: trelloApiKey,
			token: trelloAuthToken,
			url: link,
		})
		.then((response) => {
			return response.status == 200
		})
		.catch((error) => {
			console.error(`Error ${error.response.status} ${error.response.statusText}`, url)
			return null
		})
}

async function moveCardToList(cardId, listId) {
	console.log('Moving card to a list', cardId, listId)

	if (listId && listId.length > 0) {
		const url = `https://api.trello.com/1/cards/${cardId}`

		return await axios
			.put(url, {
				key: trelloApiKey,
				token: trelloAuthToken,
				idList: listId,
			})
			.then((response) => {
				return response && response.status == 200
			})
			.catch((error) => {
				console.error(`Error ${error.response.status} ${error.response.statusText}`, url)
				return null
			})
	}
	return null
}

run(pull_request)
