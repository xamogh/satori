import { useMemo, useState } from 'react'
import { CalendarDays, CheckCircle2, CloudSync, LayoutDashboard, Users } from 'lucide-react'
import type { AuthenticatedState } from '@satori/domain/auth/schemas'
import { DashboardLayout } from '../components/dashboard/DashboardLayout'
import {
  DashboardRoute,
  type DashboardRoute as DashboardRouteType
} from '../constants/dashboardRoutes'
import { OverviewContainer } from './OverviewContainer'
import { EventsContainer } from './EventsContainer'
import { PeopleContainer } from './PeopleContainer'
import { GroupsContainer } from './GroupsContainer'
import { AttendanceContainer } from './AttendanceContainer'
import { SyncContainer } from './SyncContainer'
import { Alert, AlertDescription } from '../components/ui/alert'

export type DashboardContainerProps = {
  readonly auth: AuthenticatedState
  readonly onSignOut: () => void
  readonly appError: string | null
  readonly syncEnabled: boolean
}

export const DashboardContainer = ({
  auth,
  onSignOut,
  appError,
  syncEnabled
}: DashboardContainerProps): React.JSX.Element => {
  const [route, setRoute] = useState<DashboardRouteType>(DashboardRoute.overview)
  const [search, setSearch] = useState('')

  const navItems = useMemo(() => {
    const items = [
      {
        key: DashboardRoute.overview,
        label: 'Dashboard',
        icon: <LayoutDashboard className="h-4 w-4" />
      },
      {
        key: DashboardRoute.events,
        label: 'Events',
        icon: <CalendarDays className="h-4 w-4" />
      },
      {
        key: DashboardRoute.people,
        label: 'People',
        icon: <Users className="h-4 w-4" />
      },
      {
        key: DashboardRoute.groups,
        label: 'Groups',
        icon: <Users className="h-4 w-4" />
      },
      {
        key: DashboardRoute.attendance,
        label: 'Attendance',
        icon: <CheckCircle2 className="h-4 w-4" />
      }
    ] as const

    return syncEnabled
      ? [
          ...items,
          { key: DashboardRoute.sync, label: 'Sync', icon: <CloudSync className="h-4 w-4" /> }
        ]
      : items
  }, [syncEnabled])

  const activeRoute =
    !syncEnabled && route === DashboardRoute.sync ? DashboardRoute.overview : route

  return (
    <DashboardLayout
      appName="Satori Desktop"
      navItems={navItems}
      activeKey={activeRoute}
      onNavigate={setRoute}
      searchValue={search}
      onSearchValueChange={setSearch}
      userEmail={auth.email}
      userRole={auth.role}
      onSignOut={onSignOut}
    >
      {appError ? (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{appError}</AlertDescription>
        </Alert>
      ) : null}

      {activeRoute === DashboardRoute.overview ? <OverviewContainer /> : null}
      {activeRoute === DashboardRoute.events ? <EventsContainer /> : null}
      {activeRoute === DashboardRoute.people ? <PeopleContainer /> : null}
      {activeRoute === DashboardRoute.groups ? <GroupsContainer /> : null}
      {activeRoute === DashboardRoute.attendance ? <AttendanceContainer /> : null}
      {activeRoute === DashboardRoute.sync ? <SyncContainer /> : null}
    </DashboardLayout>
  )
}
