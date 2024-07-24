import nock from "nock"
import myProbotApp from "../src/index.js"
import { Probot, ProbotOctokit } from "probot"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { describe, beforeEach, afterEach, test } from "vitest"
import zod from "zod"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const privateKey = fs.readFileSync(
	path.join(__dirname, "fixtures/mock-cert.pem"),
	"utf-8",
)
const readJSONPayload = () =>
	zod
		.object({})
		.passthrough()
		.parse(
			JSON.parse(
				fs.readFileSync(
					path.join(__dirname, `fixtures/pull_request.locked.json`),
					"utf-8",
				),
			),
		)
const onBeforeEach = async () => {
	nock.disableNetConnect()
	const probot = new Probot({
		appId: 123,
		privateKey,
		Octokit: ProbotOctokit.defaults({
			retry: { enabled: false },
			throttle: { enabled: false },
		}),
	})

	await probot.load(myProbotApp)
	return probot
}
const onAfterEach = () => {
	nock.cleanAll()
	nock.enableNetConnect()
}

describe("on pull_request.locked", () => {
	let probot: Probot

	beforeEach(async () => {
		probot = await onBeforeEach()
	})
	afterEach(() => {
		onAfterEach()
	})

	test("create a bug label when no labels", async (testContext) => {
		const payload = readJSONPayload()
		const mock = nock("https://api.github.com")
			.get("/repos/myowner/myrepo/issues/1/labels")
			.reply(200, [])
			.post("/repos/myowner/myrepo/check-runs", (body) => {
				const bodyTyped = zod
					.object({
						output: zod.object({}).passthrough(),
					})
					.passthrough()
					.parse(body)
				testContext.expect(bodyTyped.head_sha).eq("theheadsha")
				testContext.expect(bodyTyped.name).eq("Check if bug as label")
				testContext.expect(bodyTyped.status).eq("in_progress")
				testContext.expect(bodyTyped.started_at).toBeDefined()
				testContext.expect(bodyTyped.output.title).eq("Bug label not found")
				testContext
					.expect(bodyTyped.output.summary)
					.eq("Pull request need to have the bug label")
				testContext.expect(bodyTyped.conclusion).toBeUndefined()
				testContext.expect(bodyTyped.completed_at).toBeUndefined()

				return true
			})
			.reply(200)

		await probot.receive({ name: "pull_request", payload: payload } as any) // eslint-disable-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any

		testContext.expect(mock.activeMocks()).toStrictEqual([])
		testContext.expect(mock.pendingMocks()).toStrictEqual([])
	})

	test("do not create a bug label when bug in labels", async (testContext) => {
		const payload = readJSONPayload()
		const mock = nock("https://api.github.com")
			.get("/repos/myowner/myrepo/issues/1/labels")
			.reply(200, [{ name: "bug" }])
			.post("/repos/myowner/myrepo/check-runs", (body) => {
				const bodyTyped = zod
					.object({
						output: zod.object({}).passthrough(),
					})
					.passthrough()
					.parse(body)
				testContext.expect(bodyTyped.head_sha).eq("theheadsha")
				testContext.expect(bodyTyped.name).eq("Check if bug as label")
				testContext.expect(bodyTyped.status).eq("in_progress")
				testContext.expect(bodyTyped.started_at).toBeDefined()
				testContext.expect(bodyTyped.output.title).eq("Bug label found")
				testContext
					.expect(bodyTyped.output.summary)
					.eq("Pull request can proceed to the next step")
				testContext.expect(bodyTyped.conclusion).eq("success")
				testContext.expect(bodyTyped.completed_at).toBeDefined()

				return true
			})
			.reply(200)

		await probot.receive({ name: "pull_request", payload: payload } as any) // eslint-disable-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any

		testContext.expect(mock.activeMocks()).toStrictEqual([])
		testContext.expect(mock.pendingMocks()).toStrictEqual([])
	})
})
