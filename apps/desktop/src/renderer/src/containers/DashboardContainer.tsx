import { useMemo, useState } from "react"
import { CalendarDays, CloudSync, LayoutDashboard, Users } from "lucide-react"
import type { AuthenticatedState } from "@satori/domain/auth/schemas"
import { DashboardLayout } from "../components/dashboard/DashboardLayout"
import { DashboardRoute, type DashboardRoute as DashboardRouteType } from "../constants/dashboardRoutes"
import { OverviewContainer } from "./OverviewContainer"
import { EventsContainer } from "./EventsContainer"
import { PeopleContainer } from "./PeopleContainer"
import { SyncContainer } from "./SyncContainer"
import { Alert, AlertDescription } from "../components/ui/alert"

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
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{appError}</AlertDescription>
        </Alert>
      ) : null}

      {route === DashboardRoute.overview ? <OverviewContainer /> : null}
      {route === DashboardRoute.events ? <EventsContainer /> : null}
      {route === DashboardRoute.people ? <PeopleContainer /> : null}
      {route === DashboardRoute.sync ? <SyncContainer /> : null}
    </DashboardLayout>
  )
}
