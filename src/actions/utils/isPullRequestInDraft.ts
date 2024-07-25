import logger from './logger'

export default function isPullRequestInDraft(pr: any) {
	// Treat PRs with “draft” or “wip” in brackets at the start or
	// end of the titles like drafts. Useful for orgs on unpaid
	// plans which doesn’t support PR drafts.
	const titleDraftRegExp = /^(?:\s*[\[(](?:wip|draft)[\])]\s+)|(?:\s+[\[(](?:wip|draft)[\])]\s*)$/i
	const isRealDraft = pr.draft === true
	const isFauxDraft = Boolean(pr.title.match(titleDraftRegExp))

	if (isFauxDraft) {
		logger.log('This PR is in faux draft')
	}

	return isRealDraft || isFauxDraft
}
