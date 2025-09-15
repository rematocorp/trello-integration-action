import {
	getPullRequestRequestedReviewers,
	getPullRequestReviews,
	getTargetBranchName,
	isPullRequestMerged,
} from './api/github'
import { archiveCard, getBoardLists, getCardInfo, moveCardToList } from './api/trello'
import moveOrArchiveCards from './moveOrArchiveCards'

jest.mock('@actions/core')
jest.mock('@actions/github')
jest.mock('./api/github')
jest.mock('./api/trello')

const moveCardToListMock = moveCardToList as jest.Mock
const getCardInfoMock = getCardInfo as jest.Mock
const getBoardListsMock = getBoardLists as jest.Mock
const archiveCardMock = archiveCard as jest.Mock
const isPullRequestMergedMock = isPullRequestMerged as jest.Mock
const getPullRequestReviewsMock = getPullRequestReviews as jest.Mock
const getPullRequestRequestedReviewersMock = getPullRequestRequestedReviewers as jest.Mock
const getTargetBranchNameMock = getTargetBranchName as jest.Mock

const basePR = { number: 0, state: 'open', title: 'Title' }

describe('Moving cards', () => {
	describe('PR is added to draft', () => {
		const action = 'converted_to_draft'
		const pr = { ...basePR, body: 'https://trello.com/c/card/title' }
		const conf = { trelloListIdPrDraft: 'draft-list-id' }

		it('moves the card to Draft list', async () => {
			await moveOrArchiveCards(conf, ['card'], { ...pr, draft: true }, action)
			expect(moveCardToList).toHaveBeenCalledWith('card', 'draft-list-id', undefined)

			await moveOrArchiveCards(conf, ['card'], { ...pr, title: '[DRAFT] Title' }, action)
			expect(moveCardToList).toHaveBeenNthCalledWith(2, 'card', 'draft-list-id', undefined)

			await moveOrArchiveCards(conf, ['card'], { ...pr, title: '[WIP] Title' }, action)
			expect(moveCardToList).toHaveBeenNthCalledWith(3, 'card', 'draft-list-id', undefined)
		})

		it('skips move when list not configured', async () => {
			await moveOrArchiveCards({}, ['card'], pr, action)
			expect(moveCardToList).not.toHaveBeenCalled()
		})
	})

	describe('PR is opened', () => {
		const action = 'opened'
		const pr = { ...basePR, body: 'https://trello.com/c/card/title' }
		const conf = { trelloListIdPrOpen: 'open-list-id' }

		it('moves the card to Open list', async () => {
			await moveOrArchiveCards(conf, ['card'], pr, action)
			expect(moveCardToList).toHaveBeenCalledWith('card', 'open-list-id', undefined)
		})

		it('skips move when list not configured', async () => {
			await moveOrArchiveCards({}, ['card'], pr, action)
			expect(moveCardToList).not.toHaveBeenCalled()
		})
	})

	describe('PR review requests changes', () => {
		const action = 'review_requested'
		const pr = { ...basePR, body: 'https://trello.com/c/card/title' }
		const conf = { trelloListIdPrChangesRequested: 'changes-requested-list-id' }

		beforeEach(() => {
			getPullRequestReviewsMock.mockResolvedValue([{ state: 'CHANGES_REQUESTED', user: { id: 'user-id' } }])
		})

		it('moves the card to Changes requested list', async () => {
			await moveOrArchiveCards(conf, ['card'], pr, action)
			expect(moveCardToList).toHaveBeenCalledWith('card', 'changes-requested-list-id', undefined)
		})

		it('moves the card to Changes requested list after approving changes', async () => {
			getPullRequestReviewsMock.mockResolvedValue([
				{ state: 'APPROVED', user: { id: 'user-1' } },
				{ state: 'CHANGES_REQUESTED', user: { id: 'user-1' } },
			])

			await moveOrArchiveCards(conf, ['card'], pr, action)

			expect(moveCardToList).toHaveBeenCalledWith('card', 'changes-requested-list-id', undefined)
		})

		it('moves the card to Changes requested list while writing another review', async () => {
			getPullRequestReviewsMock.mockResolvedValue([
				{ state: 'CHANGES_REQUESTED', user: { id: 'user-1' } },
				{ state: 'PENDING', user: { id: 'user-1' } },
			])

			await moveOrArchiveCards(conf, ['card'], pr, action)

			expect(moveCardToList).toHaveBeenCalledWith('card', 'changes-requested-list-id', undefined)
		})

		it('skips move when review is re-requested', async () => {
			getPullRequestRequestedReviewersMock.mockResolvedValue({ users: [{ id: 'user-id' }] })

			await moveOrArchiveCards(conf, ['card'], pr, action)

			expect(moveCardToList).not.toHaveBeenCalled()
		})

		it('skips move when list not configured', async () => {
			await moveOrArchiveCards({}, ['card'], pr, action)
			expect(moveCardToList).not.toHaveBeenCalled()
		})
	})

	describe('PR is approved', () => {
		const action = 'submitted'
		const pr = { ...basePR, body: 'https://trello.com/c/card/title' }
		const conf = { trelloListIdPrApproved: 'approved-list-id' }

		beforeEach(() => {
			getPullRequestReviewsMock.mockResolvedValue([{ state: 'APPROVED' }])
		})

		it('moves the card to Approved list', async () => {
			await moveOrArchiveCards(conf, ['card'], pr, action)
			expect(moveCardToList).toHaveBeenCalledWith('card', 'approved-list-id', undefined)
		})

		it('moves the card to Approved list after requesting changes', async () => {
			getPullRequestReviewsMock.mockResolvedValue([
				{ state: 'CHANGES_REQUESTED', user: { id: 'user-1' } },
				{ state: 'APPROVED', user: { id: 'user-1' } },
			])

			await moveOrArchiveCards(conf, ['card'], pr, action)

			expect(moveCardToList).toHaveBeenCalledWith('card', 'approved-list-id', undefined)
		})

		it('skips move when someone else has requested changes', async () => {
			getPullRequestReviewsMock.mockResolvedValue([
				{ state: 'APPROVED', user: { id: 'user-1' } },
				{ state: 'CHANGES_REQUESTED', user: { id: 'user-2' } },
			])

			await moveOrArchiveCards(conf, ['card'], pr, action)

			expect(moveCardToList).not.toHaveBeenCalled()
		})

		it('skips move when someone else has requested changes while writing another review', async () => {
			getPullRequestReviewsMock.mockResolvedValue([
				{ state: 'APPROVED', user: { id: 'user-1' } },
				{ state: 'CHANGES_REQUESTED', user: { id: 'user-2' } },
				{ state: 'PENDING', user: { id: 'user-2' } },
			])

			await moveOrArchiveCards(conf, ['card'], pr, action)

			expect(moveCardToList).not.toHaveBeenCalled()
		})

		it('skips move when someone has already moved the card', async () => {
			moveCardToListMock.mockRejectedValue({
				response: { data: { message: 'The card has moved to a different board.' } },
			})

			await expect(moveOrArchiveCards(conf, ['card'], pr, action)).resolves.not.toThrow()
		})

		it('throws error when move goes wrong for unknown reason', async () => {
			moveCardToListMock.mockRejectedValue({ response: { status: 500 } })

			await expect(moveOrArchiveCards(conf, ['card'], pr, action)).rejects.toMatchObject({
				response: { status: 500 },
			})
		})

		it('skips move when list not configured', async () => {
			await moveOrArchiveCards({}, ['card'], pr, action)
			expect(moveCardToList).not.toHaveBeenCalled()
		})
	})

	describe('PR is merged', () => {
		const action = 'closed'
		const pr = { ...basePR, state: 'closed', body: 'https://trello.com/c/card/title' }
		const conf = { trelloListIdPrMerged: 'merged-list-id', trelloListIdPrClosed: 'closed-list-id' }

		beforeEach(() => isPullRequestMergedMock.mockResolvedValueOnce(true))

		it('moves the card to Merged list', async () => {
			await moveOrArchiveCards(conf, ['card'], pr, action)
			expect(moveCardToList).toHaveBeenCalledWith('card', 'merged-list-id', undefined)
		})

		it('skips move should happen only on merge action and current action is something else', async () => {
			await moveOrArchiveCards({ ...conf, trelloMoveToMergedListOnlyOnMerge: true }, ['card'], pr, 'edited')
			expect(moveCardToList).not.toHaveBeenCalled()
		})

		it('skips move when list not configured', async () => {
			await moveOrArchiveCards({}, ['card'], pr, action)
			expect(moveCardToList).not.toHaveBeenCalled()
		})
	})

	describe('PR is closed', () => {
		const action = 'closed'
		const pr = { ...basePR, state: 'closed', body: 'https://trello.com/c/card/title' }
		const conf = { trelloListIdPrClosed: 'closed-list-id' }

		it('moves the card to Closed list', async () => {
			await moveOrArchiveCards(conf, ['card'], pr, action)
			expect(moveCardToList).toHaveBeenCalledWith('card', 'closed-list-id', undefined)
		})

		it('skips move when list not configured', async () => {
			await moveOrArchiveCards({}, ['card'], pr, action)
			expect(moveCardToList).not.toHaveBeenCalled()
		})
	})

	describe('configured board id', () => {
		const action = 'closed'
		const pr = { ...basePR, state: 'closed', body: 'https://trello.com/c/card/title' }
		const conf = { trelloListIdPrClosed: 'closed-list-id', trelloBoardId: 'board-id' }

		it('moves to the board', async () => {
			await moveOrArchiveCards(conf, ['card'], pr, action)
			expect(moveCardToList).toHaveBeenCalledWith('card', 'closed-list-id', 'board-id')
		})
	})

	describe('override list id', () => {
		const action = 'closed'
		const pr = { ...basePR, state: 'closed', body: 'https://trello.com/c/card/title' }
		const conf = { trelloListIdOverride: 'override-list-id', trelloListIdPrClosed: 'closed-list-id' }

		it('moves the card to the override list id', async () => {
			await moveOrArchiveCards(conf, ['card'], pr, action)
			expect(moveCardToList).toHaveBeenCalledWith('card', 'override-list-id', undefined)
		})
	})

	describe('multiple list ids', () => {
		const action = 'edited'
		const pr = { ...basePR, state: 'closed', body: 'https://trello.com/c/card/title' }
		const conf = { trelloListIdPrClosed: 'closed-list-id;another-closed-list-id' }

		it('moves to the list on the board where the card is currently located', async () => {
			getCardInfoMock.mockResolvedValueOnce({ idBoard: 'board-id' })
			getBoardListsMock.mockResolvedValueOnce([{ id: 'another-closed-list-id' }])

			await moveOrArchiveCards(conf, ['card'], pr, action)

			expect(getBoardListsMock).toHaveBeenCalledWith('board-id')
			expect(moveCardToList).toHaveBeenCalledWith('card', 'another-closed-list-id')
		})

		it('moves to first configured list when none of the lists exist on the current board', async () => {
			getCardInfoMock.mockResolvedValueOnce({ idBoard: 'board-id' })
			getBoardListsMock.mockResolvedValueOnce([{ id: 'list-id' }])

			await moveOrArchiveCards(conf, ['card'], pr, action)

			expect(moveCardToList).toHaveBeenCalledWith('card', 'closed-list-id')
		})
	})

	describe('list ids and branch names map', () => {
		const action = 'edited'
		const pr = { ...basePR, state: 'closed', body: 'https://trello.com/c/card/title' }
		const conf = { trelloListIdPrClosed: 'release/*:release-list-id\n*:merged-list-id' }

		it('moves to the list according to target branch name', async () => {
			getTargetBranchNameMock.mockResolvedValueOnce('release/21.19.0')

			await moveOrArchiveCards(conf, ['card'], pr, action)

			expect(moveCardToList).toHaveBeenCalledWith('card', 'release-list-id', undefined)
		})

		it('moves to fallback list', async () => {
			getTargetBranchNameMock.mockResolvedValueOnce('develop')

			await moveOrArchiveCards(conf, ['card'], pr, action)

			expect(moveCardToList).toHaveBeenCalledWith('card', 'merged-list-id', undefined)
		})

		it('does nothing when no fallback', async () => {
			getTargetBranchNameMock.mockResolvedValueOnce('develop')

			await moveOrArchiveCards({ trelloListIdPrClosed: 'release/*:release-list-id' }, ['card'], pr, action)

			expect(moveCardToList).not.toHaveBeenCalled()
		})
	})
})

describe('Archiving cards on merge', () => {
	const action = 'closed'
	const pr = { ...basePR, state: 'closed', body: 'https://trello.com/c/card/title' }

	beforeEach(() => isPullRequestMergedMock.mockResolvedValueOnce(true))

	it('archives cards and does not move to closed list', async () => {
		await moveOrArchiveCards(
			{ trelloListIdPrClosed: 'closed-list-id', trelloArchiveOnMerge: true },
			['card'],
			pr,
			action,
		)

		expect(archiveCardMock).toHaveBeenCalledWith('card')
		expect(moveCardToList).not.toHaveBeenCalled()
	})

	it('archives cards and does not move to merged list', async () => {
		await moveOrArchiveCards(
			{ trelloListIdPrMerged: 'merged-list-id', trelloArchiveOnMerge: true },
			['card'],
			pr,
			action,
		)

		expect(archiveCardMock).toHaveBeenCalledWith('card')
		expect(moveCardToList).not.toHaveBeenCalled()
	})

	it('skips archiving when not configured', async () => {
		await moveOrArchiveCards({}, ['card'], pr, action)
		expect(archiveCardMock).not.toHaveBeenCalled()
	})
})
