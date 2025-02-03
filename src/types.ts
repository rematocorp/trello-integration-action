import { context } from '@actions/github'

export interface Conf {
	githubRequireKeywordPrefix?: boolean
	githubRequireTrelloCard?: boolean
	githubEnableRelatedKeywordPrefix?: boolean
	githubIncludePrComments?: boolean
	githubIncludePrCommitMessages?: boolean
	githubIncludePrBranchName?: boolean
	githubAllowMultipleCardsInPrBranchName?: boolean
	githubIncludeNewCardCommand?: boolean
	githubCreateNewCardOnMerge?: boolean
	githubUsersToTrelloUsers?: string
	trelloOrganizationName?: string
	trelloListIdPrDraft?: string
	trelloListIdPrOpen?: string
	trelloListIdPrChangesRequested?: string
	trelloListIdPrApproved?: string
	trelloListIdPrClosed?: string
	trelloListIdPrMerged?: string
	trelloBoardId?: string
	trelloConflictingLabels?: string[]
	trelloAddLabelsToCards?: boolean
	trelloAddMembersToCards?: boolean
	trelloSwitchMembersInReview?: boolean
	trelloRemoveUnrelatedMembers?: boolean
	trelloArchiveOnMerge?: boolean
}

export type PR = Omit<
	Exclude<typeof context.payload.pull_request | typeof context.payload.issue, undefined>,
	'body'
> & {
	body?: string | null // Resolves inconsistent type from octokit and context
}
export type PRHead = { ref: string }

export type BoardLabel = { id: string; name: string }

export type Card = {
	id: string
	idShort: number
	idBoard: string
	idMembers: string[]
	labels: BoardLabel[]
	url: string
	shortUrl: string
	shortLink: string
}

export type CardActions = {
	data: {
		card: {
			idShort: number
		}
	}
}[]

export type TrelloMember = {
	id: string
	organizations: {
		name: string
	}[]
}
