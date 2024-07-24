import { createNodeMiddleware } from "probot"
import app from "../src/index.js"
import { IncomingMessage, ServerResponse } from "http"

export default (
	request: IncomingMessage,
	response: ServerResponse & { req: IncomingMessage },
) => {
	switch (request.method) {
		case "POST":
			createNodeMiddleware(app)(request, response)
			break
		default:
			response.writeHead(404).end()
			break
	}
}
