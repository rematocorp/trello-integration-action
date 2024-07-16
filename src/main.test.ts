import { setFailed } from '@actions/core'
import {
	addCardLinksToPullRequest,
	addLabelToCards,
	addPullRequestLinkToCards,
	getCardIds,
	moveOrArchiveCards,
	updateCardMembers,
} from './actions'
import { run } from './main'

jest.mock('@actions/core')
jest.mock('@actions/github')
jest.mock('./actions/api/trello')
jest.mock('./actions/api/github')
jest.mock('./actions')

const getCardIdsMock = getCardIds as jest.Mock

const pr = { number: 0, state: 'open', title: 'Title', head: 'head' }
const conf = { trelloListIdPrOpen: '123' }

it('triggers all actions when cards found', async () => {
	const cardIds = ['card-id-1', 'card-id-2']

	getCardIdsMock.mockResolvedValueOnce(cardIds)

	await run(pr, conf)

	expect(addCardLinksToPullRequest).toHaveBeenCalledWith(conf, cardIds)
	expect(addPullRequestLinkToCards).toHaveBeenCalledWith(cardIds, pr)
	expect(moveOrArchiveCards).toHaveBeenCalledWith(conf, cardIds, pr)
	expect(addLabelToCards).toHaveBeenCalledWith(conf, cardIds, pr.head)
	expect(updateCardMembers).toHaveBeenCalledWith(conf, cardIds, pr)
})

it('does nothing when no cards found', async () => {
	getCardIdsMock.mockResolvedValueOnce([])

	await run(pr, conf)

	expect(addCardLinksToPullRequest).not.toHaveBeenCalled()
})

it('sets job failed and throws error when error', async () => {
	const error = new Error('Error')

	getCardIdsMock.mockRejectedValueOnce(error)

	await expect(run(pr, conf)).rejects.toThrow(error)
	expect(setFailed).toHaveBeenCalledWith(error)
	expect(addCardLinksToPullRequest).not.toHaveBeenCalled()
})
