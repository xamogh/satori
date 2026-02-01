import { Effect, Option, Schema } from 'effect'
import { UserRoleSchema } from '@satori/domain/auth/schemas'
import { PgClient } from '../db/pg-client'
import { DbError } from '../errors'

const UserRowSchema = Schema.Struct({
  id: Schema.String,
  email: Schema.String,
  passwordHash: Schema.String,
  role: UserRoleSchema
})

export type UserRow = Schema.Schema.Type<typeof UserRowSchema>

export class UsersRepository extends Effect.Service<UsersRepository>()(
  'repository/UsersRepository',
  {
    dependencies: [PgClient.Default],
    effect: Effect.gen(function* () {
      const db = yield* PgClient

      const findByEmail = (email: string): Effect.Effect<Option.Option<UserRow>, DbError> =>
        db
          .query(
            'select id, email, password_hash as "passwordHash", role from users where email = $1 limit 1',
            [email]
          )
          .pipe(
            Effect.flatMap((result) =>
              Schema.decodeUnknown(Schema.Array(UserRowSchema))(result.rows).pipe(
                Effect.mapError(
                  (error) =>
                    new DbError({
                      message: 'Invalid user row shape',
                      cause: error
                    })
                )
              )
            ),
            Effect.map((rows) => (rows.length > 0 ? Option.some(rows[0]!) : Option.none()))
          )

      return { findByEmail } as const
    })
  }
) {}
