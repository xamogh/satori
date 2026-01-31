import { Schema } from "effect"
import {
  AuthSignInRequestSchema,
  AuthStateSchema,
  type AuthSignInRequest,
  type AuthState,
  UserRoleSchema,
} from "../auth/schemas"
import { SyncRequestSchema, SyncResponseSchema } from "../sync/schemas"

export const ApiErrorSchema = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal("RequestDecodeError"),
    message: Schema.String,
  }),
  Schema.Struct({
    _tag: Schema.Literal("Unauthorized"),
    message: Schema.String,
  }),
  Schema.Struct({
    _tag: Schema.Literal("Locked"),
    message: Schema.String,
  }),
  Schema.Struct({
    _tag: Schema.Literal("HandlerError"),
    message: Schema.String,
  })
)

export type ApiError = Schema.Schema.Type<typeof ApiErrorSchema>

export type ApiOk<A> = {
  readonly _tag: "Ok"
  readonly value: A
}

export type ApiErr = {
  readonly _tag: "Err"
  readonly error: ApiError
}

export type ApiResult<A> = ApiOk<A> | ApiErr

export const makeOk = <A>(value: A): ApiOk<A> => ({ _tag: "Ok", value })

export const makeErr = (error: ApiError): ApiErr => ({ _tag: "Err", error })

export const ApiResultSchema = <A, I, R>(
  value: Schema.Schema<A, I, R>
): Schema.Schema<ApiResult<A>, ApiResult<I>, R> =>
  Schema.Union(
    Schema.Struct({
      _tag: Schema.Literal("Ok"),
      value,
    }),
    Schema.Struct({
      _tag: Schema.Literal("Err"),
      error: ApiErrorSchema,
    })
  )

export const ApiRoutes = {
  authSignIn: {
    method: "POST",
    path: "/auth/sign-in",
    request: AuthSignInRequestSchema,
    response: Schema.Struct({
      accessToken: Schema.String,
      userId: Schema.String,
      email: Schema.String,
      role: UserRoleSchema,
      expiresAtMs: Schema.Number,
    }),
  },
  authStatus: {
    method: "GET",
    path: "/auth/status",
    request: Schema.Void,
    response: AuthStateSchema,
  },
  sync: {
    method: "POST",
    path: "/sync",
    request: SyncRequestSchema,
    response: SyncResponseSchema,
  },
} as const

export type ApiRouteKey = keyof typeof ApiRoutes

export type ApiRequest<K extends ApiRouteKey> = Schema.Schema.Type<
  (typeof ApiRoutes)[K]["request"]
>

export type ApiResponse<K extends ApiRouteKey> = Schema.Schema.Type<
  (typeof ApiRoutes)[K]["response"]
>

export const AuthSessionSchema = ApiRoutes.authSignIn.response

export type AuthSession = Schema.Schema.Type<typeof AuthSessionSchema>

export type { AuthSignInRequest, AuthState }
