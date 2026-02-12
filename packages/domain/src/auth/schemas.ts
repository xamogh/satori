import { Schema } from 'effect'

export const UserRoleSchema = Schema.Union(
  Schema.Literal('admin'),
  Schema.Literal('staff'),
  Schema.Literal('viewer')
)

export type UserRole = Schema.Schema.Type<typeof UserRoleSchema>

const emailPattern = /^[^@\s]+@[^@\s]+\.[^@\s]+$/u

export const EmailSchema = Schema.NonEmptyTrimmedString.pipe(
  Schema.filter((email) => (emailPattern.test(email) ? undefined : 'Invalid email address'))
)

export const AuthSignInRequestSchema = Schema.Struct({
  email: EmailSchema,
  password: Schema.NonEmptyString
})

export type AuthSignInRequest = Schema.Schema.Type<typeof AuthSignInRequestSchema>

export const LocalUsernameSchema = Schema.NonEmptyTrimmedString

export const LocalAuthCredentialsSchema = Schema.Struct({
  username: LocalUsernameSchema,
  password: Schema.NonEmptyString
})

export type LocalAuthCredentials = Schema.Schema.Type<typeof LocalAuthCredentialsSchema>

export const AuthModeSchema = Schema.Union(Schema.Literal('sync'), Schema.Literal('local'))

export type AuthMode = Schema.Schema.Type<typeof AuthModeSchema>

export const AuthModeStatusSchema = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal('Unconfigured')
  }),
  Schema.Struct({
    _tag: Schema.Literal('ConfiguredSync'),
    mode: Schema.Literal('sync')
  }),
  Schema.Struct({
    _tag: Schema.Literal('ConfiguredLocal'),
    mode: Schema.Literal('local'),
    localAccountExists: Schema.Boolean
  })
)

export type AuthModeStatus = Schema.Schema.Type<typeof AuthModeStatusSchema>

export const UnauthenticatedStateSchema = Schema.Struct({
  _tag: Schema.Literal('Unauthenticated')
})

export type UnauthenticatedState = Schema.Schema.Type<typeof UnauthenticatedStateSchema>

export const AuthenticatedStateSchema = Schema.Struct({
  _tag: Schema.Literal('Authenticated'),
  userId: Schema.String,
  email: Schema.String,
  role: UserRoleSchema,
  expiresAtMs: Schema.Number
})

export type AuthenticatedState = Schema.Schema.Type<typeof AuthenticatedStateSchema>

export const LockedStateSchema = Schema.Struct({
  _tag: Schema.Literal('Locked'),
  reason: Schema.Literal('TokenExpired'),
  email: Schema.optional(Schema.String)
})

export type LockedState = Schema.Schema.Type<typeof LockedStateSchema>

export const AuthStateSchema = Schema.Union(
  UnauthenticatedStateSchema,
  AuthenticatedStateSchema,
  LockedStateSchema
)

export type AuthState = Schema.Schema.Type<typeof AuthStateSchema>
