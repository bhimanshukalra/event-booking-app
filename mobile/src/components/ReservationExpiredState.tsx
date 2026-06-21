import { Pressable, Text, View } from "react-native";

type ReservationExpiredStateProps = {
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function ReservationExpiredState({
  title = "Reservation Expired",
  description = "Your reservation has expired. Please try booking again.",
  actionLabel = "Select tickets again",
  onAction,
}: ReservationExpiredStateProps) {
  return (
    <View className="items-center justify-center rounded-lg border border-[#f3cfb4] bg-[#fff8f2] px-6 py-7">
      <View className="mb-4 h-14 w-14 items-center justify-center rounded-full bg-[#f0dada]">
        <Text className="text-2xl font-black text-[#8a1f1f]">!</Text>
      </View>

      <Text className="text-center text-xl font-black text-[#4a2013]">
        {title}
      </Text>

      <Text className="mt-2 text-center text-sm leading-5 text-[#7f5542]">
        {description}
      </Text>

      {onAction ? (
        <Pressable
          accessibilityRole="button"
          className="mt-5 rounded-lg bg-[#1f6f5b] px-4 py-3"
          onPress={onAction}
        >
          <Text className="text-sm font-black text-white">{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
