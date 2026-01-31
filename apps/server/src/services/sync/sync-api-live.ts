import { HttpApiBuilder } from "@effect/platform"
import { Effect, Layer } from "effect"
import { Api } from "@satori/api-contract/api/api-definition"
import { InternalServerError } from "@satori/api-contract/api/http-errors"
import { EnvVars } from "../../config/env-vars"
import { PgClient } from "../../db/pg-client"
import { SyncRepository } from "../../repository/sync-repository"
import { SyncService } from "./sync.service"

export const SyncApiLive = HttpApiBuilder.group(Api, "sync", (handlers) =>
  Effect.gen(function* () {
    const service = yield* SyncService

    return handlers.handle("sync", ({ payload }) =>
      service.sync(payload).pipe(
        Effect.catchTag("DbError", (error) =>
          new InternalServerError({
            message: "Sync failed",
            cause: error.cause,
          })
        )
      )
    )
  })
).pipe(
  Layer.provide(
    Layer.mergeAll(
      SyncService.Default,
      SyncRepository.Default,
      PgClient.Default,
      EnvVars.Default
    )
  )
)
