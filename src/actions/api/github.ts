import { getInput } from '@actions/core'
import { getOctokit, context } from '@actions/github'
import logger from '../utils/logger'

const githubToken = getInput('github-token', { required: true })

const octokit = getOctokit(githubToken)
const payload = context.payload
const owner = (payload.organization || payload.repository?.owner)?.login
const repo = payload.repository?.name as string
const issueNumber = (payload.pull_request || payload.issue)?.number as number

export async function getPullRequestComments() {
	const response = await octokit.rest.issues.listComments({
		owner,
		repo,
		issue_number: issueNumber,
	})

	return response.data
}

export async function getPullRequest() {
	const response = await octokit.rest.issues.get({
		owner,
		repo,
		issue_number: issueNumber,
	})

	return response.data
}

export async function getBranchName() {
	const response = await octokit.rest.pulls.get({
		owner,
		repo,
		pull_number: issueNumber,
	})

	return response.data.head.ref
}

export async function getCommits() {
	const response = await octokit.rest.pulls.listCommits({
		owner,
		repo,
		pull_number: issueNumber,
	})

	return response.data
}

export async function getRepoLabels() {
	const response = await octokit.rest.issues.listLabelsForRepo({
		owner,
		repo,
	})

	return response.data
}

export async function getLabels() {
	const response = await octokit.rest.issues.listLabelsOnIssue({
		owner,
		repo,
		issue_number: issueNumber,
	})

	return response.data
}

export async function isPullRequestMerged() {
	try {
		await octokit.rest.pulls.checkIfMerged({
			owner,
			repo,
			pull_number: issueNumber,
		})

		return true
	} catch (e) {
		return false
	}
}

export async function getPullRequestReviews() {
	const response = await octokit.rest.pulls.listReviews({
		owner,
		repo,
		pull_number: issueNumber,
	})

	return response.data
}

export async function getPullRequestRequestedReviewers() {
	const response = await octokit.rest.pulls.listRequestedReviewers({
		owner,
		repo,
		pull_number: issueNumber,
	})

	return response.data
}

export async function createComment(shortUrl: string) {
	logger.log('Creating PR comment', shortUrl)

	await octokit.rest.issues.createComment({
		owner,
		repo,
		issue_number: issueNumber,
		body: shortUrl,
	})
}

export async function updatePullRequestBody(newBody: string) {
	logger.log('Updating PR body', newBody)

	await octokit.rest.issues.update({
		owner,
		repo,
		issue_number: issueNumber,
		body: newBody,
	})
}

export async function addLabels(labels: string[]) {
	logger.log('Adding labels to PR', labels)

	const response = await octokit.rest.issues.addLabels({
		owner,
		repo,
		issue_number: issueNumber,
		labels,
	})

	return response.data
}
