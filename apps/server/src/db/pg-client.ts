import { Effect, Exit } from 'effect'
import { Pool, types, type PoolClient } from 'pg'
import { EnvVars } from '../config/env-vars'
import { DbError } from '../errors'

types.setTypeParser(20, (value: string) => Number(value))

export type SqlParam = string | number | boolean | null | Uint8Array | Buffer

export type QueryResult = {
  readonly rows: ReadonlyArray<unknown>
  readonly rowCount: number
}

type Tx = {
  readonly query: (
    text: string,
    params?: ReadonlyArray<SqlParam>
  ) => Effect.Effect<QueryResult, DbError>
}

export class PgClient extends Effect.Service<PgClient>()('db/PgClient', {
  dependencies: [EnvVars.Default],
  effect: Effect.gen(function* () {
    const env = yield* EnvVars

    const pool = new Pool({ connectionString: env.databaseUrl })

    yield* Effect.addFinalizer(() =>
      Effect.async<void, DbError>((resume) => {
        pool.end().then(
          () => resume(Effect.void),
          (error) =>
            resume(
              Effect.fail(
                new DbError({
                  message: 'Failed to close DB pool',
                  cause: error
                })
              )
            )
        )
      }).pipe(Effect.catchTag('DbError', () => Effect.void))
    )

    const queryWith = (queryable: {
      readonly query: (
        text: string,
        params?: ReadonlyArray<SqlParam>
      ) => Promise<{ readonly rows: Array<unknown>; readonly rowCount: number | null }>
    }): Tx => {
      const query = (
        text: string,
        params: ReadonlyArray<SqlParam> = []
      ): Effect.Effect<QueryResult, DbError> =>
        Effect.async<QueryResult, DbError>((resume) => {
          queryable.query(text, Array.from(params)).then(
            (result) =>
              resume(
                Effect.succeed({
                  rows: result.rows,
                  rowCount: result.rowCount ?? 0
                })
              ),
            (error) =>
              resume(
                Effect.fail(
                  new DbError({
                    message: 'Database query failed',
                    cause: error
                  })
                )
              )
          )
        })

      return { query } as const
    }

    const query = queryWith(pool).query

    const transaction = <A, E>(
      use: (tx: Tx) => Effect.Effect<A, E>
    ): Effect.Effect<A, DbError | E> =>
      Effect.scoped(
        Effect.acquireUseRelease(
          Effect.async<PoolClient, DbError>((resume) => {
            pool.connect().then(
              (client) => resume(Effect.succeed(client)),
              (error) =>
                resume(
                  Effect.fail(
                    new DbError({
                      message: 'Failed to connect to DB',
                      cause: error
                    })
                  )
                )
            )
          }),
          (client) =>
            Effect.gen(function* () {
              const tx = queryWith(client)

              yield* tx.query('begin').pipe(
                Effect.mapError(
                  (error) =>
                    new DbError({
                      message: 'Failed to begin transaction',
                      cause: error
                    })
                )
              )

              const exit = yield* use(tx).pipe(Effect.exit)

              if (Exit.isSuccess(exit)) {
                yield* tx.query('commit').pipe(
                  Effect.mapError(
                    (error) =>
                      new DbError({
                        message: 'Failed to commit transaction',
                        cause: error
                      })
                  )
                )

                return exit.value
              }

              yield* tx.query('rollback').pipe(
                Effect.mapError(
                  (error) =>
                    new DbError({
                      message: 'Failed to rollback transaction',
                      cause: error
                    })
                ),
                Effect.catchTag('DbError', () => Effect.void)
              )

              return yield* Effect.failCause(exit.cause)
            }),
          (client) =>
            Effect.sync(() => {
              client.release()
            })
        )
      )

    return { query, transaction } as const
  })
}) {}
