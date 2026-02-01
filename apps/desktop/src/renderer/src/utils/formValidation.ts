import type {
  DeepKeys,
  FormValidateFn,
  GlobalFormValidationError,
  ValidationError
} from '@tanstack/react-form'
import { Either, Schema } from 'effect'
import type { SchemaIssue } from '@satori/ipc-contract/ipc/contract'
import { formatParseIssues } from '@satori/ipc-contract/utils/parseIssue'

type FieldNameMap = Readonly<Record<string, string>>

const remapIssue = (issue: SchemaIssue, fieldNameMap: FieldNameMap): SchemaIssue => {
  if (issue.path.length === 0) {
    return issue
  }

  const [first, ...rest] = issue.path
  const mapped = fieldNameMap[first] ?? first

  if (mapped === first) {
    return issue
  }

  return { ...issue, path: [mapped, ...rest] }
}

const remapIssues = (
  issues: ReadonlyArray<SchemaIssue>,
  fieldNameMap: FieldNameMap | undefined
): ReadonlyArray<SchemaIssue> =>
  fieldNameMap ? issues.map((issue) => remapIssue(issue, fieldNameMap)) : issues

const mergeFieldError = <FormValues>(
  fields: Partial<Record<DeepKeys<FormValues>, ValidationError>>,
  key: DeepKeys<FormValues>,
  message: string
): Partial<Record<DeepKeys<FormValues>, ValidationError>> => {
  const existing = fields[key]
  const existingMessage =
    typeof existing === 'string' ? existing : existing ? String(existing) : ''
  const nextMessage = existingMessage ? `${existingMessage}; ${message}` : message
  return { ...fields, [key]: nextMessage }
}

const mergeFormError = (form: ValidationError | undefined, message: string): ValidationError => {
  const existingMessage = typeof form === 'string' ? form : form ? String(form) : ''
  return existingMessage ? `${existingMessage} ${message}` : message
}

const issuesToFormErrors = <FormValues>(
  issues: ReadonlyArray<SchemaIssue>
): GlobalFormValidationError<FormValues> => {
  const initial: GlobalFormValidationError<FormValues> = { form: undefined, fields: {} }

  return issues.reduce((acc, issue) => {
    if (issue.path.length === 0) {
      return { ...acc, form: mergeFormError(acc.form, issue.message) }
    }

    const key = issue.path.join('.') as DeepKeys<FormValues>
    return { ...acc, fields: mergeFieldError(acc.fields, key, issue.message) }
  }, initial)
}

export const createSchemaFormValidator = <FormValues, A, I>(
  schema: Schema.Schema<A, I, never>,
  toInput: (values: FormValues) => Either.Either<I, ReadonlyArray<SchemaIssue>>,
  options?: {
    readonly fieldNameMap?: FieldNameMap
  }
): FormValidateFn<FormValues> => {
  return ({ value }) => {
    const prepared = toInput(value)

    if (Either.isLeft(prepared)) {
      const issues = remapIssues(prepared.left, options?.fieldNameMap)
      return issuesToFormErrors<FormValues>(issues)
    }

    const decoded = Schema.decodeUnknownEither(schema)(prepared.right)
    if (Either.isRight(decoded)) {
      return undefined
    }

    const issues = remapIssues(formatParseIssues(decoded.left), options?.fieldNameMap)
    return issuesToFormErrors<FormValues>(issues)
  }
}
