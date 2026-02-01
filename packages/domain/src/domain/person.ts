import { Schema } from 'effect'
import { EmailSchema } from '../auth/schemas'
import { BooleanFromNumberSchema, EntityIdSchema, Nullable, TimestampMsSchema } from './common'

export const GenderSchema = Schema.Union(
  Schema.Literal('male'),
  Schema.Literal('female'),
  Schema.Literal('other'),
  Schema.Literal('prefer_not_to_say')
)

export type Gender = Schema.Schema.Type<typeof GenderSchema>

export const PersonTypeSchema = Schema.Union(
  Schema.Literal('interested'),
  Schema.Literal('contact'),
  Schema.Literal('attended_orientation')
)

export type PersonType = Schema.Schema.Type<typeof PersonTypeSchema>

export const PersonTitleSchema = Schema.Union(
  Schema.Literal('dharma_dhar'),
  Schema.Literal('dharmacharya'),
  Schema.Literal('khenpo'),
  Schema.Literal('sahayak_dharmacharya'),
  Schema.Literal('sahayak_samathacharya')
)

export type PersonTitle = Schema.Schema.Type<typeof PersonTitleSchema>

export const YearOfRefugeCalendarTypeSchema = Schema.Union(
  Schema.Literal('BS'),
  Schema.Literal('AD')
)

export type YearOfRefugeCalendarType = Schema.Schema.Type<typeof YearOfRefugeCalendarTypeSchema>

export const PersonSchema = Schema.Struct({
  id: EntityIdSchema,
  firstName: Schema.NonEmptyTrimmedString,
  middleName: Nullable(Schema.NonEmptyTrimmedString),
  lastName: Schema.NonEmptyTrimmedString,
  gender: Nullable(GenderSchema),
  yearOfBirth: Nullable(Schema.Number),
  email: Nullable(EmailSchema),
  phone1: Nullable(Schema.String),
  phone2: Nullable(Schema.String),
  address: Nullable(Schema.String),
  country: Nullable(Schema.String),
  nationality: Nullable(Schema.String),
  languagePreference: Nullable(Schema.String),
  notes: Nullable(Schema.String),
  personCode: Nullable(Schema.String),
  referredBy: Nullable(Schema.String),
  occupation: Nullable(Schema.String),
  personType: Nullable(PersonTypeSchema),
  title: Nullable(PersonTitleSchema),
  refugeName: Nullable(Schema.String),
  yearOfRefuge: Nullable(Schema.Number),
  yearOfRefugeCalendarType: Nullable(YearOfRefugeCalendarTypeSchema),
  isSanghaMember: BooleanFromNumberSchema,
  centerId: Nullable(EntityIdSchema),
  isKramaInstructor: BooleanFromNumberSchema,
  kramaInstructorPersonId: Nullable(EntityIdSchema),
  photoId: Nullable(EntityIdSchema),
  updatedAtMs: TimestampMsSchema,
  deletedAtMs: Nullable(TimestampMsSchema),
  serverModifiedAtMs: Nullable(TimestampMsSchema)
})

export type Person = Schema.Schema.Type<typeof PersonSchema>

export const PersonCreateInputSchema = Schema.Struct({
  firstName: Schema.NonEmptyTrimmedString,
  middleName: Nullable(Schema.NonEmptyTrimmedString),
  lastName: Schema.NonEmptyTrimmedString,
  gender: Nullable(GenderSchema),
  yearOfBirth: Nullable(Schema.Number),
  email: Nullable(EmailSchema),
  phone1: Nullable(Schema.String),
  phone2: Nullable(Schema.String),
  address: Nullable(Schema.String),
  country: Nullable(Schema.String),
  nationality: Nullable(Schema.String),
  languagePreference: Nullable(Schema.String),
  notes: Nullable(Schema.String),
  personCode: Nullable(Schema.String),
  referredBy: Nullable(Schema.String),
  occupation: Nullable(Schema.String),
  personType: Nullable(PersonTypeSchema),
  title: Nullable(PersonTitleSchema),
  refugeName: Nullable(Schema.String),
  yearOfRefuge: Nullable(Schema.Number),
  yearOfRefugeCalendarType: Nullable(YearOfRefugeCalendarTypeSchema),
  isSanghaMember: BooleanFromNumberSchema,
  centerId: Nullable(EntityIdSchema),
  isKramaInstructor: BooleanFromNumberSchema,
  kramaInstructorPersonId: Nullable(EntityIdSchema)
})

export type PersonCreateInput = Schema.Schema.Type<typeof PersonCreateInputSchema>

export const PersonUpdateInputSchema = Schema.Struct({
  id: EntityIdSchema,
  firstName: Schema.NonEmptyTrimmedString,
  middleName: Nullable(Schema.NonEmptyTrimmedString),
  lastName: Schema.NonEmptyTrimmedString,
  gender: Nullable(GenderSchema),
  yearOfBirth: Nullable(Schema.Number),
  email: Nullable(EmailSchema),
  phone1: Nullable(Schema.String),
  phone2: Nullable(Schema.String),
  address: Nullable(Schema.String),
  country: Nullable(Schema.String),
  nationality: Nullable(Schema.String),
  languagePreference: Nullable(Schema.String),
  notes: Nullable(Schema.String),
  personCode: Nullable(Schema.String),
  referredBy: Nullable(Schema.String),
  occupation: Nullable(Schema.String),
  personType: Nullable(PersonTypeSchema),
  title: Nullable(PersonTitleSchema),
  refugeName: Nullable(Schema.String),
  yearOfRefuge: Nullable(Schema.Number),
  yearOfRefugeCalendarType: Nullable(YearOfRefugeCalendarTypeSchema),
  isSanghaMember: BooleanFromNumberSchema,
  centerId: Nullable(EntityIdSchema),
  isKramaInstructor: BooleanFromNumberSchema,
  kramaInstructorPersonId: Nullable(EntityIdSchema),
  photoId: Nullable(EntityIdSchema)
})

export type PersonUpdateInput = Schema.Schema.Type<typeof PersonUpdateInputSchema>

export const PersonDeleteInputSchema = Schema.Struct({
  id: EntityIdSchema
})

export type PersonDeleteInput = Schema.Schema.Type<typeof PersonDeleteInputSchema>

export const PersonListQuerySchema = Schema.Struct({
  query: Schema.optional(Schema.NonEmptyTrimmedString)
})

export type PersonListQuery = Schema.Schema.Type<typeof PersonListQuerySchema>
