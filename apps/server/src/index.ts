import { createServer } from "node:http"
import { HttpApiBuilder, HttpMiddleware, HttpServer } from "@effect/platform"
import { NodeHttpServer, NodeRuntime } from "@effect/platform-node"
import { Effect, Layer, Logger, LogLevel } from "effect"
import { Api } from "@satori/api-contract/api/api-definition"
import { BearerAuthMiddlewareLive } from "./services/auth/bearer-auth.middleware"
import { ApiGroupsLive } from "./services/api-groups"

const parsePort = (raw: string | undefined): number => {
  const parsed = Number(raw)
  return Number.isInteger(parsed) && parsed > 0 && parsed < 65536 ? parsed : 4000
}

const SERVER_PORT = parsePort(process.env.PORT)

const isDev = (process.env.ENV ?? process.env.STAGE ?? "dev") === "dev"

const loggingLayer = Layer.mergeAll(
  Logger.pretty,
  Logger.minimumLogLevel(isDev ? LogLevel.Debug : LogLevel.Info)
)

const ApiLive = HttpApiBuilder.api(Api).pipe(Layer.provideMerge(ApiGroupsLive))

const HttpLive = HttpApiBuilder.serve((app) => HttpMiddleware.logger(app)).pipe(
  HttpServer.withLogAddress,
  Layer.provide(ApiLive),
  Layer.provide(BearerAuthMiddlewareLive),
  Layer.provide(NodeHttpServer.layer(createServer, { port: SERVER_PORT }))
)

const program = Effect.log(`🚀  Starting server on port ${SERVER_PORT}`).pipe(
  Effect.zipLeft(Layer.launch(HttpLive)),
  Effect.tapError(Effect.logError)
)

NodeRuntime.runMain(Effect.scoped(program.pipe(Effect.provide(loggingLayer))))
