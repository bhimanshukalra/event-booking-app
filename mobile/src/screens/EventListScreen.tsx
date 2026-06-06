import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import { type EventListItem, getEvents } from "../api/events";

type EventListScreenProps = {
  onSelectEvent: (eventId: string) => void;
};

export function EventListScreen({ onSelectEvent }: EventListScreenProps) {
  const [events, setEvents] = useState<EventListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      setEvents(await getEvents());
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to load events.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Upcoming events</Text>
          <Text style={styles.title}>Find your next seat</Text>
          <Text style={styles.subtitle}>
            Browse live inventory from the booking platform foundation API.
          </Text>
        </View>

        {isLoading ? (
          <LoadingState label="Loading events" />
        ) : errorMessage ? (
          <ErrorState message={errorMessage} onRetry={loadEvents} />
        ) : events.length === 0 ? (
          <EmptyState
            title="No events yet"
            message="Published upcoming events will appear here once they are seeded."
          />
        ) : (
          <FlatList
            contentContainerStyle={styles.listContent}
            data={events}
            keyExtractor={(event) => event.id}
            renderItem={({ item }) => (
              <EventCard event={item} onPress={() => onSelectEvent(item.id)} />
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

function EventCard({
  event,
  onPress,
}: {
  event: EventListItem;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.card}>
      <View style={styles.cardTopRow}>
        <Text style={styles.category}>{event.category}</Text>
        <Text
          style={[
            styles.availability,
            event.availabilityStatus === "sold_out" && styles.soldOut,
          ]}
        >
          {event.availabilityStatus === "available" ? "Available" : "Sold out"}
        </Text>
      </View>
      <Text style={styles.eventTitle}>{event.title}</Text>
      <Text style={styles.eventMeta}>
        {formatDate(event.startsAt)} · {event.venueName}, {event.city}
      </Text>
      <Text style={styles.price}>{formatPrice(event)}</Text>
    </Pressable>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    weekday: "short",
  }).format(new Date(value));
}

function formatPrice(event: EventListItem) {
  if (event.minPriceCents === null) {
    return "Price coming soon";
  }

  return `From ${new Intl.NumberFormat("en-US", {
    currency: event.currency,
    style: "currency",
  }).format(event.minPriceCents / 100)}`;
}

const styles = StyleSheet.create({
  availability: {
    backgroundColor: "#dff6ed",
    borderRadius: 999,
    color: "#155443",
    fontSize: 12,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  card: {
    backgroundColor: "#ffffff",
    borderColor: "#d7e4df",
    borderRadius: 8,
    borderWidth: 1,
    padding: 18,
  },
  cardTopRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  category: {
    color: "#1f6f5b",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  eventMeta: {
    color: "#557169",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  eventTitle: {
    color: "#10231e",
    fontSize: 21,
    fontWeight: "900",
    lineHeight: 27,
    marginTop: 16,
  },
  eyebrow: {
    color: "#1f6f5b",
    fontSize: 13,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  header: {
    paddingBottom: 22,
    paddingTop: 28,
  },
  listContent: {
    gap: 14,
    paddingBottom: 28,
  },
  price: {
    color: "#10231e",
    fontSize: 16,
    fontWeight: "800",
    marginTop: 16,
  },
  safeArea: {
    backgroundColor: "#f5fbf8",
    flex: 1,
  },
  soldOut: {
    backgroundColor: "#f4e1d6",
    color: "#7f3f24",
  },
  subtitle: {
    color: "#557169",
    fontSize: 16,
    lineHeight: 23,
    marginTop: 10,
  },
  title: {
    color: "#10231e",
    fontSize: 34,
    fontWeight: "900",
    lineHeight: 39,
    marginTop: 8,
  },
});
