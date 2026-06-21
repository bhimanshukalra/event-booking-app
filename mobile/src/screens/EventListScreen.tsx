import { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import { type EventListItem, getEvents } from "../api/events";

type EventListScreenProps = {
  onSelectEvent: (eventId: string) => void;
  onViewBookings: () => void;
};

export function EventListScreen({
  onSelectEvent,
  onViewBookings,
}: EventListScreenProps) {
  const [events, setEvents] = useState<EventListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadEvents = useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      if (mode === "refresh") {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setErrorMessage(null);

      try {
        setEvents(await getEvents());
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Unable to load events.",
        );
      } finally {
        if (mode === "refresh") {
          setIsRefreshing(false);
        } else {
          setIsLoading(false);
        }
      }
    },
    [],
  );

  const refreshEvents = useCallback(() => loadEvents("refresh"), [loadEvents]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  return (
    <SafeAreaView className="flex-1 bg-[#f5fbf8]">
      <View className="flex-1 px-5">
        <View className="pb-[22px] pt-7">
          <View className="mb-5 flex-row justify-end">
            <Pressable
              accessibilityRole="button"
              onPress={onViewBookings}
              className="rounded-lg border border-[#a8c7bd] px-[14px] py-2.5"
            >
              <Text className="text-sm font-extrabold text-[#1f6f5b]">
                My bookings
              </Text>
            </Pressable>
          </View>
          <Text className="text-[13px] font-black uppercase text-[#1f6f5b]">
            Upcoming events
          </Text>
          <Text className="mt-2 text-[34px] font-black leading-[39px] text-[#10231e]">
            Find your next seat
          </Text>
          <Text className="mt-2.5 text-base leading-[23px] text-[#557169]">
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
            className="flex-1"
            data={events}
            ItemSeparatorComponent={() => <View className="h-[14px]" />}
            keyExtractor={(event) => event.id}
            ListFooterComponent={() => <View className="h-7" />}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                tintColor="#1f6f5b"
                onRefresh={refreshEvents}
              />
            }
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
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="rounded-lg border border-[#d7e4df] bg-white p-[18px]"
    >
      <View className="flex-row items-center justify-between">
        <Text className="text-xs font-black uppercase text-[#1f6f5b]">
          {event.category}
        </Text>
        <Text
          className={`overflow-hidden rounded-full px-2.5 py-[5px] text-xs font-extrabold ${
            event.availabilityStatus === "sold_out"
              ? "bg-[#f4e1d6] text-[#7f3f24]"
              : "bg-[#dff6ed] text-[#155443]"
          }`}
        >
          {event.availabilityStatus === "available" ? "Available" : "Sold out"}
        </Text>
      </View>
      <Text className="mt-4 text-[21px] font-black leading-[27px] text-[#10231e]">
        {event.title}
      </Text>
      <Text className="mt-2 text-sm leading-5 text-[#557169]">
        {formatDate(event.startsAt)} - {event.venueName}, {event.city}
      </Text>
      <Text className="mt-4 text-base font-extrabold text-[#10231e]">
        {formatPrice(event)}
      </Text>
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
