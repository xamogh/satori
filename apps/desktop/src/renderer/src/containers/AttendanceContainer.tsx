import { useCallback, useMemo, useState, useSyncExternalStore } from 'react'
import { useForm } from '@tanstack/react-form'
import { Either } from 'effect'
import { AttendancePage, type AttendanceCreateFormValues } from '../components/pages/AttendancePage'
import {
  AttendanceCreateInputSchema,
  type Attendance,
  type AttendanceCreateInput
} from '@satori/domain/domain/attendance'
import type { SchemaIssue } from '@satori/ipc-contract/ipc/contract'
import { createStore } from '../utils/store'
import { clampPageIndex, slicePage } from '../utils/pagination'
import { createSchemaFormValidator } from '../utils/formValidation'
import { parseDateTimeLocalMs } from '../utils/date'
import { trimToNull } from '../utils/string'

const normalizeFilter = (raw: string): string | undefined => {
  const trimmed = raw.trim()
  return trimmed.length === 0 ? undefined : trimmed
}

type AttendanceListState = {
  readonly attendance: ReadonlyArray<Attendance>
  readonly loading: boolean
  readonly error: string | null
}

const attendanceListStore = createStore<AttendanceListState>({
  attendance: [],
  loading: false,
  error: null
})

let attendanceListStarted = false
let attendanceListRequestId = 0

const refreshAttendanceList = (filters: {
  readonly eventId?: string
  readonly eventDayId?: string
  readonly eventAttendeeId?: string
}): Promise<void> => {
  attendanceListRequestId += 1
  const requestId = attendanceListRequestId

  attendanceListStore.updateSnapshot((current) => ({
    ...current,
    loading: true,
    error: null
  }))

  return window.api.attendanceList(filters).then(
    (result) => {
      if (attendanceListRequestId !== requestId) {
        return
      }

      if (result._tag === 'Ok') {
        attendanceListStore.setSnapshot({
          attendance: result.value,
          loading: false,
          error: null
        })
        return
      }

      attendanceListStore.updateSnapshot((current) => ({
        ...current,
        loading: false,
        error: result.error.message
      }))
    },
    (reason) => {
      if (attendanceListRequestId !== requestId) {
        return
      }

      attendanceListStore.updateSnapshot((current) => ({
        ...current,
        loading: false,
        error: String(reason)
      }))
    }
  )
}

const subscribeAttendanceList = (listener: () => void): (() => void) => {
  if (!attendanceListStarted) {
    attendanceListStarted = true
    void refreshAttendanceList({})
  }

  return attendanceListStore.subscribe(listener)
}

export const AttendanceContainer = (): React.JSX.Element => {
  const { attendance, loading, error } = useSyncExternalStore(
    subscribeAttendanceList,
    attendanceListStore.getSnapshot,
    attendanceListStore.getSnapshot
  )

  const [eventId, setEventId] = useState('')
  const [eventDayId, setEventDayId] = useState('')
  const [eventAttendeeId, setEventAttendeeId] = useState('')

  const normalizedFilters = useMemo(
    () => ({
      eventId: normalizeFilter(eventId),
      eventDayId: normalizeFilter(eventDayId),
      eventAttendeeId: normalizeFilter(eventAttendeeId)
    }),
    [eventAttendeeId, eventDayId, eventId]
  )

  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(10)

  const safePageIndex = useMemo(
    () => clampPageIndex(pageIndex, attendance.length, pageSize),
    [attendance.length, pageIndex, pageSize]
  )

  const pagedAttendance = useMemo(
    () => slicePage(attendance, safePageIndex, pageSize),
    [attendance, pageSize, safePageIndex]
  )

  const [createOpen, setCreateOpen] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const refresh = useCallback((): void => {
    setPageIndex(0)
    void refreshAttendanceList(normalizedFilters)
  }, [normalizedFilters])

  const buildAttendanceCreateInput = useCallback(
    (
      values: AttendanceCreateFormValues
    ): Either.Either<AttendanceCreateInput, ReadonlyArray<SchemaIssue>> => {
      const checkedInAtMs = parseDateTimeLocalMs(values.checkedInAt)
      if (values.checkedInAt.trim().length > 0 && checkedInAtMs === null) {
        return Either.left([
          {
            path: ['checkedInAt'],
            message: 'Check-in time is invalid.'
          }
        ])
      }

      return Either.right({
        eventAttendeeId: values.eventAttendeeId,
        eventDayId: values.eventDayId,
        status: values.status,
        checkedInAtMs,
        checkedInBy: trimToNull(values.checkedInBy)
      })
    },
    []
  )

  const attendanceCreateDefaults: AttendanceCreateFormValues = {
    eventAttendeeId: '',
    eventDayId: '',
    status: 'present',
    checkedInAt: '',
    checkedInBy: ''
  }

  const attendanceCreateForm = useForm({
    defaultValues: attendanceCreateDefaults,
    validators: {
      onSubmit: createSchemaFormValidator(AttendanceCreateInputSchema, buildAttendanceCreateInput, {
        fieldNameMap: {
          checkedInAtMs: 'checkedInAt'
        }
      })
    },
    onSubmit: ({ value, formApi }) => {
      setCreateError(null)
      const input = buildAttendanceCreateInput(value)
      if (Either.isLeft(input)) {
        return
      }

      return window.api.attendanceCreate(input.right).then(
        (result) => {
          if (result._tag === 'Ok') {
            setCreateOpen(false)
            formApi.reset()
            refresh()
            return
          }

          setCreateError(result.error.message)
        },
        (reason) => setCreateError(String(reason))
      )
    }
  })

  const cancelCreate = useCallback((): void => {
    setCreateOpen(false)
    setCreateError(null)
    attendanceCreateForm.reset()
  }, [attendanceCreateForm])

  const deleteAttendance = useCallback(
    (id: string): void => {
      window.api.attendanceDelete({ id }).then(
        (result) => {
          if (result._tag === 'Ok') {
            refresh()
            return
          }

          attendanceListStore.updateSnapshot((current) => ({
            ...current,
            error: result.error.message
          }))
        },
        (reason) =>
          attendanceListStore.updateSnapshot((current) => ({
            ...current,
            error: String(reason)
          }))
      )
    },
    [refresh]
  )

  return (
    <AttendancePage
      eventId={eventId}
      eventDayId={eventDayId}
      eventAttendeeId={eventAttendeeId}
      onEventIdChange={(value) => {
        setPageIndex(0)
        setEventId(value)
      }}
      onEventDayIdChange={(value) => {
        setPageIndex(0)
        setEventDayId(value)
      }}
      onEventAttendeeIdChange={(value) => {
        setPageIndex(0)
        setEventAttendeeId(value)
      }}
      loading={loading}
      error={error}
      attendance={pagedAttendance}
      attendanceTotal={attendance.length}
      pageIndex={safePageIndex}
      pageSize={pageSize}
      onPageIndexChange={setPageIndex}
      onPageSizeChange={(nextPageSize) => {
        setPageIndex(0)
        setPageSize(nextPageSize)
      }}
      onRefresh={refresh}
      onDelete={deleteAttendance}
      create={{
        open: createOpen,
        form: attendanceCreateForm,
        error: createError,
        onOpenChange: (open) => {
          setCreateOpen(open)
          if (!open) {
            setCreateError(null)
            attendanceCreateForm.reset()
          }
        },
        onCancel: cancelCreate
      }}
    />
  )
}
