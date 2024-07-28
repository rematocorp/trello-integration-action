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
	githubUsersToTrelloUsers?: string[]
	githubAddLabelsToPr?: boolean
	githubConflictingLabels?: string[]
	githubLabelsToTrelloLabels?: string[]
	trelloOrganizationName?: string
	trelloBoardId?: string
	trelloListIdPrDraft?: string
	trelloListIdPrOpen?: string
	trelloListIdPrChangesRequested?: string
	trelloListIdPrApproved?: string
	trelloListIdPrClosed?: string
	trelloArchiveOnMerge?: boolean
	trelloAddMembersToCards?: boolean
	trelloSwitchMembersInReview?: boolean
	trelloRemoveUnrelatedMembers?: boolean
	trelloConflictingLabels?: string[]
	trelloAddLabelsToCards?: boolean
	trelloAddPrLabels?: boolean
	trelloAddBranchCategoryLabel?: boolean
}

export type PR = Omit<
	Exclude<typeof context.payload.pull_request | typeof context.payload.issue, undefined>,
	'body'
> & {
	body?: string | null // Resolves inconsistent type from octokit and context
}
export type PRHead = { ref: string }

export type BoardLabel = { id: string; name: string }

export type CardId = string
export type Card = {
	id: CardId
	idShort: number
	idBoard: string
	idMembers: string[]
	labels: BoardLabel[]
	url: string
	shortUrl: string
	shortLink: string
	actions: {
		data: {
			card: {
				idShort: number
			}
		}
	}[]
}
