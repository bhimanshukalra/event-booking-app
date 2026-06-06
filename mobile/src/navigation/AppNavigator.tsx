import { useState } from "react";
import { EventDetailScreen } from "../screens/EventDetailScreen";
import { EventListScreen } from "../screens/EventListScreen";

export function AppNavigator() {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  if (selectedEventId) {
    return (
      <EventDetailScreen
        eventId={selectedEventId}
        onBack={() => setSelectedEventId(null)}
      />
    );
  }

  return <EventListScreen onSelectEvent={setSelectedEventId} />;
}
