import getActivePullRequestReviews from './getActivePullRequestReviews'

export default async function isChangesRequestedInReview() {
	const reviews = await getActivePullRequestReviews()

	return reviews?.some((review) => review.state === 'CHANGES_REQUESTED')
}
