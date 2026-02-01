import Database from "better-sqlite3"
import { mkdirSync } from "node:fs"
import { dirname } from "node:path"
import { parentPort, workerData } from "node:worker_threads"
import {
  LOCAL_DB_PRAGMAS,
  LOCAL_DB_SCHEMA_SQL,
  LOCAL_DB_SCHEMA_VERSION,
} from "../constants/localDb"
import type {
  LocalDbWorkerRequest,
  LocalDbWorkerResponse,
  SerializedError,
  SqliteParams,
  SqliteRow,
  SqliteValue,
} from "../utils/localDbWorkerProtocol"
import { serializeError } from "../utils/localDbWorkerProtocol"

type SqliteRunResult = {
  readonly changes: number
  readonly lastInsertRowid: number | bigint
}

type WorkerInitData = {
  readonly dbFilePath: string
}

const isWorkerInitData = (value: unknown): value is WorkerInitData =>
  typeof value === "object" &&
  value !== null &&
  "dbFilePath" in value &&
  typeof (value as { readonly dbFilePath?: unknown }).dbFilePath === "string"

const isRequest = (value: unknown): value is LocalDbWorkerRequest => {
  if (typeof value !== "object" || value === null) return false
  if (!("_tag" in value) || !("id" in value)) return false

  const record = value as Record<string, unknown>
  if (typeof record["id"] !== "number") return false

  switch (record["_tag"]) {
    case "Exec":
      return typeof record["sql"] === "string"
    case "Run":
    case "Get":
    case "All":
      return (
        typeof record["sql"] === "string" &&
        Array.isArray(record["params"])
      )
    default:
      return false
  }
}

const postMessage = (
  message:
    | LocalDbWorkerResponse
    | { readonly _tag: "Ready" }
    | { readonly _tag: "InitError"; readonly message: string; readonly error: SerializedError }
): void => {
  if (!parentPort) return
  parentPort.postMessage(message)
}

const isInitErrorPayload = (value: unknown): value is { readonly _tag: "InitError"; readonly message: string; readonly error: SerializedError } =>
  typeof value === "object" &&
  value !== null &&
  (value as { readonly _tag?: unknown })._tag === "InitError" &&
  typeof (value as { readonly message?: unknown }).message === "string" &&
  typeof (value as { readonly error?: unknown }).error === "object" &&
  (value as { readonly error?: unknown }).error !== null

const readUserVersion = (db: Database.Database): number => {
  const version = db.pragma("user_version", { simple: true })
  return typeof version === "number" ? version : 0
}

const setUserVersion = (db: Database.Database, version: number): void => {
  db.pragma(`user_version = ${version}`)
}

const resetSchema = (db: Database.Database): void => {
  const tables = (db
    .prepare("select name from sqlite_master where type = 'table'")
    .all() as ReadonlyArray<{ readonly name?: unknown }>)
    .map((row) => (typeof row.name === "string" ? row.name : null))
    .filter(
      (name): name is string =>
        typeof name === "string" &&
        name !== "sqlite_sequence" &&
        !name.startsWith("sqlite_")
    )

  for (const name of tables) {
    db.exec(`drop table if exists "${name}"`)
  }

  db.exec(LOCAL_DB_SCHEMA_SQL)
  setUserVersion(db, LOCAL_DB_SCHEMA_VERSION)
}

const init = (): Database.Database => {
  const fail = (message: string, error: unknown): never => {
    throw { _tag: "InitError", message, error: serializeError(error) } as const
  }

  if (!isWorkerInitData(workerData)) {
    fail("Invalid workerData: dbFilePath is required", workerData)
  }

  const filePath = workerData.dbFilePath

  try {
    mkdirSync(dirname(filePath), { recursive: true })
  } catch (error) {
    fail("Failed to create app data directory", error)
  }

  const db = (() => {
    try {
      return new Database(filePath)
    } catch (error) {
      throw {
        _tag: "InitError",
        message: "Failed to open local database",
        error: serializeError(error),
      } as const
    }
  })()

  for (const pragma of LOCAL_DB_PRAGMAS) {
    try {
      db.pragma(pragma)
    } catch (error) {
      fail(`Failed to apply PRAGMA: ${pragma}`, error)
    }
  }

  try {
    const currentVersion = readUserVersion(db)
    if (currentVersion !== LOCAL_DB_SCHEMA_VERSION) {
      console.warn(
        `Local DB schema version mismatch (have ${currentVersion}, expected ${LOCAL_DB_SCHEMA_VERSION}). Resetting local database.`
      )
      resetSchema(db)
    } else {
      db.exec(LOCAL_DB_SCHEMA_SQL)
    }
  } catch (error) {
    fail("Failed to migrate local database schema", error)
  }

  return db
}

const main = (): void => {
  if (!parentPort) {
    return
  }

  let db: Database.Database
  try {
    db = init()
    postMessage({ _tag: "Ready" })
  } catch (error) {
    if (isInitErrorPayload(error)) {
      postMessage(error)
    } else {
      postMessage({
        _tag: "InitError",
        message: "Failed to initialize local database worker",
        error: serializeError(error),
      })
    }
    process.exitCode = 1
    return
  }

  const statementCache = new Map<
    string,
    Database.Statement<Array<SqliteValue>, SqliteRow>
  >()

  const toParamsArray = (params: SqliteParams): Array<SqliteValue> => Array.from(params)

  const prepare = (sql: string): Database.Statement<Array<SqliteValue>, SqliteRow> => {
    const cached = statementCache.get(sql)
    if (cached) return cached

    const stmt = db.prepare<Array<SqliteValue>, SqliteRow>(sql)
    statementCache.set(sql, stmt)
    return stmt
  }

  parentPort.on("message", (message: unknown) => {
    if (!isRequest(message)) return

    try {
      switch (message._tag) {
        case "Exec": {
          db.exec(message.sql)
          postMessage({ _tag: "Ok", id: message.id, value: null })
          return
        }
        case "Run": {
          const stmt = prepare(message.sql)
          const result = stmt.run(...toParamsArray(message.params))
          const value: SqliteRunResult = {
            changes: result.changes,
            lastInsertRowid: result.lastInsertRowid,
          }
          postMessage({ _tag: "Ok", id: message.id, value })
          return
        }
        case "Get": {
          const stmt = prepare(message.sql)
          const row = stmt.get(...toParamsArray(message.params))
          postMessage({
            _tag: "Ok",
            id: message.id,
            value: typeof row === "undefined" ? null : row,
          })
          return
        }
        case "All": {
          const stmt = prepare(message.sql)
          const rows = stmt.all(...toParamsArray(message.params))
          postMessage({ _tag: "Ok", id: message.id, value: rows })
          return
        }
      }
    } catch (error) {
      postMessage({ _tag: "Err", id: message.id, error: serializeError(error) })
    }
  })
}

main()
