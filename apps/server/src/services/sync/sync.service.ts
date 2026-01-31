import { Effect } from "effect"
import type { SyncRequest, SyncResponse } from "@satori/domain/sync/schemas"
import { SyncRepository } from "../../repository/sync-repository"
import type { DbError } from "../../errors"

export class SyncService extends Effect.Service<SyncService>()("services/SyncService", {
  dependencies: [SyncRepository.Default],
  effect: Effect.gen(function* () {
    const repo = yield* SyncRepository

    const sync = (request: SyncRequest): Effect.Effect<SyncResponse, DbError> =>
      Effect.gen(function* () {
        const serverNowMs = Date.now()
        const cursorMs = typeof request.cursorMs === "number" ? request.cursorMs : 0
        const ackOpIds = request.operations.map((op) => op.opId)

        const changes = yield* repo.applyOperationsAndGetChanges({
          cursorMs,
          operations: request.operations,
          serverNowMs,
        })

        return { cursorMs: serverNowMs, ackOpIds, changes }
      })

    return { sync } as const
  }),
}) {}
