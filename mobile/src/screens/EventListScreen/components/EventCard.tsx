import { Pressable, Text, View } from "react-native";
import { type EventListItem } from "../../../api/events";
import { cn } from "../../../utils";

type EventCardProps = {
  event: EventListItem;
  onPress: () => void;
};

export function EventCard({ event, onPress }: EventCardProps) {
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
          className={cn(
            "overflow-hidden rounded-full px-2.5 py-[5px] text-xs font-extrabold",
            event.availabilityStatus === "sold_out"
              ? "bg-sold-out-bg text-sold-out-text"
              : "bg-success-soft text-success-strong",
          )}
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
