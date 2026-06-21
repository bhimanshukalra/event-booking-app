import { useState } from "react";
import type { EventDetail } from "../api/events";
import type { Reservation } from "../api/reservations";
import { EventDetailScreen } from "../screens/EventDetailScreen";
import { EventListScreen } from "../screens/EventListScreen";
import { ReservationDetailScreen } from "../screens/ReservationDetailScreen";

type ActiveReservation = {
  event: EventDetail;
  reservation: Reservation;
};

export function AppNavigator() {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [activeReservation, setActiveReservation] =
    useState<ActiveReservation | null>(null);

  if (activeReservation) {
    return (
      <ReservationDetailScreen
        event={activeReservation.event}
        onBackToEvent={() => {
          setSelectedEventId(activeReservation.event.id);
          setActiveReservation(null);
        }}
        onBackToEvents={() => {
          setSelectedEventId(null);
          setActiveReservation(null);
        }}
        reservation={activeReservation.reservation}
      />
    );
  }

  if (selectedEventId) {
    return (
      <EventDetailScreen
        eventId={selectedEventId}
        onBack={() => setSelectedEventId(null)}
        onReservationCreated={(reservation, event) => {
          setActiveReservation({
            event,
            reservation,
          });
        }}
      />
    );
  }

  return <EventListScreen onSelectEvent={setSelectedEventId} />;
}
