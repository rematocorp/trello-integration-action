import { setFailed } from '@actions/core'
import { run } from './main'
import {
	moveCardToList,
	searchTrelloCards,
	addAttachmentToCard,
	getCardAttachments,
	getCardInfo,
	addMemberToCard,
	getMemberInfo,
	removeMemberFromCard,
	getBoardLabels,
	addLabelToCard,
	getBoardLists,
} from './trelloRequests'
import { getPullRequestComments, getBranchName, createComment, getPullRequestAssignees } from './githubRequests'

jest.mock('@actions/core')
jest.mock('@actions/github')
jest.mock('./githubRequests')
jest.mock('./trelloRequests')

const getPullRequestAssigneesMock = getPullRequestAssignees as jest.Mock
const getMemberInfoMock = getMemberInfo as jest.Mock
const getCardInfoMock = getCardInfo as jest.Mock
const getPullRequestCommentsMock = getPullRequestComments as jest.Mock
const getBranchNameMock = getBranchName as jest.Mock
const searchTrelloCardsMock = searchTrelloCards as jest.Mock
const getCardAttachmentsMock = getCardAttachments as jest.Mock
const getBoardLabelsMock = getBoardLabels as jest.Mock
const getBoardListsMock = getBoardLists as jest.Mock

const basePR = { number: 0, state: 'open', title: 'Title' }

describe('PR does not have Trello card URL', () => {
	const pr = basePR
	const conf = { trelloListIdPrOpen: 'open-list-id' }

	it('does nothing', async () => {
		await run(pr, conf)

		expect(moveCardToList).not.toHaveBeenCalled()
	})

	describe('githubRequireTrelloCard is enabled', () => {
		it('fails the job', async () => {
			await run(pr, { ...conf, githubRequireTrelloCard: true })

			expect(setFailed).toHaveBeenCalledWith('The PR does not contain a link to a Trello card')
			expect(moveCardToList).not.toHaveBeenCalled()
		})
	})
})

describe('Finding cards', () => {
	const pr = basePR
	const conf = { trelloListIdPrOpen: 'open-list-id' }

	it('finds card from description', async () => {
		await run({ ...pr, body: 'https://trello.com/c/card/title' }, conf)
		expect(moveCardToList).toHaveBeenCalledWith('card', 'open-list-id', undefined)
	})

	it('finds card from comments', async () => {
		getPullRequestCommentsMock.mockResolvedValueOnce([{ body: 'https://trello.com/c/card/title' }])

		await run(pr, { ...conf, githubIncludePrComments: true })

		expect(moveCardToList).toHaveBeenCalledWith('card', 'open-list-id', undefined)
	})

	it('finds card from branch name', async () => {
		getBranchNameMock.mockResolvedValueOnce('1-card')
		getCardInfoMock.mockResolvedValueOnce({ shortUrl: 'short-url' })
		searchTrelloCardsMock.mockResolvedValueOnce([{ id: 'card' }])

		await run(pr, { ...conf, githubIncludePrBranchName: true })

		expect(searchTrelloCards).toHaveBeenCalledWith('1-card')
		expect(moveCardToList).toHaveBeenCalledWith('card', 'open-list-id', undefined)
	})

	it('finds multiple cards', async () => {
		await run({ ...pr, body: 'https://trello.com/c/card1/title, https://trello.com/c/card2/title' }, conf)
		expect(moveCardToList).toHaveBeenCalledWith('card1', 'open-list-id', undefined)
		expect(moveCardToList).toHaveBeenCalledWith('card2', 'open-list-id', undefined)
	})
})

describe('Moving cards', () => {
	describe('PR is added to draft', () => {
		const pr = { ...basePR, body: 'https://trello.com/c/card/title' }
		const conf = { trelloListIdPrDraft: 'draft-list-id' }

		it('moves the card to Draft list', async () => {
			await run({ ...pr, draft: true }, conf)
			expect(moveCardToList).toHaveBeenCalledWith('card', 'draft-list-id', undefined)

			await run({ ...pr, title: '[DRAFT] Title' }, conf)
			expect(moveCardToList).toHaveBeenNthCalledWith(2, 'card', 'draft-list-id', undefined)

			await run({ ...pr, title: '[WIP] Title' }, conf)
			expect(moveCardToList).toHaveBeenNthCalledWith(3, 'card', 'draft-list-id', undefined)
		})

		it('skips move when list not configured', async () => {
			await run(pr, {})
			expect(moveCardToList).not.toHaveBeenCalled()
		})
	})

	describe('PR is opened', () => {
		const pr = { ...basePR, body: 'https://trello.com/c/card/title' }
		const conf = { trelloListIdPrOpen: 'open-list-id' }

		it('moves the card to Open list', async () => {
			await run(pr, conf)
			expect(moveCardToList).toHaveBeenCalledWith('card', 'open-list-id', undefined)
		})

		it('skips move when list not configured', async () => {
			await run(pr, {})
			expect(moveCardToList).not.toHaveBeenCalled()
		})
	})

	describe('PR is closed', () => {
		const pr = { ...basePR, state: 'closed', body: 'https://trello.com/c/card/title' }
		const conf = { trelloListIdPrClosed: 'closed-list-id' }

		it('moves the card to Closed list', async () => {
			await run(pr, conf)
			expect(moveCardToList).toHaveBeenCalledWith('card', 'closed-list-id', undefined)
		})

		it('skips move when list not configured', async () => {
			await run(pr, {})
			expect(moveCardToList).not.toHaveBeenCalled()
		})
	})

	describe('configured board id', () => {
		const pr = { ...basePR, state: 'closed', body: 'https://trello.com/c/card/title' }
		const conf = { trelloListIdPrClosed: 'closed-list-id', trelloBoardId: 'board-id' }

		it('moves to the board', async () => {
			await run(pr, conf)
			expect(moveCardToList).toHaveBeenCalledWith('card', 'closed-list-id', 'board-id')
		})
	})

	describe('multiple list ids', () => {
		const pr = { ...basePR, state: 'closed', body: 'https://trello.com/c/card/title' }
		const conf = { trelloListIdPrClosed: 'closed-list-id;another-closed-list-id' }

		it('moves to the list on the board where the card is currently located', async () => {
			getCardInfoMock.mockResolvedValueOnce({ idBoard: 'board-id' })
			getBoardListsMock.mockResolvedValueOnce([{ id: 'another-closed-list-id' }])

			await run(pr, conf)

			expect(getBoardListsMock).toHaveBeenCalledWith('board-id')
			expect(moveCardToList).toHaveBeenCalledWith('card', 'another-closed-list-id')
		})
	})
})

describe('Adding PR link to card', () => {
	const pr = { ...basePR, body: 'https://trello.com/c/card/title', url: 'pr-url' }

	it('adds link', async () => {
		await run({ ...pr, url: 'pr-url' })
		expect(addAttachmentToCard).toHaveBeenCalledWith('card', 'pr-url')

		await run({ ...pr, html_url: 'pr-html-url' })
		expect(addAttachmentToCard).toHaveBeenCalledWith('card', 'pr-html-url')
	})

	it('skips link adding when already exists', async () => {
		getCardAttachmentsMock.mockResolvedValueOnce([{ url: 'pr-url' }])

		await run({ ...pr, url: 'pr-url' })

		expect(addAttachmentToCard).not.toHaveBeenCalled()
	})
})

describe('Adding card link to PR', () => {
	const pr = basePR
	const conf = { githubIncludePrBranchName: true }

	beforeEach(() => {
		getBranchNameMock.mockResolvedValueOnce('1-card')
		searchTrelloCardsMock.mockResolvedValueOnce([{ id: 'card' }])
	})

	it('adds link', async () => {
		getCardInfoMock.mockResolvedValueOnce({ shortUrl: 'short-url' })

		await run(pr, conf)

		expect(getCardInfo).toHaveBeenCalledWith('card')
		expect(createComment).toHaveBeenCalledWith('short-url')
	})

	it('skips link adding when already in PR description', async () => {
		await run({ ...pr, body: 'https://trello.com/c/card/title' }, conf)
		expect(createComment).not.toHaveBeenCalled()
	})

	it('skips link adding when already in PR comment', async () => {
		getPullRequestCommentsMock.mockResolvedValueOnce([{ body: 'https://trello.com/c/card/title' }])

		await run(pr, conf)

		expect(createComment).not.toHaveBeenCalled()
	})
})

describe('Updating card members', () => {
	const pr = { ...basePR, body: 'https://trello.com/c/card/title' }
	const conf = { githubUsersToTrelloUsers: 'jack: jones\namy: amy1993', trelloRemoveUnrelatedMembers: true }

	it('adds PR author and assignees to the card and removes unrelated members', async () => {
		getPullRequestAssigneesMock.mockResolvedValueOnce([{ login: 'phil' }, { login: 'amy' }])
		getMemberInfoMock.mockImplementation((username) =>
			username === 'amy1993' ? { id: 'amy-id' } : { id: 'phil-id' },
		)
		getCardInfoMock.mockResolvedValueOnce({ id: 'card', idMembers: ['jones-id'] })

		await run(pr, conf)

		expect(addMemberToCard).toHaveBeenCalledWith('card', 'phil-id')
		expect(addMemberToCard).toHaveBeenCalledWith('card', 'amy-id')
		expect(removeMemberFromCard).toHaveBeenCalledWith('card', 'jones-id')
	})

	it('skips removing unrelated members when turned off', async () => {
		getPullRequestAssigneesMock.mockResolvedValueOnce([{ login: 'phil' }])
		getMemberInfoMock.mockResolvedValueOnce({ id: 'phil-id' })
		getCardInfoMock.mockResolvedValueOnce({ id: 'card', idMembers: ['jones-id'] })

		await run(pr, { trelloRemoveUnrelatedMembers: false })

		expect(removeMemberFromCard).not.toHaveBeenCalled()
	})

	it('skips adding when all members are already assigned to the card', async () => {
		getPullRequestAssigneesMock.mockResolvedValueOnce([{ login: 'phil' }])
		getMemberInfoMock.mockResolvedValueOnce({ id: 'phil-id' })
		getCardInfoMock.mockResolvedValueOnce({ id: 'card', idMembers: ['phil-id'] })

		await run(pr)

		expect(addMemberToCard).not.toHaveBeenCalled()
	})
})

describe('Adding labels to card', () => {
	const pr = {
		...basePR,
		body: 'https://trello.com/c/card/title',
		head: { ref: 'chore/clean-code' },
	}
	const conf = { trelloAddLabelsToCards: true }

	it('adds branch category as a card label', async () => {
		getCardInfoMock.mockResolvedValueOnce({ id: 'card', labels: [] })
		getBoardLabelsMock.mockResolvedValueOnce([{ id: 'chore-id', name: 'chore' }])

		await run(pr, conf)

		expect(addLabelToCard).toHaveBeenCalledWith('card', 'chore-id')
	})

	it('skips when turned off', async () => {
		getCardInfoMock.mockResolvedValueOnce({ id: 'card', labels: [] })
		getBoardLabelsMock.mockResolvedValueOnce([{ id: 'chore-id', name: 'chore' }])

		await run(pr, { trelloAddLabelsToCards: false })

		expect(addLabelToCard).not.toHaveBeenCalled()
	})
})
