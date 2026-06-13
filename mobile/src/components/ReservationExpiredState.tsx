import { Text, View } from "react-native";

type ReservationExpiredStateProps = {
  title?: string;
  description?: string;
};

export function ReservationExpiredState({
  title = "Reservation Expired",
  description = "Your reservation has expired. Please try booking again.",
}: ReservationExpiredStateProps) {
  return (
    <View className="items-center justify-center rounded-3xl bg-white px-6 py-8 shadow-sm">
      <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-red-50">
        <Text className="text-3xl">!</Text>
      </View>

      <Text className="text-center text-xl font-bold text-gray-900">
        {title}
      </Text>

      <Text className="mt-2 text-center text-sm leading-5 text-gray-500">
        {description}
      </Text>
    </View>
  );
}
