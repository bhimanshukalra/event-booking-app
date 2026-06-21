import { Pressable, Text, View } from "react-native";

type ErrorStateProps = {
  message: string;
  onRetry: () => void;
};

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <View className="items-center rounded-lg border border-warning-border bg-warning-bg px-6 py-7">
      <Text className="text-lg font-extrabold text-warning-title">
        Something went sideways
      </Text>
      <Text className="mt-2 text-center text-[15px] leading-[22px] text-warning-text">
        {message}
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={onRetry}
        className="mt-[18px] rounded-lg bg-ink px-[18px] py-3"
      >
        <Text className="text-[15px] font-bold text-white">Try again</Text>
      </Pressable>
    </View>
  );
}
