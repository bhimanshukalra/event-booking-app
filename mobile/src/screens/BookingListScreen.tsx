import { FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { EventDetail } from "../api/events";
import type { Reservation } from "../api/reservations";
import { EmptyState } from "../components";

export type ConfirmedBooking = {
  confirmedAt: string;
  event: EventDetail;
  reservation: Reservation;
};

type BookingListScreenProps = {
  bookings: ConfirmedBooking[];
  onBackToEvents: () => void;
  onSelectBooking: (booking: ConfirmedBooking) => void;
};

export function BookingListScreen({
  bookings,
  onBackToEvents,
  onSelectBooking,
}: BookingListScreenProps) {
  return (
    <SafeAreaView className="flex-1 bg-app">
      <View className="flex-1 px-5">
        <View className="pb-[22px] pt-7">
          <Pressable
            accessibilityRole="button"
            onPress={onBackToEvents}
            className="mb-6 self-start rounded-lg border border-border-muted px-[14px] py-2.5"
          >
            <Text className="text-sm font-extrabold text-brand">
              Back to events
            </Text>
          </Pressable>
          <Text className="text-[13px] font-black uppercase text-brand">
            Bookings
          </Text>
          <Text className="mt-2 text-[34px] font-black leading-[39px] text-ink">
            Your tickets
          </Text>
          <Text className="mt-2.5 text-base leading-[23px] text-muted">
            Confirmed demo bookings from this app session appear here.
          </Text>
        </View>

        {bookings.length === 0 ? (
          <EmptyState
            title="No bookings yet"
            message="Complete a mock payment and your ticket will appear here."
          />
        ) : (
          <FlatList
            className="flex-1"
            data={bookings}
            ItemSeparatorComponent={() => <View className="h-[14px]" />}
            keyExtractor={(booking) => booking.reservation.id}
            ListFooterComponent={() => <View className="h-7" />}
            renderItem={({ item }) => (
              <BookingCard
                booking={item}
                onPress={() => onSelectBooking(item)}
              />
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

function BookingCard({
  booking,
  onPress,
}: {
  booking: ConfirmedBooking;
  onPress: () => void;
}) {
  const ticketCount = booking.reservation.items.reduce(
    (sum, item) => sum + item.quantity,
    0,
  );

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="rounded-lg border border-border-subtle bg-white p-[18px]"
    >
      <View className="flex-row items-center justify-between gap-3">
        <Text className="text-xs font-black uppercase text-brand">
          Confirmed
        </Text>
        <Text className="rounded-full bg-success-soft px-2.5 py-[5px] text-xs font-extrabold text-success-strong">
          {ticketCount} ticket{ticketCount === 1 ? "" : "s"}
        </Text>
      </View>
      <Text className="mt-4 text-[21px] font-black leading-[27px] text-ink">
        {booking.event.title}
      </Text>
      <Text className="mt-2 text-sm leading-5 text-muted">
        {formatDateTime(booking.event.startsAt)} - {booking.event.venue.name}
      </Text>
      <Text className="mt-4 text-sm font-extrabold text-ink">
        Booked {formatDateTime(booking.confirmedAt)}
      </Text>
    </Pressable>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
  }).format(new Date(value));
}
