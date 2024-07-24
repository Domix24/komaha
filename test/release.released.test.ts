import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import nock from "nock"
import myProbotApp from "../src/index.js"
import { Probot, ProbotOctokit } from "probot"
import { afterEach, beforeEach, describe, expect, test } from "vitest"
import stream from "stream"
import { pino } from "pino"
import zod from "zod"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const privateKey = fs.readFileSync(
	path.join(__dirname, "fixtures", "mock-cert.pem"),
	"utf-8",
)
const output: string[] = []
const streamOutput = new stream.Writable()
streamOutput._write = (chunk, _encoding, callback) => {
	output.push(JSON.stringify(JSON.parse(chunk))) // eslint-disable-line @typescript-eslint/no-unsafe-argument
	callback()
}

describe("on release.released", () => {
	let probot: Probot

	beforeEach(async () => {
		output.length = 0
		nock.disableNetConnect()

		probot = new Probot({
			appId: 123,
			privateKey,
			Octokit: ProbotOctokit.defaults({
				retry: { enabled: false },
				throttle: { enabled: false },
			}),
			log: pino(streamOutput),
		})
		await probot.load(myProbotApp)
	})

	test("without a config file", async (context) => {
		const mock = nock("https://api.github.com")
			.get("/repos/myownerlogin/myrepositoryname/contents/.github%2Fkomaha.yml")
			.reply(404)
			.get("/repos/myownerlogin/.github/contents/.github%2Fkomaha.yml")
			.reply(404)

		// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
		await probot.receive({
			name: "release",
			payload: {
				action: "released",
				repository: {
					name: "myrepositoryname",
					owner: {
						login: "myownerlogin",
					},
				},
			},
		} as any) // eslint-disable-line @typescript-eslint/no-explicit-any

		context
			.expect(
				zod
					.object({ level: zod.number(), linkedRepo: zod.string() })
					.strip()
					.parse(JSON.parse(output[0])),
			)
			.toStrictEqual({ level: 30, linkedRepo: "" })
		context.expect(output.length).to.eq(1)

		context.expect(mock.activeMocks()).toStrictEqual([])
		context.expect(mock.pendingMocks()).toStrictEqual([])
	})

	test("with a config file", async (context) => {
		const mock = nock("https://api.github.com")
			.get("/repos/myownerlogin/myrepositoryname/contents/.github%2Fkomaha.yml")
			.reply(200, "linkedRepo: thelinkedrepo")
			.post("/repos/myownerlogin/thelinkedrepo/pulls", (body) => {
				const getBodyTyped = zod
					.object({
						base: zod.literal("main"),
						head: zod.literal("myreleasetagname"),
						head_repo: zod.literal("myrepositoryname"),
					})
					.strict()
					.safeParse(body)

				expect(getBodyTyped.success).toBeTruthy()

				if (!getBodyTyped.success) return false

				return true
			})
			.reply(200)

		// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
		await probot.receive({
			name: "release",
			payload: {
				action: "released",
				release: {
					tag_name: "myreleasetagname",
				},
				repository: {
					name: "myrepositoryname",
					owner: {
						login: "myownerlogin",
					},
				},
			},
		} as any) // eslint-disable-line @typescript-eslint/no-explicit-any

		context
			.expect(
				zod
					.object({ level: zod.number(), linkedRepo: zod.string() })
					.strip()
					.parse(JSON.parse(output[0])),
			)
			.toStrictEqual({ level: 30, linkedRepo: "thelinkedrepo" })
		context.expect(output.length).to.eq(1)

		context.expect(mock.activeMocks()).toStrictEqual([])
		context.expect(mock.pendingMocks()).toStrictEqual([])
	})

	afterEach(() => {
		nock.cleanAll()
		nock.enableNetConnect()
	})
})
