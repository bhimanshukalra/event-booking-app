import { Pressable, Text, View } from "react-native";

type EventListHeaderProps = {
  bookingCount: number;
  onViewBookings: () => void;
};

export function EventListHeader({
  bookingCount,
  onViewBookings,
}: EventListHeaderProps) {
  return (
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
  );
}
