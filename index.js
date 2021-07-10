import * as axios from 'axios'
import * as core from '@actions/core'
import * as github from '@actions/github'

const { context = {} } = github
const payload = context.payload

const githubToken = core.getInput('github-token', { required: true })
const trelloApiKey = core.getInput('trello-api-key', { required: true })
const trelloAuthToken = core.getInput('trello-auth-token', { required: true })
const trelloListIdPullRequestOpen = core.getInput('trello-list-id-pr-open')
const trelloListIdPullRequestClosed = core.getInput('trello-list-id-pr-closed')

async function run(pr) {
	const url = pr.html_url || pr.url
	const cardId = await getCardId(pr.body)

	if (cardId && cardId.length > 0) {
		console.log('Found card id', cardId)

		await addAttachmentToCard(cardId, url)

		console.log('Checking PR state', pr, pr.state)

		if (pr.state == 'open' && trelloListIdPullRequestOpen && trelloListIdPullRequestOpen.length > 0) {
			await moveCardToList(cardId, trelloListIdPullRequestOpen)
		} else if (pr.state == 'closed' && trelloListIdPullRequestClosed && trelloListIdPullRequestClosed.length > 0) {
			await moveCardToList(cardId, trelloListIdPullRequestClosed)
		}
	}
}

async function getCardId(prBody) {
	console.log('Searching for card id in PR description')

	let cardId = matchCardId(prBody)

	if (cardId) {
		return cardId
	}
	console.log('Searching for card id in PR comments')

	const comments = await getPullRequestComments()

	for (const comment of comments) {
		cardId = matchCardId(comment.body)

		if (cardId) {
			return cardId
		}
	}
}

function matchCardId(text) {
	const linkRegex = /(https\:\/\/trello\.com\/c\/(\w+)(\/\S*)?)/
	const matches = linkRegex.exec(text)

	if (matches && matches[2]) {
		return matches[2]
	}
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

async function addAttachmentToCard(cardId, link) {
	const extantAttachments = await getCardAttachments(cardId)

	if (extantAttachments && extantAttachments.some((it) => it.url.includes(link))) {
		console.log('Found existing attachment, skipping', cardId, link)
		return null
	}
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

run(payload.pull_request || (payload.issue && payload.issue.pull_request))
