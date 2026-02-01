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
  EventDayCreateInputSchema,
  EventDayDeleteInputSchema,
  EventDayListQuerySchema,
  EventDaySchema,
  EventDayUpdateInputSchema,
  EventAttendeeCreateInputSchema,
  EventAttendeeDeleteInputSchema,
  EventAttendeeListQuerySchema,
  EventAttendeeSchema,
  EventAttendeeUpdateInputSchema,
} from "@satori/domain/domain/event"
import {
  GroupCreateInputSchema,
  GroupDeleteInputSchema,
  GroupListQuerySchema,
  GroupSchema,
  GroupUpdateInputSchema,
  PersonGroupCreateInputSchema,
  PersonGroupDeleteInputSchema,
  PersonGroupListQuerySchema,
  PersonGroupSchema,
  PersonGroupUpdateInputSchema,
} from "@satori/domain/domain/group"
import {
  EmpowermentCreateInputSchema,
  EmpowermentDeleteInputSchema,
  EmpowermentListQuerySchema,
  EmpowermentSchema,
  EmpowermentUpdateInputSchema,
} from "@satori/domain/domain/empowerment"
import {
  GuruCreateInputSchema,
  GuruDeleteInputSchema,
  GuruListQuerySchema,
  GuruSchema,
  GuruUpdateInputSchema,
} from "@satori/domain/domain/guru"
import {
  MahakramaHistoryCreateInputSchema,
  MahakramaHistoryDeleteInputSchema,
  MahakramaHistoryListQuerySchema,
  MahakramaHistorySchema,
  MahakramaHistoryUpdateInputSchema,
  MahakramaStepCreateInputSchema,
  MahakramaStepDeleteInputSchema,
  MahakramaStepListQuerySchema,
  MahakramaStepSchema,
  MahakramaStepUpdateInputSchema,
} from "@satori/domain/domain/mahakrama"
import {
  PersonCreateInputSchema,
  PersonDeleteInputSchema,
  PersonListQuerySchema,
  PersonSchema,
  PersonUpdateInputSchema,
} from "@satori/domain/domain/person"
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
  eventDaysList: "satori-desktop:event-days:list",
  eventDaysCreate: "satori-desktop:event-days:create",
  eventDaysUpdate: "satori-desktop:event-days:update",
  eventDaysDelete: "satori-desktop:event-days:delete",
  eventAttendeesList: "satori-desktop:event-attendees:list",
  eventAttendeesCreate: "satori-desktop:event-attendees:create",
  eventAttendeesUpdate: "satori-desktop:event-attendees:update",
  eventAttendeesDelete: "satori-desktop:event-attendees:delete",
  personsList: "satori-desktop:persons:list",
  personsCreate: "satori-desktop:persons:create",
  personsUpdate: "satori-desktop:persons:update",
  personsDelete: "satori-desktop:persons:delete",
  attendanceList: "satori-desktop:attendance:list",
  attendanceCreate: "satori-desktop:attendance:create",
  attendanceUpdate: "satori-desktop:attendance:update",
  attendanceDelete: "satori-desktop:attendance:delete",
  groupsList: "satori-desktop:groups:list",
  groupsCreate: "satori-desktop:groups:create",
  groupsUpdate: "satori-desktop:groups:update",
  groupsDelete: "satori-desktop:groups:delete",
  personGroupsList: "satori-desktop:person-groups:list",
  personGroupsCreate: "satori-desktop:person-groups:create",
  personGroupsUpdate: "satori-desktop:person-groups:update",
  personGroupsDelete: "satori-desktop:person-groups:delete",
  empowermentsList: "satori-desktop:empowerments:list",
  empowermentsCreate: "satori-desktop:empowerments:create",
  empowermentsUpdate: "satori-desktop:empowerments:update",
  empowermentsDelete: "satori-desktop:empowerments:delete",
  gurusList: "satori-desktop:gurus:list",
  gurusCreate: "satori-desktop:gurus:create",
  gurusUpdate: "satori-desktop:gurus:update",
  gurusDelete: "satori-desktop:gurus:delete",
  mahakramaStepsList: "satori-desktop:mahakrama-steps:list",
  mahakramaStepsCreate: "satori-desktop:mahakrama-steps:create",
  mahakramaStepsUpdate: "satori-desktop:mahakrama-steps:update",
  mahakramaStepsDelete: "satori-desktop:mahakrama-steps:delete",
  mahakramaHistoryList: "satori-desktop:mahakrama-history:list",
  mahakramaHistoryCreate: "satori-desktop:mahakrama-history:create",
  mahakramaHistoryUpdate: "satori-desktop:mahakrama-history:update",
  mahakramaHistoryDelete: "satori-desktop:mahakrama-history:delete",
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
  eventDaysList: {
    channel: IpcChannel.eventDaysList,
    request: EventDayListQuerySchema,
    response: Schema.Array(EventDaySchema),
  },
  eventDaysCreate: {
    channel: IpcChannel.eventDaysCreate,
    request: EventDayCreateInputSchema,
    response: EventDaySchema,
  },
  eventDaysUpdate: {
    channel: IpcChannel.eventDaysUpdate,
    request: EventDayUpdateInputSchema,
    response: EventDaySchema,
  },
  eventDaysDelete: {
    channel: IpcChannel.eventDaysDelete,
    request: EventDayDeleteInputSchema,
    response: Schema.Literal("ok"),
  },
  eventAttendeesList: {
    channel: IpcChannel.eventAttendeesList,
    request: EventAttendeeListQuerySchema,
    response: Schema.Array(EventAttendeeSchema),
  },
  eventAttendeesCreate: {
    channel: IpcChannel.eventAttendeesCreate,
    request: EventAttendeeCreateInputSchema,
    response: EventAttendeeSchema,
  },
  eventAttendeesUpdate: {
    channel: IpcChannel.eventAttendeesUpdate,
    request: EventAttendeeUpdateInputSchema,
    response: EventAttendeeSchema,
  },
  eventAttendeesDelete: {
    channel: IpcChannel.eventAttendeesDelete,
    request: EventAttendeeDeleteInputSchema,
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
  groupsList: {
    channel: IpcChannel.groupsList,
    request: GroupListQuerySchema,
    response: Schema.Array(GroupSchema),
  },
  groupsCreate: {
    channel: IpcChannel.groupsCreate,
    request: GroupCreateInputSchema,
    response: GroupSchema,
  },
  groupsUpdate: {
    channel: IpcChannel.groupsUpdate,
    request: GroupUpdateInputSchema,
    response: GroupSchema,
  },
  groupsDelete: {
    channel: IpcChannel.groupsDelete,
    request: GroupDeleteInputSchema,
    response: Schema.Literal("ok"),
  },
  personGroupsList: {
    channel: IpcChannel.personGroupsList,
    request: PersonGroupListQuerySchema,
    response: Schema.Array(PersonGroupSchema),
  },
  personGroupsCreate: {
    channel: IpcChannel.personGroupsCreate,
    request: PersonGroupCreateInputSchema,
    response: PersonGroupSchema,
  },
  personGroupsUpdate: {
    channel: IpcChannel.personGroupsUpdate,
    request: PersonGroupUpdateInputSchema,
    response: PersonGroupSchema,
  },
  personGroupsDelete: {
    channel: IpcChannel.personGroupsDelete,
    request: PersonGroupDeleteInputSchema,
    response: Schema.Literal("ok"),
  },
  empowermentsList: {
    channel: IpcChannel.empowermentsList,
    request: EmpowermentListQuerySchema,
    response: Schema.Array(EmpowermentSchema),
  },
  empowermentsCreate: {
    channel: IpcChannel.empowermentsCreate,
    request: EmpowermentCreateInputSchema,
    response: EmpowermentSchema,
  },
  empowermentsUpdate: {
    channel: IpcChannel.empowermentsUpdate,
    request: EmpowermentUpdateInputSchema,
    response: EmpowermentSchema,
  },
  empowermentsDelete: {
    channel: IpcChannel.empowermentsDelete,
    request: EmpowermentDeleteInputSchema,
    response: Schema.Literal("ok"),
  },
  gurusList: {
    channel: IpcChannel.gurusList,
    request: GuruListQuerySchema,
    response: Schema.Array(GuruSchema),
  },
  gurusCreate: {
    channel: IpcChannel.gurusCreate,
    request: GuruCreateInputSchema,
    response: GuruSchema,
  },
  gurusUpdate: {
    channel: IpcChannel.gurusUpdate,
    request: GuruUpdateInputSchema,
    response: GuruSchema,
  },
  gurusDelete: {
    channel: IpcChannel.gurusDelete,
    request: GuruDeleteInputSchema,
    response: Schema.Literal("ok"),
  },
  mahakramaStepsList: {
    channel: IpcChannel.mahakramaStepsList,
    request: MahakramaStepListQuerySchema,
    response: Schema.Array(MahakramaStepSchema),
  },
  mahakramaStepsCreate: {
    channel: IpcChannel.mahakramaStepsCreate,
    request: MahakramaStepCreateInputSchema,
    response: MahakramaStepSchema,
  },
  mahakramaStepsUpdate: {
    channel: IpcChannel.mahakramaStepsUpdate,
    request: MahakramaStepUpdateInputSchema,
    response: MahakramaStepSchema,
  },
  mahakramaStepsDelete: {
    channel: IpcChannel.mahakramaStepsDelete,
    request: MahakramaStepDeleteInputSchema,
    response: Schema.Literal("ok"),
  },
  mahakramaHistoryList: {
    channel: IpcChannel.mahakramaHistoryList,
    request: MahakramaHistoryListQuerySchema,
    response: Schema.Array(MahakramaHistorySchema),
  },
  mahakramaHistoryCreate: {
    channel: IpcChannel.mahakramaHistoryCreate,
    request: MahakramaHistoryCreateInputSchema,
    response: MahakramaHistorySchema,
  },
  mahakramaHistoryUpdate: {
    channel: IpcChannel.mahakramaHistoryUpdate,
    request: MahakramaHistoryUpdateInputSchema,
    response: MahakramaHistorySchema,
  },
  mahakramaHistoryDelete: {
    channel: IpcChannel.mahakramaHistoryDelete,
    request: MahakramaHistoryDeleteInputSchema,
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
