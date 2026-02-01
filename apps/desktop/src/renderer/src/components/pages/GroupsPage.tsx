import type { Group } from '@satori/domain/domain/group'
import { Users, Plus, Search, RefreshCw, AlertCircle } from 'lucide-react'
import { Button } from '../ui/button'
import { DataTable, type DataTableColumn } from '../data-table/DataTable'
import { DataTablePagination } from '../data-table/DataTablePagination'
import { RowActionsMenu } from '../data-table/RowActionsMenu'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription
} from '../ui/dialog'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Textarea } from '../ui/textarea'
import { Alert, AlertDescription } from '../ui/alert'
import { PageHeader, PageContainer } from '../layout/PageHeader'
import { EmptyState } from '../ui/empty-state'
import { Badge } from '../ui/badge'
import { FormFieldError } from '../forms/FormFieldError'
import { formatDateTime } from '../../utils/date'
import type { FormApiFor } from '../../utils/formTypes'

export type GroupsCreateFormValues = {
  readonly name: string
  readonly description: string
}

export type GroupsCreateFormState = {
  readonly open: boolean
  readonly form: FormApiFor<GroupsCreateFormValues>
  readonly error: string | null
  readonly onOpenChange: (open: boolean) => void
  readonly onCancel: () => void
}

export type GroupsPageProps = {
  readonly query: string
  readonly loading: boolean
  readonly error: string | null
  readonly groups: ReadonlyArray<Group>
  readonly groupsTotal: number
  readonly pageIndex: number
  readonly pageSize: number
  readonly onPageIndexChange: (pageIndex: number) => void
  readonly onPageSizeChange: (pageSize: number) => void
  readonly onQueryChange: (value: string) => void
  readonly onRefresh: () => void
  readonly onDelete: (id: string) => void
  readonly create: GroupsCreateFormState
}

const groupsColumns = (onDelete: (id: string) => void): ReadonlyArray<DataTableColumn<Group>> => [
  {
    id: 'group',
    header: 'Group',
    cell: (group) => (
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Users className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="truncate font-medium">{group.name}</p>
          {group.description ? (
            <p className="truncate text-sm text-muted-foreground">{group.description}</p>
          ) : (
            <p className="text-sm text-muted-foreground">No description</p>
          )}
        </div>
      </div>
    )
  },
  {
    id: 'updated',
    header: 'Updated',
    cell: (group) => <span className="text-sm">{formatDateTime(group.updatedAtMs)}</span>
  },
  {
    id: 'actions',
    header: '',
    headerClassName: 'w-[56px]',
    cellClassName: 'text-right',
    cell: (group) => (
      <RowActionsMenu
        label="Open group actions"
        actions={[
          {
            id: 'delete',
            label: 'Delete',
            destructive: true,
            onSelect: () => onDelete(group.id)
          }
        ]}
      />
    )
  }
]

export const GroupsPage = ({
  query,
  loading,
  error,
  groups,
  groupsTotal,
  pageIndex,
  pageSize,
  onPageIndexChange,
  onPageSizeChange,
  onQueryChange,
  onRefresh,
  onDelete,
  create
}: GroupsPageProps): React.JSX.Element => (
  <PageContainer>
    <PageHeader
      icon={<Users className="h-5 w-5" />}
      title="Groups"
      description="Organize people into groups for tracking and reporting."
      badge={groupsTotal > 0 ? <Badge variant="secondary">{groupsTotal} total</Badge> : null}
      actions={
        <Dialog open={create.open} onOpenChange={create.onOpenChange}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Group
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Group</DialogTitle>
              <DialogDescription>Add a new group to organize people.</DialogDescription>
            </DialogHeader>

            <form
              onSubmit={(event) => {
                event.preventDefault()
                event.stopPropagation()
                void create.form.handleSubmit()
              }}
            >
              <div className="grid gap-4 py-4">
                <create.form.Field name="name">
                  {(field) => (
                    <div className="grid gap-2">
                      <Label htmlFor={field.name}>Name</Label>
                      <Input
                        id={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.value)}
                        placeholder="Dharma students"
                      />
                      <FormFieldError errors={field.state.meta.errors} />
                    </div>
                  )}
                </create.form.Field>

                <create.form.Field name="description">
                  {(field) => (
                    <div className="grid gap-2">
                      <Label htmlFor={field.name}>Description</Label>
                      <Textarea
                        id={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.value)}
                        placeholder="Optional notes about the group"
                        rows={3}
                      />
                      <FormFieldError errors={field.state.meta.errors} />
                    </div>
                  )}
                </create.form.Field>

                {create.error ? (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{create.error}</AlertDescription>
                  </Alert>
                ) : null}
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={create.onCancel}>
                  Cancel
                </Button>
                <create.form.Subscribe
                  selector={(state) => ({
                    canSubmit: state.canSubmit,
                    isSubmitting: state.isSubmitting
                  })}
                >
                  {({ canSubmit, isSubmitting }) => (
                    <Button type="submit" disabled={!canSubmit}>
                      {isSubmitting ? 'Saving...' : 'Create Group'}
                    </Button>
                  )}
                </create.form.Subscribe>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      }
    />

    {error ? (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    ) : null}

    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative w-full max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search groups..."
          className="pl-8"
        />
      </div>
      <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
        <RefreshCw className={loading ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'} />
        {loading ? 'Loading...' : 'Refresh'}
      </Button>
    </div>

    {groups.length === 0 && !loading ? (
      <EmptyState
        icon={<Users className="h-6 w-6" />}
        title="No groups found"
        description={
          query ? 'Try adjusting your search terms.' : 'Create your first group to get started.'
        }
        action={
          !query ? (
            <Button size="sm" onClick={() => create.onOpenChange(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Group
            </Button>
          ) : undefined
        }
      />
    ) : (
      <>
        <DataTable
          columns={groupsColumns(onDelete)}
          rows={groups}
          loading={loading}
          getRowKey={(group) => group.id}
        />
        <DataTablePagination
          totalItems={groupsTotal}
          pageIndex={pageIndex}
          pageSize={pageSize}
          onPageIndexChange={onPageIndexChange}
          onPageSizeChange={onPageSizeChange}
        />
      </>
    )}
  </PageContainer>
)
