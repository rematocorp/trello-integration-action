const axios = require('axios')
const core = require('@actions/core')
const github = require('@actions/github')

const { context = {} } = github
const { pull_request } = context.payload

const trelloApiKey = core.getInput('trello-api-key', { required: true })
const trelloAuthToken = core.getInput('trello-auth-token', { required: true })
const trelloBoardId = core.getInput('trello-board-id', { required: true })
const trelloListNamePullRequestOpen = core.getInput('trello-list-name-pr-open', { required: false })
const trelloListNamePullRequestClosed = core.getInput('trello-list-name-pr-closed', { required: false })

function getCardId(prBody) {
	console.log('Searching for card id', prBody)

	const linkRegex = /^\s*(https\:\/\/trello\.com\/c\/(\w+)(\/\S*)?)?\s*$/
	const lines = prBody.split('\r\n')

	for (const line of lines) {
		const matches = linkRegex.exec(line)

		if (matches && matches[2]) {
			return matches[2]
		}
	}
}

async function getListOnBoard(board, list) {
	const url = `https://trello.com/1/boards/${board}/lists`

	return await axios
		.get(url, {
			params: {
				key: trelloApiKey,
				token: trelloAuthToken,
			},
		})
		.then((response) => {
			const result = response.data.find((l) => l.closed == false && l.name == list)
			return result ? result.id : null
		})
		.catch((error) => {
			console.error(url, `Error ${error.response.status} ${error.response.statusText}`)
			return null
		})
}

async function addAttachmentToCard(card, link) {
	console.log('Adding attachment to the card', card, link)

	const url = `https://api.trello.com/1/cards/${card}/attachments`

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
			console.error(url, `Error ${error.response.status} ${error.response.statusText}`)
			return null
		})
}

async function moveCardToList(board, card, list) {
	console.log('Moving card to a list', board, card, list)

	const listId = await getListOnBoard(board, list)

	if (listId && listId.length > 0) {
		const url = `https://api.trello.com/1/cards/${card}`

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
				console.error(url, `Error ${error.response.status} ${error.response.statusText}`)
				return null
			})
	}
	return null
}

async function run(data) {
	const url = data.html_url || data.url
	const card = getCardId(trelloBoardId, data.body)

	if (card && card.length > 0) {
		console.log('Found card id', card)

		await addAttachmentToCard(card, url)

		if (data.state == 'open' && trelloListNamePullRequestOpen && trelloListNamePullRequestOpen.length > 0) {
			await moveCardToList(trelloBoardId, card, trelloListNamePullRequestOpen)
		} else if (
			data.state == 'closed' &&
			trelloListNamePullRequestClosed &&
			trelloListNamePullRequestClosed.length > 0
		) {
			await moveCardToList(trelloBoardId, card, trelloListNamePullRequestClosed)
		}
	}
}

run(pull_request)
