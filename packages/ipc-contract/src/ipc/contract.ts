import { Schema } from "effect"
import {
  AuthSignInRequestSchema,
  AuthStateSchema,
  EmailSchema,
  UserRoleSchema,
  type AuthSignInRequest,
  type AuthState,
  type UserRole,
} from "@satori/domain/auth/schemas"
import {
  EventCreateInputSchema,
  EventDeleteInputSchema,
  EventListQuerySchema,
  EventSchema,
  EventUpdateInputSchema,
} from "@satori/domain/domain/event"
import {
  PersonCreateInputSchema,
  PersonDeleteInputSchema,
  PersonListQuerySchema,
  PersonSchema,
  PersonUpdateInputSchema,
} from "@satori/domain/domain/person"
import {
  RegistrationCreateInputSchema,
  RegistrationDeleteInputSchema,
  RegistrationListQuerySchema,
  RegistrationSchema,
  RegistrationUpdateInputSchema,
} from "@satori/domain/domain/registration"
import {
  AttendanceCreateInputSchema,
  AttendanceDeleteInputSchema,
  AttendanceListQuerySchema,
  AttendanceSchema,
  AttendanceUpdateInputSchema,
} from "@satori/domain/domain/attendance"
import {
  PhotoCreateInputSchema,
  PhotoDeleteInputSchema,
  PhotoSchema,
} from "@satori/domain/domain/photo"
import { EntityIdSchema } from "@satori/domain/domain/common"
import { SyncStatusSchema } from "@satori/domain/sync/schemas"

export const IpcChannel = {
  ping: "satori-desktop:ping",
  echo: "satori-desktop:echo",
  authStatus: "satori-desktop:auth:status",
  authSignIn: "satori-desktop:auth:sign-in",
  authSignOut: "satori-desktop:auth:sign-out",
  eventsList: "satori-desktop:events:list",
  eventsCreate: "satori-desktop:events:create",
  eventsUpdate: "satori-desktop:events:update",
  eventsDelete: "satori-desktop:events:delete",
  personsList: "satori-desktop:persons:list",
  personsCreate: "satori-desktop:persons:create",
  personsUpdate: "satori-desktop:persons:update",
  personsDelete: "satori-desktop:persons:delete",
  registrationsList: "satori-desktop:registrations:list",
  registrationsCreate: "satori-desktop:registrations:create",
  registrationsUpdate: "satori-desktop:registrations:update",
  registrationsDelete: "satori-desktop:registrations:delete",
  attendanceList: "satori-desktop:attendance:list",
  attendanceCreate: "satori-desktop:attendance:create",
  attendanceUpdate: "satori-desktop:attendance:update",
  attendanceDelete: "satori-desktop:attendance:delete",
  photosCreate: "satori-desktop:photos:create",
  photosDelete: "satori-desktop:photos:delete",
  photosGet: "satori-desktop:photos:get",
  syncNow: "satori-desktop:sync:now",
  syncStatus: "satori-desktop:sync:status",
} as const

export const PingRequestSchema = Schema.Void
export const PingResponseSchema = Schema.Literal("pong")

export const EchoRequestSchema = Schema.Struct({
  message: Schema.NonEmptyString,
})

export const EchoResponseSchema = Schema.Struct({
  message: Schema.String,
})

export {
  UserRoleSchema,
  EmailSchema,
  AuthSignInRequestSchema,
  AuthStateSchema,
}

export type { UserRole, AuthSignInRequest, AuthState }

export const SchemaIssueSchema = Schema.Struct({
  path: Schema.Array(Schema.String),
  message: Schema.String,
})

export type SchemaIssue = Schema.Schema.Type<typeof SchemaIssueSchema>

export const IpcErrorSchema = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal("RequestDecodeError"),
    message: Schema.String,
    issues: Schema.Array(SchemaIssueSchema),
  }),
  Schema.Struct({
    _tag: Schema.Literal("ResponseDecodeError"),
    message: Schema.String,
    issues: Schema.Array(SchemaIssueSchema),
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
  }),
  Schema.Struct({
    _tag: Schema.Literal("Defect"),
    message: Schema.String,
  })
)

export type IpcError = Schema.Schema.Type<typeof IpcErrorSchema>

export type IpcOk<A> = {
  readonly _tag: "Ok"
  readonly value: A
}

export type IpcErr = {
  readonly _tag: "Err"
  readonly error: IpcError
}

export type IpcResult<A> = IpcOk<A> | IpcErr

export const makeOk = <A>(value: A): IpcOk<A> => ({ _tag: "Ok", value })

export const makeErr = (error: IpcError): IpcErr => ({ _tag: "Err", error })

export const IpcResultSchema = <A, I, R>(
  value: Schema.Schema<A, I, R>
): Schema.Schema<IpcResult<A>, IpcResult<I>, R> =>
  Schema.Union(
    Schema.Struct({
      _tag: Schema.Literal("Ok"),
      value,
    }),
    Schema.Struct({
      _tag: Schema.Literal("Err"),
      error: IpcErrorSchema,
    })
  )

export const IpcRoutes = {
  ping: {
    channel: IpcChannel.ping,
    request: PingRequestSchema,
    response: PingResponseSchema,
  },
  echo: {
    channel: IpcChannel.echo,
    request: EchoRequestSchema,
    response: EchoResponseSchema,
  },
  authStatus: {
    channel: IpcChannel.authStatus,
    request: Schema.Void,
    response: AuthStateSchema,
  },
  authSignIn: {
    channel: IpcChannel.authSignIn,
    request: AuthSignInRequestSchema,
    response: AuthStateSchema,
  },
  authSignOut: {
    channel: IpcChannel.authSignOut,
    request: Schema.Void,
    response: AuthStateSchema,
  },
  eventsList: {
    channel: IpcChannel.eventsList,
    request: EventListQuerySchema,
    response: Schema.Array(EventSchema),
  },
  eventsCreate: {
    channel: IpcChannel.eventsCreate,
    request: EventCreateInputSchema,
    response: EventSchema,
  },
  eventsUpdate: {
    channel: IpcChannel.eventsUpdate,
    request: EventUpdateInputSchema,
    response: EventSchema,
  },
  eventsDelete: {
    channel: IpcChannel.eventsDelete,
    request: EventDeleteInputSchema,
    response: Schema.Literal("ok"),
  },
  personsList: {
    channel: IpcChannel.personsList,
    request: PersonListQuerySchema,
    response: Schema.Array(PersonSchema),
  },
  personsCreate: {
    channel: IpcChannel.personsCreate,
    request: PersonCreateInputSchema,
    response: PersonSchema,
  },
  personsUpdate: {
    channel: IpcChannel.personsUpdate,
    request: PersonUpdateInputSchema,
    response: PersonSchema,
  },
  personsDelete: {
    channel: IpcChannel.personsDelete,
    request: PersonDeleteInputSchema,
    response: Schema.Literal("ok"),
  },
  registrationsList: {
    channel: IpcChannel.registrationsList,
    request: RegistrationListQuerySchema,
    response: Schema.Array(RegistrationSchema),
  },
  registrationsCreate: {
    channel: IpcChannel.registrationsCreate,
    request: RegistrationCreateInputSchema,
    response: RegistrationSchema,
  },
  registrationsUpdate: {
    channel: IpcChannel.registrationsUpdate,
    request: RegistrationUpdateInputSchema,
    response: RegistrationSchema,
  },
  registrationsDelete: {
    channel: IpcChannel.registrationsDelete,
    request: RegistrationDeleteInputSchema,
    response: Schema.Literal("ok"),
  },
  attendanceList: {
    channel: IpcChannel.attendanceList,
    request: AttendanceListQuerySchema,
    response: Schema.Array(AttendanceSchema),
  },
  attendanceCreate: {
    channel: IpcChannel.attendanceCreate,
    request: AttendanceCreateInputSchema,
    response: AttendanceSchema,
  },
  attendanceUpdate: {
    channel: IpcChannel.attendanceUpdate,
    request: AttendanceUpdateInputSchema,
    response: AttendanceSchema,
  },
  attendanceDelete: {
    channel: IpcChannel.attendanceDelete,
    request: AttendanceDeleteInputSchema,
    response: Schema.Literal("ok"),
  },
  photosCreate: {
    channel: IpcChannel.photosCreate,
    request: PhotoCreateInputSchema,
    response: PhotoSchema,
  },
  photosDelete: {
    channel: IpcChannel.photosDelete,
    request: PhotoDeleteInputSchema,
    response: Schema.Literal("ok"),
  },
  photosGet: {
    channel: IpcChannel.photosGet,
    request: Schema.Struct({ id: EntityIdSchema }),
    response: PhotoSchema,
  },
  syncNow: {
    channel: IpcChannel.syncNow,
    request: Schema.Void,
    response: SyncStatusSchema,
  },
  syncStatus: {
    channel: IpcChannel.syncStatus,
    request: Schema.Void,
    response: SyncStatusSchema,
  },
} as const

export type IpcRouteKey = keyof typeof IpcRoutes

export type IpcRequest<K extends IpcRouteKey> = Schema.Schema.Type<
  (typeof IpcRoutes)[K]["request"]
>

export type IpcResponse<K extends IpcRouteKey> = Schema.Schema.Type<
  (typeof IpcRoutes)[K]["response"]
>

type ApiMethod<K extends IpcRouteKey> = IpcRequest<K> extends void
  ? () => Promise<IpcResult<IpcResponse<K>>>
  : (payload: IpcRequest<K>) => Promise<IpcResult<IpcResponse<K>>>

export type IpcApi = {
  readonly [K in IpcRouteKey]: ApiMethod<K>
}
