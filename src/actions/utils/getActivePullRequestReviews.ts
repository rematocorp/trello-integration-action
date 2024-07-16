import { getPullRequestRequestedReviewers, getPullRequestReviews } from '../api/github'

/**
 * Returns all pull request reviews that are still relevant
 *
 * @returns https://docs.github.com/en/graphql/reference/objects#pullrequestreview
 */
export default async function getActivePullRequestReviews(): Promise<{ state: string }[]> {
	const reviews = await getPullRequestReviews()
	const requestedReviewers = await getPullRequestRequestedReviewers()

	// Filters out pending reviews
	const submittedReviews = reviews?.filter((review) => review.state !== 'PENDING')

	// Filters in only the latest review per person
	const latestReviews = Array.from(
		submittedReviews?.reduce((map, review) => map.set(review.user?.id, review), new Map()).values() || [],
	)

	// Filters out reviews by people who have been re-requested for review
	return latestReviews.filter((r) => !requestedReviewers?.users.some((u) => u.id === r.user?.id))
}
