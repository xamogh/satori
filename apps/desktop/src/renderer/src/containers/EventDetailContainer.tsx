import { ArrowLeft, CalendarDays } from 'lucide-react'
import { PageContainer, PageHeader } from '../components/layout/PageHeader'
import { Button } from '../components/ui/button'

export type EventDetailContainerProps = {
  readonly eventId: string
  readonly onBack: () => void
}

export const EventDetailContainer = ({
  eventId,
  onBack
}: EventDetailContainerProps): React.JSX.Element => (
  <PageContainer>
    <PageHeader
      icon={<CalendarDays className="h-5 w-5" />}
      title="Event Details"
      description={`Event ${eventId}`}
      actions={
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Events
        </Button>
      }
    />
  </PageContainer>
)
