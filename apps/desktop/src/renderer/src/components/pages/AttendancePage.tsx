import type { Attendance } from '@satori/domain/domain/attendance'
import { CheckCircle2, Plus, RefreshCw, AlertCircle } from 'lucide-react'
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
import { Alert, AlertDescription } from '../ui/alert'
import { PageHeader, PageContainer } from '../layout/PageHeader'
import { EmptyState } from '../ui/empty-state'
import { Badge } from '../ui/badge'
import { FormFieldError } from '../forms/FormFieldError'
import { formatDateTime } from '../../utils/date'
import type { FormApiFor } from '../../utils/formTypes'

export type AttendanceCreateFormValues = {
  readonly eventAttendeeId: string
  readonly eventDayId: string
  readonly status: 'present' | 'absent'
  readonly checkedInAt: string
  readonly checkedInBy: string
}

export type AttendanceCreateFormState = {
  readonly open: boolean
  readonly form: FormApiFor<AttendanceCreateFormValues>
  readonly error: string | null
  readonly onOpenChange: (open: boolean) => void
  readonly onCancel: () => void
}

export type AttendancePageProps = {
  readonly eventId: string
  readonly eventDayId: string
  readonly eventAttendeeId: string
  readonly onEventIdChange: (value: string) => void
  readonly onEventDayIdChange: (value: string) => void
  readonly onEventAttendeeIdChange: (value: string) => void
  readonly loading: boolean
  readonly error: string | null
  readonly attendance: ReadonlyArray<Attendance>
  readonly attendanceTotal: number
  readonly pageIndex: number
  readonly pageSize: number
  readonly onPageIndexChange: (pageIndex: number) => void
  readonly onPageSizeChange: (pageSize: number) => void
  readonly onRefresh: () => void
  readonly onDelete: (id: string) => void
  readonly create: AttendanceCreateFormState
}

const getStatusBadge = (
  status: Attendance['status']
): { label: string; variant: 'default' | 'secondary' } =>
  status === 'present'
    ? { label: 'Present', variant: 'default' }
    : { label: 'Absent', variant: 'secondary' }

const attendanceColumns = (
  onDelete: (id: string) => void
): ReadonlyArray<DataTableColumn<Attendance>> => [
  {
    id: 'attendee',
    header: 'Event Attendee',
    cell: (attendance) => (
      <div className="text-sm">
        <p className="font-medium">{attendance.eventAttendeeId}</p>
        <p className="text-muted-foreground">Event day: {attendance.eventDayId}</p>
      </div>
    )
  },
  {
    id: 'status',
    header: 'Status',
    headerClassName: 'w-[120px]',
    cell: (attendance) => {
      const status = getStatusBadge(attendance.status)
      return <Badge variant={status.variant}>{status.label}</Badge>
    }
  },
  {
    id: 'checkedIn',
    header: 'Checked in',
    cell: (attendance) => (
      <div className="text-sm">
        {attendance.checkedInAtMs ? (
          <p>{formatDateTime(attendance.checkedInAtMs)}</p>
        ) : (
          <p className="text-muted-foreground">Not checked in</p>
        )}
        {attendance.checkedInBy ? (
          <p className="text-muted-foreground">By {attendance.checkedInBy}</p>
        ) : null}
      </div>
    )
  },
  {
    id: 'actions',
    header: '',
    headerClassName: 'w-[56px]',
    cellClassName: 'text-right',
    cell: (attendance) => (
      <RowActionsMenu
        label="Open attendance actions"
        actions={[
          {
            id: 'delete',
            label: 'Delete',
            destructive: true,
            onSelect: () => onDelete(attendance.id)
          }
        ]}
      />
    )
  }
]

export const AttendancePage = ({
  eventId,
  eventDayId,
  eventAttendeeId,
  onEventIdChange,
  onEventDayIdChange,
  onEventAttendeeIdChange,
  loading,
  error,
  attendance,
  attendanceTotal,
  pageIndex,
  pageSize,
  onPageIndexChange,
  onPageSizeChange,
  onRefresh,
  onDelete,
  create
}: AttendancePageProps): React.JSX.Element => (
  <PageContainer>
    <PageHeader
      icon={<CheckCircle2 className="h-5 w-5" />}
      title="Attendance"
      description="Track attendance records for event days and attendees."
      badge={
        attendanceTotal > 0 ? <Badge variant="secondary">{attendanceTotal} total</Badge> : null
      }
      actions={
        <Dialog open={create.open} onOpenChange={create.onOpenChange}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Attendance
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Attendance</DialogTitle>
              <DialogDescription>Add a new attendance record.</DialogDescription>
            </DialogHeader>

            <form
              onSubmit={(event) => {
                event.preventDefault()
                event.stopPropagation()
                void create.form.handleSubmit()
              }}
            >
              <div className="grid gap-4 py-4">
                <create.form.Field name="eventAttendeeId">
                  {(field) => (
                    <div className="grid gap-2">
                      <Label htmlFor={field.name}>Event attendee ID</Label>
                      <Input
                        id={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.value)}
                        placeholder="UUID"
                      />
                      <FormFieldError errors={field.state.meta.errors} />
                    </div>
                  )}
                </create.form.Field>

                <create.form.Field name="eventDayId">
                  {(field) => (
                    <div className="grid gap-2">
                      <Label htmlFor={field.name}>Event day ID</Label>
                      <Input
                        id={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.value)}
                        placeholder="UUID"
                      />
                      <FormFieldError errors={field.state.meta.errors} />
                    </div>
                  )}
                </create.form.Field>

                <create.form.Field name="status">
                  {(field) => (
                    <div className="grid gap-2">
                      <Label htmlFor={field.name}>Status</Label>
                      <select
                        id={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) =>
                          field.handleChange(event.target.value === 'absent' ? 'absent' : 'present')
                        }
                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <option value="present">Present</option>
                        <option value="absent">Absent</option>
                      </select>
                      <FormFieldError errors={field.state.meta.errors} />
                    </div>
                  )}
                </create.form.Field>

                <div className="grid grid-cols-2 gap-4">
                  <create.form.Field name="checkedInAt">
                    {(field) => (
                      <div className="grid gap-2">
                        <Label htmlFor={field.name}>Checked in at (optional)</Label>
                        <Input
                          id={field.name}
                          type="datetime-local"
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(event) => field.handleChange(event.target.value)}
                        />
                        <FormFieldError errors={field.state.meta.errors} />
                      </div>
                    )}
                  </create.form.Field>

                  <create.form.Field name="checkedInBy">
                    {(field) => (
                      <div className="grid gap-2">
                        <Label htmlFor={field.name}>Checked in by (optional)</Label>
                        <Input
                          id={field.name}
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(event) => field.handleChange(event.target.value)}
                          placeholder="Staff member"
                        />
                        <FormFieldError errors={field.state.meta.errors} />
                      </div>
                    )}
                  </create.form.Field>
                </div>

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
                      {isSubmitting ? 'Saving...' : 'Create Attendance'}
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

    <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor="attendance-filter-event">Event ID</Label>
          <Input
            id="attendance-filter-event"
            value={eventId}
            onChange={(event) => onEventIdChange(event.target.value)}
            placeholder="Filter by event UUID"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="attendance-filter-day">Event Day ID</Label>
          <Input
            id="attendance-filter-day"
            value={eventDayId}
            onChange={(event) => onEventDayIdChange(event.target.value)}
            placeholder="Filter by event day UUID"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="attendance-filter-attendee">Attendee ID</Label>
          <Input
            id="attendance-filter-attendee"
            value={eventAttendeeId}
            onChange={(event) => onEventAttendeeIdChange(event.target.value)}
            placeholder="Filter by attendee UUID"
          />
        </div>
      </div>
      <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
        <RefreshCw className={loading ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'} />
        {loading ? 'Loading...' : 'Refresh'}
      </Button>
    </div>

    {attendance.length === 0 && !loading ? (
      <EmptyState
        icon={<CheckCircle2 className="h-6 w-6" />}
        title="No attendance records"
        description="Add attendance entries to start tracking."
        action={
          !eventId && !eventDayId && !eventAttendeeId ? (
            <Button size="sm" onClick={() => create.onOpenChange(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Attendance
            </Button>
          ) : undefined
        }
      />
    ) : (
      <>
        <DataTable
          columns={attendanceColumns(onDelete)}
          rows={attendance}
          loading={loading}
          getRowKey={(record) => record.id}
        />
        <DataTablePagination
          totalItems={attendanceTotal}
          pageIndex={pageIndex}
          pageSize={pageSize}
          onPageIndexChange={onPageIndexChange}
          onPageSizeChange={onPageSizeChange}
        />
      </>
    )}
  </PageContainer>
)
