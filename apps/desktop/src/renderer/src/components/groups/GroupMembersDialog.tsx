import { Plus, RefreshCw, Users } from 'lucide-react'
import { DataTable, type DataTableColumn } from '../data-table/DataTable'
import { RowActionsMenu } from '../data-table/RowActionsMenu'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Alert, AlertDescription } from '../ui/alert'
import { EmptyState } from '../ui/empty-state'
import { Badge } from '../ui/badge'
import { formatDate } from '../../utils/date'

export type GroupMemberRow = {
  readonly id: string
  readonly personId: string
  readonly name: string
  readonly email: string | null
  readonly phone: string | null
  readonly joinedAtMs: number | null
}

export type GroupMemberCandidate = {
  readonly id: string
  readonly name: string
  readonly email: string | null
  readonly phone: string | null
}

export type GroupMembersAddState = {
  readonly open: boolean
  readonly query: string
  readonly candidates: ReadonlyArray<GroupMemberCandidate>
  readonly loading: boolean
  readonly error: string | null
  readonly onOpenChange: (open: boolean) => void
  readonly onQueryChange: (value: string) => void
  readonly onAdd: (personId: string) => void
}

export type GroupMembersDialogProps = {
  readonly open: boolean
  readonly groupName: string
  readonly loading: boolean
  readonly error: string | null
  readonly members: ReadonlyArray<GroupMemberRow>
  readonly onOpenChange: (open: boolean) => void
  readonly onRefresh: () => void
  readonly onRemove: (memberId: string) => void
  readonly add: GroupMembersAddState
}

const membersColumns = (
  onRemove: (memberId: string) => void
): ReadonlyArray<DataTableColumn<GroupMemberRow>> => [
  {
    id: 'member',
    header: 'Member',
    cell: (member) => (
      <div className="min-w-0">
        <p className="truncate font-medium">{member.name}</p>
        {member.email ? (
          <p className="truncate text-sm text-muted-foreground">{member.email}</p>
        ) : null}
        {member.phone ? (
          <p className="truncate text-sm text-muted-foreground">{member.phone}</p>
        ) : null}
      </div>
    )
  },
  {
    id: 'joined',
    header: 'Joined',
    headerClassName: 'w-[140px]',
    cell: (member) =>
      member.joinedAtMs ? (
        <span className="text-sm">{formatDate(member.joinedAtMs)}</span>
      ) : (
        <span className="text-sm text-muted-foreground">Unknown</span>
      )
  },
  {
    id: 'actions',
    header: '',
    headerClassName: 'w-[56px]',
    cellClassName: 'text-right',
    cell: (member) => (
      <RowActionsMenu
        label="Open member actions"
        actions={[
          {
            id: 'remove',
            label: 'Remove',
            destructive: true,
            onSelect: () => onRemove(member.id)
          }
        ]}
      />
    )
  }
]

const candidateColumns = (
  onAdd: (personId: string) => void
): ReadonlyArray<DataTableColumn<GroupMemberCandidate>> => [
  {
    id: 'person',
    header: 'Person',
    cell: (person) => (
      <div className="min-w-0">
        <p className="truncate font-medium">{person.name}</p>
        {person.email ? (
          <p className="truncate text-sm text-muted-foreground">{person.email}</p>
        ) : null}
        {person.phone ? (
          <p className="truncate text-sm text-muted-foreground">{person.phone}</p>
        ) : null}
      </div>
    )
  },
  {
    id: 'actions',
    header: '',
    headerClassName: 'w-[120px]',
    cellClassName: 'text-right',
    cell: (person) => (
      <Button size="sm" onClick={() => onAdd(person.id)}>
        Add
      </Button>
    )
  }
]

export const GroupMembersDialog = ({
  open,
  groupName,
  loading,
  error,
  members,
  onOpenChange,
  onRefresh,
  onRemove,
  add
}: GroupMembersDialogProps): React.JSX.Element => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-4xl">
      <DialogHeader>
        <DialogTitle>Group Members</DialogTitle>
        <DialogDescription>Manage members for {groupName}.</DialogDescription>
      </DialogHeader>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{members.length} members</Badge>
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
            <RefreshCw className={loading ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'} />
            {loading ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
        <Dialog open={add.open} onOpenChange={add.onOpenChange}>
          <Button size="sm" onClick={() => add.onOpenChange(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add member
          </Button>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Add Group Member</DialogTitle>
              <DialogDescription>Select a person to add to this group.</DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <Input
                value={add.query}
                onChange={(event) => add.onQueryChange(event.target.value)}
                placeholder="Search people by name, email, or phone..."
              />

              {add.error ? (
                <Alert variant="destructive">
                  <AlertDescription>{add.error}</AlertDescription>
                </Alert>
              ) : null}

              <DataTable
                columns={candidateColumns(add.onAdd)}
                rows={add.candidates}
                loading={add.loading}
                getRowKey={(person) => person.id}
                emptyState={
                  <EmptyState
                    icon={<Users className="h-6 w-6" />}
                    title="No people found"
                    description="Try adjusting your search terms."
                  />
                }
              />
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <DataTable
        columns={membersColumns(onRemove)}
        rows={members}
        loading={loading}
        getRowKey={(member) => member.id}
        emptyState={
          <EmptyState
            icon={<Users className="h-6 w-6" />}
            title="No members yet"
            description="Add people to this group to start tracking membership."
          />
        }
      />
    </DialogContent>
  </Dialog>
)
