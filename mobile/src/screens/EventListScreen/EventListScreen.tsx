import { FlatList, RefreshControl, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { EmptyState, ErrorState, LoadingState } from "../../components";
import { colors } from "../../theme";
import { EventCard, EventListHeader } from "./components";
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
        <EventListHeader
          bookingCount={bookingCount}
          onViewBookings={onViewBookings}
        />

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
