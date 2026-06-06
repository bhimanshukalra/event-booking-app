import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { type EventDetail, getEvent } from "../api/events";
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
          <EventDetailContent event={event} />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function EventDetailContent({ event }: { event: EventDetail }) {
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
            <Text style={styles.ticketPrice}>
              {formatPrice(ticketType.priceCents, ticketType.currency)}
            </Text>
          </View>
        ))}
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
