import type { SchemaIssue } from '@satori/ipc-contract/ipc/contract'
import { Alert, AlertDescription, AlertTitle } from './ui/alert'

export type SchemaIssueListProps = {
  readonly issues: ReadonlyArray<SchemaIssue>
}

export const SchemaIssueList = ({ issues }: SchemaIssueListProps): React.JSX.Element | null => {
  if (issues.length === 0) {
    return null
  }

  return (
    <Alert variant="destructive">
      <AlertTitle>Fix the following</AlertTitle>
      <AlertDescription>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {issues.map((issue, index) => (
            <li key={index}>
              <span className="font-medium">{issue.path.join('.')}</span>: {issue.message}
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  )
}
