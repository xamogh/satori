import { useMemo, useState } from "react"
import { CalendarDays, CloudSync, LayoutDashboard, Users } from "lucide-react"
import type { AuthenticatedState } from "@satori/shared/auth/schemas"
import { DashboardLayout } from "../components/dashboard/DashboardLayout"
import { DashboardRoute, type DashboardRoute as DashboardRouteType } from "../constants/dashboardRoutes"
import { OverviewContainer } from "./OverviewContainer"
import { EventsContainer } from "./EventsContainer"
import { PeopleContainer } from "./PeopleContainer"
import { SyncContainer } from "./SyncContainer"

export type DashboardContainerProps = {
  readonly auth: AuthenticatedState
  readonly onSignOut: () => void
  readonly appError: string | null
}

export const DashboardContainer = ({
  auth,
  onSignOut,
  appError,
}: DashboardContainerProps): React.JSX.Element => {
  const [route, setRoute] = useState<DashboardRouteType>(DashboardRoute.overview)
  const [search, setSearch] = useState("")

  const navItems = useMemo(
    () => [
      {
        key: DashboardRoute.overview,
        label: "Dashboard",
        icon: <LayoutDashboard className="h-4 w-4" />,
      },
      {
        key: DashboardRoute.events,
        label: "Events",
        icon: <CalendarDays className="h-4 w-4" />,
      },
      {
        key: DashboardRoute.people,
        label: "People",
        icon: <Users className="h-4 w-4" />,
      },
      {
        key: DashboardRoute.sync,
        label: "Sync",
        icon: <CloudSync className="h-4 w-4" />,
      },
    ] as const,
    []
  )

  return (
    <DashboardLayout
      appName="Satori Desktop"
      navItems={navItems}
      activeKey={route}
      onNavigate={setRoute}
      searchValue={search}
      onSearchValueChange={setSearch}
      userEmail={auth.email}
      userRole={auth.role}
      onSignOut={onSignOut}
    >
      {appError ? (
        <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {appError}
        </div>
      ) : null}

      {route === DashboardRoute.overview ? <OverviewContainer /> : null}
      {route === DashboardRoute.events ? <EventsContainer /> : null}
      {route === DashboardRoute.people ? <PeopleContainer /> : null}
      {route === DashboardRoute.sync ? <SyncContainer /> : null}
    </DashboardLayout>
  )
}

