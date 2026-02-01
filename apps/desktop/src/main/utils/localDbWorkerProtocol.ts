export type SqliteValue = string | number | bigint | Uint8Array | null

export type SqliteParams = ReadonlyArray<SqliteValue>

export type SqliteRow = Record<string, SqliteValue>

export type SerializedError = {
  readonly name: string
  readonly message: string
  readonly stack?: string
}

export type LocalDbWorkerInitMessage =
  | { readonly _tag: 'Ready' }
  | {
      readonly _tag: 'InitError'
      readonly message: string
      readonly error: SerializedError
    }

export type LocalDbWorkerRequest =
  | { readonly _tag: 'Exec'; readonly id: number; readonly sql: string }
  | {
      readonly _tag: 'Run'
      readonly id: number
      readonly sql: string
      readonly params: SqliteParams
    }
  | {
      readonly _tag: 'Get'
      readonly id: number
      readonly sql: string
      readonly params: SqliteParams
    }
  | {
      readonly _tag: 'All'
      readonly id: number
      readonly sql: string
      readonly params: SqliteParams
    }

export type LocalDbWorkerResponse =
  | { readonly _tag: 'Ok'; readonly id: number; readonly value: unknown }
  | { readonly _tag: 'Err'; readonly id: number; readonly error: SerializedError }

export type LocalDbWorkerMessage = LocalDbWorkerInitMessage | LocalDbWorkerResponse

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

export const serializeError = (error: unknown): SerializedError => {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: typeof error.stack === 'string' ? error.stack : undefined
    }
  }

  return {
    name: 'UnknownError',
    message: String(error)
  }
}

export const isLocalDbWorkerMessage = (value: unknown): value is LocalDbWorkerMessage => {
  if (!isRecord(value)) return false
  if (value['_tag'] === 'Ready') return true
  if (value['_tag'] === 'InitError') {
    return (
      typeof value['message'] === 'string' &&
      isRecord(value['error']) &&
      typeof value['error']['name'] === 'string' &&
      typeof value['error']['message'] === 'string'
    )
  }
  if (value['_tag'] === 'Ok') {
    return typeof value['id'] === 'number' && 'value' in value
  }
  if (value['_tag'] === 'Err') {
    return (
      typeof value['id'] === 'number' &&
      isRecord(value['error']) &&
      typeof value['error']['name'] === 'string' &&
      typeof value['error']['message'] === 'string'
    )
  }
  return false
}
