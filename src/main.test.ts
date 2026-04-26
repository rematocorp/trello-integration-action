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

vi.mock('@actions/core')
vi.mock('@actions/github')
vi.mock('./actions/api/trello')
vi.mock('./actions/api/github')
vi.mock('./actions')

const getCardIdsMock = vi.mocked<any>(getCardIds)

const pr = { number: 0, state: 'open', title: 'Title', head: 'head' }
const conf = { trelloListIdPrOpen: '123' }
const action = 'closed'

it('triggers all actions when cards found', async () => {
	const cardIds = ['card-id-1', 'card-id-2']

	getCardIdsMock.mockResolvedValueOnce(cardIds)

	await run(pr, action, conf)

	expect(addCardLinksToPullRequest).toHaveBeenCalledWith(conf, cardIds)
	expect(addPullRequestLinkToCards).toHaveBeenCalledWith(cardIds)
	expect(moveOrArchiveCards).toHaveBeenCalledWith(conf, cardIds, action)
	expect(addLabelToCards).toHaveBeenCalledWith(conf, cardIds, pr.head)
	expect(updateCardMembers).toHaveBeenCalledWith(conf, cardIds)
})

it('does nothing when no cards found', async () => {
	getCardIdsMock.mockResolvedValueOnce([])

	await run(pr, action, conf)

	expect(addCardLinksToPullRequest).not.toHaveBeenCalled()
})

it('sets job failed and throws error when error', async () => {
	const error = new Error('Error')

	getCardIdsMock.mockRejectedValueOnce(error)

	await expect(run(pr, action, conf)).rejects.toThrow(error)
	expect(setFailed).toHaveBeenCalledWith(error)
	expect(addCardLinksToPullRequest).not.toHaveBeenCalled()
})
