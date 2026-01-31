import type { SchemaIssue } from "@satori/shared/ipc/contract"

export type SchemaIssueListProps = {
  readonly issues: ReadonlyArray<SchemaIssue>
}

export const SchemaIssueList = ({ issues }: SchemaIssueListProps) => {
  if (issues.length === 0) {
    return null
  }

  return (
    <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
      <div className="font-medium">Fix the following:</div>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {issues.map((issue, index) => (
          <li key={index}>
            <span className="font-medium">{issue.path.join(".")}</span>: {issue.message}
          </li>
        ))}
      </ul>
    </div>
  )
}
