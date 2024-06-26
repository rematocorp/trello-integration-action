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
	githubUsersToTrelloUsers?: string
	trelloOrganizationName?: string
	trelloListIdPrDraft?: string
	trelloListIdPrOpen?: string
	trelloListIdPrClosed?: string
	trelloBoardId?: string
	trelloConflictingLabels?: string[]
	trelloAddLabelsToCards?: boolean
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
