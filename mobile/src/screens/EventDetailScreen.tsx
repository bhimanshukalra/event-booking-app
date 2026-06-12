import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { type EventDetail, getEvent } from "../api/events";
import { createReservation } from "../api/reservations";
import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";

type EventDetailScreenProps = {
  eventId: string;
  onBack: () => void;
};

export function EventDetailScreen({ eventId, onBack }: EventDetailScreenProps) {
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadEvent = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      setEvent(await getEvent(eventId));
    } catch (error) {
      setEvent(null);
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to load this event.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void loadEvent();
  }, [loadEvent]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Pressable
          accessibilityRole="button"
          onPress={onBack}
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>Back to events</Text>
        </Pressable>

        {isLoading ? (
          <LoadingState label="Loading event details" />
        ) : errorMessage ? (
          <ErrorState message={errorMessage} onRetry={loadEvent} />
        ) : event ? (
          <EventDetailContent event={event} onReservationSettled={loadEvent} />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function EventDetailContent({
  event,
  onReservationSettled,
}: {
  event: EventDetail;
  onReservationSettled: () => Promise<void>;
}) {
  const [selectedQuantities, setSelectedQuantities] = useState<
    Record<string, number>
  >({});
  const [isReserving, setIsReserving] = useState(false);
  const [reservationMessage, setReservationMessage] = useState<string | null>(
    null,
  );
  const [reservationError, setReservationError] = useState<string | null>(null);

  const selectedItems = event.ticketTypes
    .map((ticketType) => ({
      ticketTypeId: ticketType.id,
      quantity: selectedQuantities[ticketType.id] ?? 0,
    }))
    .filter((item) => item.quantity > 0);

  const selectedTicketCount = selectedItems.reduce(
    (sum, item) => sum + item.quantity,
    0,
  );
  const selectedTotalCents = event.ticketTypes.reduce(
    (sum, ticketType) =>
      sum + (selectedQuantities[ticketType.id] ?? 0) * ticketType.priceCents,
    0,
  );
  const currency = event.ticketTypes[0]?.currency ?? "USD";

  function updateTicketQuantity(ticketTypeId: string, nextQuantity: number) {
    setReservationError(null);
    setReservationMessage(null);
    setSelectedQuantities((current) => ({
      ...current,
      [ticketTypeId]: nextQuantity,
    }));
  }

  async function handleReserveTickets() {
    if (selectedItems.length === 0 || isReserving) {
      return;
    }

    setIsReserving(true);
    setReservationError(null);
    setReservationMessage(null);

    try {
      const reservation = await createReservation(selectedItems);
      setSelectedQuantities({});
      setReservationMessage(
        `Reserved ${selectedTicketCount} ticket${
          selectedTicketCount === 1 ? "" : "s"
        } until ${formatTime(reservation.expiresAt)}.`,
      );
    } catch (error) {
      setReservationError(
        error instanceof Error ? error.message : "Unable to reserve tickets.",
      );
    } finally {
      setIsReserving(false);
      await onReservationSettled();
    }
  }

  return (
    <View>
      <Text style={styles.category}>{event.category}</Text>
      <Text style={styles.title}>{event.title}</Text>
      <Text style={styles.meta}>
        {formatDateTime(event.startsAt)} - {event.venue.name}
      </Text>
      <Text style={styles.description}>{event.description}</Text>

      <View style={styles.venuePanel}>
        <Text style={styles.sectionLabel}>Venue</Text>
        <Text style={styles.venueName}>{event.venue.name}</Text>
        <Text style={styles.venueAddress}>
          {event.venue.address}, {event.venue.city}, {event.venue.state}
        </Text>
      </View>

      <View style={styles.ticketSection}>
        <Text style={styles.sectionTitle}>Tickets</Text>
        {event.ticketTypes.map((ticketType) => (
          <View key={ticketType.id} style={styles.ticketRow}>
            <View style={styles.ticketCopy}>
              <Text style={styles.ticketName}>{ticketType.name}</Text>
              {ticketType.description ? (
                <Text style={styles.ticketDescription}>
                  {ticketType.description}
                </Text>
              ) : null}
              <Text style={styles.ticketCapacity}>
                {ticketType.availableQuantity} available of{" "}
                {ticketType.capacity} total
              </Text>
              {ticketType.reservedQuantity > 0 ? (
                <Text style={styles.ticketReserved}>
                  {ticketType.reservedQuantity} temporarily held
                </Text>
              ) : null}
            </View>
            <View style={styles.ticketActions}>
              <Text style={styles.ticketPrice}>
                {formatPrice(ticketType.priceCents, ticketType.currency)}
              </Text>
              <View style={styles.quantityControl}>
                <Pressable
                  accessibilityLabel={`Decrease ${ticketType.name} quantity`}
                  accessibilityRole="button"
                  disabled={
                    isReserving ||
                    (selectedQuantities[ticketType.id] ?? 0) === 0
                  }
                  onPress={() =>
                    updateTicketQuantity(
                      ticketType.id,
                      Math.max(0, (selectedQuantities[ticketType.id] ?? 0) - 1),
                    )
                  }
                  style={[
                    styles.quantityButton,
                    (isReserving ||
                      (selectedQuantities[ticketType.id] ?? 0) === 0) &&
                      styles.disabledButton,
                  ]}
                >
                  <Text style={styles.quantityButtonText}>-</Text>
                </Pressable>
                <Text style={styles.quantityValue}>
                  {selectedQuantities[ticketType.id] ?? 0}
                </Text>
                <Pressable
                  accessibilityLabel={`Increase ${ticketType.name} quantity`}
                  accessibilityRole="button"
                  disabled={
                    isReserving ||
                    (selectedQuantities[ticketType.id] ?? 0) >=
                      ticketType.availableQuantity
                  }
                  onPress={() =>
                    updateTicketQuantity(
                      ticketType.id,
                      Math.min(
                        ticketType.availableQuantity,
                        (selectedQuantities[ticketType.id] ?? 0) + 1,
                      ),
                    )
                  }
                  style={[
                    styles.quantityButton,
                    (isReserving ||
                      (selectedQuantities[ticketType.id] ?? 0) >=
                        ticketType.availableQuantity) &&
                      styles.disabledButton,
                  ]}
                >
                  <Text style={styles.quantityButtonText}>+</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ))}
        <View style={styles.reservationPanel}>
          <View>
            <Text style={styles.summaryLabel}>Selected</Text>
            <Text style={styles.summaryValue}>
              {selectedTicketCount} ticket{selectedTicketCount === 1 ? "" : "s"}{" "}
              - {formatPrice(selectedTotalCents, currency)}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            disabled={isReserving || selectedItems.length === 0}
            onPress={handleReserveTickets}
            style={[
              styles.reserveButton,
              (isReserving || selectedItems.length === 0) &&
                styles.disabledReserveButton,
            ]}
          >
            <Text style={styles.reserveButtonText}>
              {isReserving ? "Reserving..." : "Reserve tickets"}
            </Text>
          </Pressable>
        </View>
        {reservationMessage ? (
          <Text style={styles.reservationSuccess}>{reservationMessage}</Text>
        ) : null}
        {reservationError ? (
          <Text style={styles.reservationError}>{reservationError}</Text>
        ) : null}
      </View>
    </View>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    weekday: "short",
  }).format(new Date(value));
}

function formatPrice(priceCents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    currency,
    style: "currency",
  }).format(priceCents / 100);
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

const styles = StyleSheet.create({
  backButton: {
    alignSelf: "flex-start",
    borderColor: "#a8c7bd",
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 24,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  backButtonText: {
    color: "#1f6f5b",
    fontSize: 14,
    fontWeight: "800",
  },
  category: {
    color: "#1f6f5b",
    fontSize: 13,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  container: {
    padding: 20,
    paddingBottom: 36,
  },
  description: {
    color: "#314d45",
    fontSize: 16,
    lineHeight: 24,
    marginTop: 18,
  },
  meta: {
    color: "#557169",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 12,
  },
  safeArea: {
    backgroundColor: "#f5fbf8",
    flex: 1,
  },
  sectionLabel: {
    color: "#557169",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  sectionTitle: {
    color: "#10231e",
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 14,
  },
  disabledButton: {
    opacity: 0.35,
  },
  disabledReserveButton: {
    backgroundColor: "#9fb7af",
  },
  quantityButton: {
    alignItems: "center",
    backgroundColor: "#1f6f5b",
    borderRadius: 8,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  quantityButtonText: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 22,
  },
  quantityControl: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  quantityValue: {
    color: "#10231e",
    fontSize: 17,
    fontWeight: "900",
    minWidth: 20,
    textAlign: "center",
  },
  reservationError: {
    color: "#9b1c1c",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 12,
  },
  reservationPanel: {
    alignItems: "center",
    backgroundColor: "#e7f3ef",
    borderRadius: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
    padding: 16,
  },
  reservationSuccess: {
    color: "#1f6f5b",
    fontSize: 14,
    fontWeight: "800",
    marginTop: 12,
  },
  reserveButton: {
    backgroundColor: "#1f6f5b",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  reserveButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },
  summaryLabel: {
    color: "#557169",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  summaryValue: {
    color: "#10231e",
    fontSize: 16,
    fontWeight: "900",
    marginTop: 4,
  },
  ticketCapacity: {
    color: "#6f8580",
    fontSize: 13,
    marginTop: 6,
  },
  ticketCopy: {
    flex: 1,
    paddingRight: 14,
  },
  ticketDescription: {
    color: "#557169",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
  ticketName: {
    color: "#10231e",
    fontSize: 17,
    fontWeight: "800",
  },
  ticketPrice: {
    color: "#10231e",
    fontSize: 17,
    fontWeight: "900",
    textAlign: "right",
  },
  ticketReserved: {
    color: "#9b5c18",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 4,
  },
  ticketRow: {
    alignItems: "flex-start",
    backgroundColor: "#ffffff",
    borderColor: "#d7e4df",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
    padding: 16,
  },
  ticketActions: {
    alignItems: "flex-end",
  },
  ticketSection: {
    marginTop: 28,
  },
  title: {
    color: "#10231e",
    fontSize: 36,
    fontWeight: "900",
    lineHeight: 41,
    marginTop: 10,
  },
  venueAddress: {
    color: "#557169",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 6,
  },
  venueName: {
    color: "#10231e",
    fontSize: 18,
    fontWeight: "800",
    marginTop: 8,
  },
  venuePanel: {
    backgroundColor: "#e7f3ef",
    borderRadius: 8,
    marginTop: 24,
    padding: 18,
  },
});
