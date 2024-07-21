import axios from 'axios'
import * as core from '@actions/core'
import { BoardLabel } from '../../types'
import logger from '../utils/logger'

const trelloApiKey = core.getInput('trello-api-key', { required: true })
const trelloAuthToken = core.getInput('trello-auth-token', { required: true })
const trelloCardPosition = core.getInput('trello-card-position')

export async function searchTrelloCards(
	query: string,
	boardId?: string,
): Promise<{ dateLastActivity: string; id: string; idShort: number; shortLink: string }[]> {
	const response = await makeRequest('get', `https://api.trello.com/1/search`, {
		modelTypes: 'cards',
		query,
		...(boardId && { idBoards: [boardId] }),
	})

	return response?.data?.cards || []
}

export async function getCardInfo(
	cardId: string,
): Promise<{ id: string; idBoard: string; labels: BoardLabel[]; shortUrl: string; idMembers: string[] }> {
	const response = await makeRequest('get', `https://api.trello.com/1/cards/${cardId}`)

	return response?.data
}

export async function getCardAttachments(cardId: string): Promise<{ url: string }[]> {
	const response = await makeRequest('get', `https://api.trello.com/1/cards/${cardId}/attachments`)

	return response?.data || null
}

export async function addAttachmentToCard(cardId: string, link: string) {
	logger.log('Adding attachment to the card', { cardId, link })

	return makeRequest('post', `https://api.trello.com/1/cards/${cardId}/attachments`, { url: link })
}

export async function addMemberToCard(cardId: string, memberId: string) {
	logger.log('Adding member to a card', { cardId, memberId })

	return makeRequest('post', `https://api.trello.com/1/cards/${cardId}/idMembers`, {
		value: memberId,
	})
}

export async function getBoardLabels(boardId: string): Promise<BoardLabel[]> {
	const response = await makeRequest('get', `https://api.trello.com/1/boards/${boardId}/labels`)

	// Filters out board labels that have no name to avoid assigning them to every PR
	// because 'foo'.startsWith('') is true (partially matching label logic)
	return response?.data?.filter((label: { name: string }) => label.name)
}

export async function getBoardLists(boardId: string): Promise<{ id: string }[]> {
	const response = await makeRequest('get', `https://api.trello.com/1/boards/${boardId}/lists`)

	return response?.data
}

export async function addLabelToCard(cardId: string, labelId: string) {
	logger.log('Adding label to a card', { cardId, labelId })

	return makeRequest('post', `https://api.trello.com/1/cards/${cardId}/idLabels`, {
		value: labelId,
	})
}

export async function removeMemberFromCard(cardId: string, memberId: string) {
	logger.log('Removing card member', { cardId, memberId })

	return makeRequest('delete', `https://api.trello.com/1/cards/${cardId}/idMembers/${memberId}`)
}

export async function moveCardToList(cardId: string, listId: string, boardId?: string) {
	logger.log('Moving card to list', { cardId, listId, boardId })

	return makeRequest('put', `https://api.trello.com/1/cards/${cardId}`, {
		pos: trelloCardPosition,
		idList: listId,
		...(boardId && { idBoard: boardId }),
	})
}

export async function archiveCard(cardId: string) {
	logger.log('Archiving card', { cardId })

	return makeRequest('put', `https://api.trello.com/1/cards/${cardId}`, {
		closed: true,
	})
}

export async function getMemberInfo(username?: string): Promise<{ id: string; organizations: { name: string }[] }> {
	const response = await makeRequest('get', `https://api.trello.com/1/members/${username}`, {
		organizations: 'all',
	})

	return response?.data
}

export async function createCard(
	listId: string,
	title: string,
	body?: string,
): Promise<{ id: string; url: string; shortLink: string }> {
	logger.log('Creating card based on PR info', { title, body })

	const response = await makeRequest('post', `https://api.trello.com/1/cards`, {
		idList: listId,
		name: title,
		desc: body,
		pos: trelloCardPosition,
	})

	return response?.data
}

async function makeRequest(method: 'get' | 'put' | 'post' | 'delete', url: string, params?: Record<string, any>) {
	try {
		let response

		if (['put', 'post'].includes(method)) {
			response = await axios[method](url, { key: trelloApiKey, token: trelloAuthToken, ...params })
		} else {
			response = await axios[method](url, {
				params: { key: trelloApiKey, token: trelloAuthToken, ...params },
			})
		}

		return response
	} catch (error: any) {
		const errorMessage = {
			message: 'Failed to make a request',
			method,
			url,
			params,
			error: {
				status: error.response?.status,
				statusText: error.response?.statusText,
				data: error.response?.data,
				message: error.message,
			},
		}
		logger.error(JSON.stringify(errorMessage, null, 2))

		throw error
	}
}
