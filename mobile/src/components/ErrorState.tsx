import { Pressable, Text, View } from "react-native";

type ErrorStateProps = {
  message: string;
  onRetry: () => void;
};

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <View className="items-center rounded-lg border border-[#f3cfb4] bg-[#fff8f2] px-6 py-7">
      <Text className="text-lg font-extrabold text-[#4a2013]">
        Something went sideways
      </Text>
      <Text className="mt-2 text-center text-[15px] leading-[22px] text-[#7f5542]">
        {message}
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={onRetry}
        className="mt-[18px] rounded-lg bg-[#10231e] px-[18px] py-3"
      >
        <Text className="text-[15px] font-bold text-white">Try again</Text>
      </Pressable>
    </View>
  );
}
