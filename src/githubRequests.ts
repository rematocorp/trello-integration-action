import { getInput } from '@actions/core'
import { getOctokit, context } from '@actions/github'

const githubToken = getInput('github-token', { required: true })

const octokit = getOctokit(githubToken)
const payload = context.payload
const repoOwner = (payload.organization || payload.repository?.owner)?.login
const issueNumber = (payload.pull_request || payload.issue)?.number

export async function getPullRequestComments() {
	const response = await octokit.rest.issues.listComments({
		owner: repoOwner,
		repo: payload.repository!.name,
		issue_number: issueNumber!,
	})

	return response.data
}

export async function getPullRequestAssignees() {
	const response = await octokit.rest.issues.get({
		owner: repoOwner,
		repo: payload.repository!.name,
		issue_number: issueNumber!,
	})

	return [...(response.data.assignees || []), response.data.user]
}

export async function getBranchName() {
	const response = await octokit.rest.pulls.get({
		owner: repoOwner,
		repo: payload.repository!.name,
		pull_number: issueNumber!,
	})

	return response.data.head.ref
}

export async function createComment(shortUrl: string) {
	await octokit.rest.issues.createComment({
		owner: repoOwner,
		repo: payload.repository!.name,
		issue_number: issueNumber!,
		body: shortUrl,
	})
}
