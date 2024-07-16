import getActivePullRequestReviews from './getActivePullRequestReviews'

export default async function isPullRequestApproved() {
	const reviews = await getActivePullRequestReviews()

	return reviews?.some((review) => review.state === 'APPROVED')
}
