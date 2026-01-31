import { ParseResult } from "effect"
import type { SchemaIssue } from "../ipc/contract"

export const formatParseIssues = (
  error: ParseResult.ParseError
): ReadonlyArray<SchemaIssue> =>
  ParseResult.ArrayFormatter.formatErrorSync(error).map((issue) => ({
    path: issue.path.map(String),
    message: issue.message,
  }))

