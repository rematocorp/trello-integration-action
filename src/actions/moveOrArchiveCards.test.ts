import { isPullRequestMerged, getPullRequestReviews, getPullRequestRequestedReviewers, getBaseBranchName } from './api/github'
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
const getBaseBranchNameMock = getBaseBranchName as jest.Mock
const getPullRequestReviewsMock = getPullRequestReviews as jest.Mock
const getPullRequestRequestedReviewersMock = getPullRequestRequestedReviewers as jest.Mock

const basePR = { number: 0, state: 'open', title: 'Title' }

describe('Moving cards', () => {
	describe('PR is added to draft', () => {
		const pr = { ...basePR, body: 'https://trello.com/c/card/title' }
		const conf = { trelloListIdPrDraft: 'draft-list-id' }

		it('moves the card to Draft list', async () => {
			await moveOrArchiveCards(conf, ['card'], { ...pr, draft: true })
			expect(moveCardToList).toHaveBeenCalledWith('card', 'draft-list-id', undefined)

			await moveOrArchiveCards(conf, ['card'], { ...pr, title: '[DRAFT] Title' })
			expect(moveCardToList).toHaveBeenNthCalledWith(2, 'card', 'draft-list-id', undefined)

			await moveOrArchiveCards(conf, ['card'], { ...pr, title: '[WIP] Title' })
			expect(moveCardToList).toHaveBeenNthCalledWith(3, 'card', 'draft-list-id', undefined)
		})

		it('skips move when list not configured', async () => {
			await moveOrArchiveCards({}, ['card'], pr)
			expect(moveCardToList).not.toHaveBeenCalled()
		})
	})

	describe('PR is opened', () => {
		const pr = { ...basePR, body: 'https://trello.com/c/card/title' }
		const conf = { trelloListIdPrOpen: 'open-list-id' }

		it('moves the card to Open list', async () => {
			await moveOrArchiveCards(conf, ['card'], pr)
			expect(moveCardToList).toHaveBeenCalledWith('card', 'open-list-id', undefined)
		})

		it('skips move when list not configured', async () => {
			await moveOrArchiveCards({}, ['card'], pr)
			expect(moveCardToList).not.toHaveBeenCalled()
		})
	})

	describe('PR review requests changes', () => {
		const pr = { ...basePR, body: 'https://trello.com/c/card/title' }
		const conf = { trelloListIdPrChangesRequested: 'changes-requested-list-id' }

		beforeEach(() => {
			getPullRequestReviewsMock.mockResolvedValue([{ state: 'CHANGES_REQUESTED', user: { id: 'user-id' } }])
		})

		it('moves the card to Changes requested list', async () => {
			await moveOrArchiveCards(conf, ['card'], pr)
			expect(moveCardToList).toHaveBeenCalledWith('card', 'changes-requested-list-id', undefined)
		})

		it('moves the card to Changes requested list after approving changes', async () => {
			getPullRequestReviewsMock.mockResolvedValue([
				{ state: 'APPROVED', user: { id: 'user-1' } },
				{ state: 'CHANGES_REQUESTED', user: { id: 'user-1' } },
			])

			await moveOrArchiveCards(conf, ['card'], pr)

			expect(moveCardToList).toHaveBeenCalledWith('card', 'changes-requested-list-id', undefined)
		})

		it('moves the card to Changes requested list while writing another review', async () => {
			getPullRequestReviewsMock.mockResolvedValue([
				{ state: 'CHANGES_REQUESTED', user: { id: 'user-1' } },
				{ state: 'PENDING', user: { id: 'user-1' } },
			])

			await moveOrArchiveCards(conf, ['card'], pr)

			expect(moveCardToList).toHaveBeenCalledWith('card', 'changes-requested-list-id', undefined)
		})

		it('skips move when review is re-requested', async () => {
			getPullRequestRequestedReviewersMock.mockResolvedValue({ users: [{ id: 'user-id' }] })

			await moveOrArchiveCards(conf, ['card'], pr)

			expect(moveCardToList).not.toHaveBeenCalled()
		})

		it('skips move when list not configured', async () => {
			await moveOrArchiveCards({}, ['card'], pr)
			expect(moveCardToList).not.toHaveBeenCalled()
		})
	})

	describe('PR is approved', () => {
		const pr = { ...basePR, body: 'https://trello.com/c/card/title' }
		const conf = { trelloListIdPrApproved: 'approved-list-id' }

		beforeEach(() => {
			getPullRequestReviewsMock.mockResolvedValue([{ state: 'APPROVED' }])
		})

		it('moves the card to Approved list', async () => {
			await moveOrArchiveCards(conf, ['card'], pr)
			expect(moveCardToList).toHaveBeenCalledWith('card', 'approved-list-id', undefined)
		})

		it('moves the card to Approved list after requesting changes', async () => {
			getPullRequestReviewsMock.mockResolvedValue([
				{ state: 'CHANGES_REQUESTED', user: { id: 'user-1' } },
				{ state: 'APPROVED', user: { id: 'user-1' } },
			])

			await moveOrArchiveCards(conf, ['card'], pr)

			expect(moveCardToList).toHaveBeenCalledWith('card', 'approved-list-id', undefined)
		})

		it('skips move when someone else has requested changes', async () => {
			getPullRequestReviewsMock.mockResolvedValue([
				{ state: 'APPROVED', user: { id: 'user-1' } },
				{ state: 'CHANGES_REQUESTED', user: { id: 'user-2' } },
			])

			await moveOrArchiveCards(conf, ['card'], pr)

			expect(moveCardToList).not.toHaveBeenCalled()
		})

		it('skips move when someone else has requested changes while writing another review', async () => {
			getPullRequestReviewsMock.mockResolvedValue([
				{ state: 'APPROVED', user: { id: 'user-1' } },
				{ state: 'CHANGES_REQUESTED', user: { id: 'user-2' } },
				{ state: 'PENDING', user: { id: 'user-2' } },
			])

			await moveOrArchiveCards(conf, ['card'], pr)

			expect(moveCardToList).not.toHaveBeenCalled()
		})

		it('skips move when someone has already moved the card', async () => {
			moveCardToListMock.mockRejectedValue({
				response: { data: { message: 'The card has moved to a different board.' } },
			})

			await expect(moveOrArchiveCards(conf, ['card'], pr)).resolves.not.toThrow()
		})

		it('throws error when move goes wrong for unknown reason', async () => {
			moveCardToListMock.mockRejectedValue({ response: { status: 500 } })

			await expect(moveOrArchiveCards(conf, ['card'], pr)).rejects.toMatchObject({ response: { status: 500 } })
		})

		it('skips move when list not configured', async () => {
			await moveOrArchiveCards({}, ['card'], pr)
			expect(moveCardToList).not.toHaveBeenCalled()
		})
	})

	describe('PR is merged', () => {
		const pr = { ...basePR, state: 'closed', body: 'https://trello.com/c/card/title' }
		const conf = { trelloListIdPrMerged: 'merged-list-id', trelloListIdPrClosed: 'closed-list-id' }

		beforeEach(() => isPullRequestMergedMock.mockResolvedValueOnce(true))

		it('moves the card to Merged list', async () => {
			await moveOrArchiveCards(conf, ['card'], pr)
			expect(moveCardToList).toHaveBeenCalledWith('card', 'merged-list-id', undefined)
		})

		it('skips move when list not configured', async () => {
			await moveOrArchiveCards({}, ['card'], pr)
			expect(moveCardToList).not.toHaveBeenCalled()
		})
	})
	
	describe('PR is merged to production', () => {
		const pr = { ...basePR, state: 'closed', body: 'https://trello.com/c/card/title' }
		const conf = { trelloListIdPrMergedProd: 'merged-prod-list-id', githubProductionBranch: 'prod' }

		beforeEach(() => isPullRequestMergedMock.mockResolvedValueOnce(true))
		beforeEach(() => getBaseBranchNameMock.mockResolvedValueOnce('prod'))

		it('moves the card to merged prod list', async () => {
			await moveOrArchiveCards(conf, ['card'], pr)
			expect(moveCardToList).toHaveBeenCalledWith('card', 'merged-prod-list-id', undefined)
		})

		it('skips move when list not configured', async () => {
			await moveOrArchiveCards({}, ['card'], pr)
			expect(moveCardToList).not.toHaveBeenCalled()
		})
	})

	describe('PR is closed', () => {
		const pr = { ...basePR, state: 'closed', body: 'https://trello.com/c/card/title' }
		const conf = { trelloListIdPrClosed: 'closed-list-id' }

		it('moves the card to Closed list', async () => {
			await moveOrArchiveCards(conf, ['card'], pr)
			expect(moveCardToList).toHaveBeenCalledWith('card', 'closed-list-id', undefined)
		})

		it('skips move when list not configured', async () => {
			await moveOrArchiveCards({}, ['card'], pr)
			expect(moveCardToList).not.toHaveBeenCalled()
		})
	})

	describe('configured board id', () => {
		const pr = { ...basePR, state: 'closed', body: 'https://trello.com/c/card/title' }
		const conf = { trelloListIdPrClosed: 'closed-list-id', trelloBoardId: 'board-id' }

		it('moves to the board', async () => {
			await moveOrArchiveCards(conf, ['card'], pr)
			expect(moveCardToList).toHaveBeenCalledWith('card', 'closed-list-id', 'board-id')
		})
	})

	describe('multiple list ids', () => {
		const pr = { ...basePR, state: 'closed', body: 'https://trello.com/c/card/title' }
		const conf = { trelloListIdPrClosed: 'closed-list-id;another-closed-list-id' }

		it('moves to the list on the board where the card is currently located', async () => {
			getCardInfoMock.mockResolvedValueOnce({ idBoard: 'board-id' })
			getBoardListsMock.mockResolvedValueOnce([{ id: 'another-closed-list-id' }])

			await moveOrArchiveCards(conf, ['card'], pr)

			expect(getBoardListsMock).toHaveBeenCalledWith('board-id')
			expect(moveCardToList).toHaveBeenCalledWith('card', 'another-closed-list-id')
		})

		it('moves to first configured list when none of the lists exist on the current board', async () => {
			getCardInfoMock.mockResolvedValueOnce({ idBoard: 'board-id' })
			getBoardListsMock.mockResolvedValueOnce([{ id: 'list-id' }])

			await moveOrArchiveCards(conf, ['card'], pr)

			expect(moveCardToList).toHaveBeenCalledWith('card', 'closed-list-id')
		})
	})
})

describe('Archiving cards on merge', () => {
	const pr = { ...basePR, state: 'closed', body: 'https://trello.com/c/card/title' }

	beforeEach(() => isPullRequestMergedMock.mockResolvedValueOnce(true))

	it('archives cards and does not move to closed list', async () => {
		await moveOrArchiveCards({ trelloListIdPrClosed: 'closed-list-id', trelloArchiveOnMerge: true }, ['card'], pr)

		expect(archiveCardMock).toHaveBeenCalledWith('card')
		expect(moveCardToList).not.toHaveBeenCalled()
	})

	it('archives cards and does not move to merged list', async () => {
		await moveOrArchiveCards({ trelloListIdPrMerged: 'merged-list-id', trelloArchiveOnMerge: true }, ['card'], pr)

		expect(archiveCardMock).toHaveBeenCalledWith('card')
		expect(moveCardToList).not.toHaveBeenCalled()
	})

	it('skips archiving when not configured', async () => {
		await moveOrArchiveCards({}, ['card'], pr)
		expect(archiveCardMock).not.toHaveBeenCalled()
	})
})
