import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { type EventListItem } from "../../api/events";
import { EmptyState, ErrorState, LoadingState } from "../../components";
import { colors } from "../../theme";
import { useEventList } from "./useEventList";

type EventListScreenProps = {
  bookingCount: number;
  onSelectEvent: (eventId: string) => void;
  onViewBookings: () => void;
};

export function EventListScreen({
  bookingCount,
  onSelectEvent,
  onViewBookings,
}: EventListScreenProps) {
  const {
    errorMessage,
    events,
    isLoading,
    isRefreshing,
    loadEvents,
    refreshEvents,
  } = useEventList();

  return (
    <SafeAreaView className="flex-1 bg-app">
      <View className="flex-1 px-5">
        <View className="pb-[22px] pt-7">
          <View className="mb-5 flex-row justify-end">
            <Pressable
              accessibilityRole="button"
              onPress={onViewBookings}
              className="rounded-lg border border-border-muted px-[14px] py-2.5"
            >
              <Text className="text-sm font-extrabold text-brand">
                My bookings{bookingCount > 0 ? ` (${bookingCount})` : ""}
              </Text>
            </Pressable>
          </View>
          <Text className="text-[13px] font-black uppercase text-brand">
            Upcoming events
          </Text>
          <Text className="mt-2 text-[34px] font-black leading-[39px] text-ink">
            Find your next seat
          </Text>
          <Text className="mt-2.5 text-base leading-[23px] text-muted">
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
                tintColor={colors.brand}
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
      className="rounded-lg border border-border-subtle bg-white p-[18px]"
    >
      <View className="flex-row items-center justify-between">
        <Text className="text-xs font-black uppercase text-brand">
          {event.category}
        </Text>
        <Text
          className={`overflow-hidden rounded-full px-2.5 py-[5px] text-xs font-extrabold ${
            event.availabilityStatus === "sold_out"
              ? "bg-sold-out-bg text-sold-out-text"
              : "bg-success-soft text-success-strong"
          }`}
        >
          {event.availabilityStatus === "available" ? "Available" : "Sold out"}
        </Text>
      </View>
      <Text className="mt-4 text-[21px] font-black leading-[27px] text-ink">
        {event.title}
      </Text>
      <Text className="mt-2 text-sm leading-5 text-muted">
        {formatDate(event.startsAt)} - {event.venueName}, {event.city}
      </Text>
      <Text className="mt-4 text-base font-extrabold text-ink">
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
