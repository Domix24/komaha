import { ApplicationFunction, Probot } from "probot"
import zod from "zod"

export const defaultReturn: ApplicationFunction = (app: Probot) => {
	app.on("issues.opened", async (context) => {
		const issueComment = context.issue({
			body: "Thanks for opening this issue!",
		})
		await context.octokit.issues.createComment(issueComment)
	})

	app.on("pull_request.locked", async (context) => {
		const checkOptions = zod
			.object({
				head_sha: zod.string(),
				conclusion: zod.enum(["success"]).optional(),
				completed_at: zod.string().optional(),
				output: zod.object({
					title: zod.string(),
					summary: zod.string(),
				}),
				name: zod.string(),
			})
			.passthrough()
			.parse({
				head_sha: context.payload.pull_request.head.sha,
				name: "Check if bug as label",
				status: "in_progress",
				started_at: new Date().toISOString(),
				output: {
					title: "Bug label not found",
					summary: "Pull request need to have the bug label",
				},
			})
		const labels = await context.octokit.issues.listLabelsOnIssue(
			context.issue(),
		)
		if (labels.data.filter((value) => value.name == "bug").length) {
			checkOptions.conclusion = "success"
			checkOptions.completed_at = new Date().toISOString()
			checkOptions.output.title = "Bug label found"
			checkOptions.output.summary = "Pull request can proceed to the next step"
		}

		await context.octokit.checks.create(context.repo(checkOptions))
	})
	// For more information on building apps:
	// https://probot.github.io/docs/

	// To get your app running against GitHub, see:
	// https://probot.github.io/docs/development/
}

export default defaultReturn
