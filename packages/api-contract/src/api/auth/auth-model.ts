import { Schema } from 'effect'
import { UserRoleSchema } from '@satori/domain/auth/schemas'

export const AuthSessionSchema = Schema.Struct({
  accessToken: Schema.String,
  userId: Schema.String,
  email: Schema.String,
  role: UserRoleSchema,
  expiresAtMs: Schema.Number
})

export type AuthSession = Schema.Schema.Type<typeof AuthSessionSchema>
