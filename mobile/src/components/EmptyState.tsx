import { Text, View } from "react-native";

type EmptyStateProps = {
  title: string;
  message: string;
};

export function EmptyState({ title, message }: EmptyStateProps) {
  return (
    <View className="items-center rounded-lg border border-border-subtle px-6 py-8">
      <Text className="text-lg font-bold text-ink">{title}</Text>
      <Text className="mt-2 text-center text-[15px] leading-[22px] text-muted">
        {message}
      </Text>
    </View>
  );
}
