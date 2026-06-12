import { ActivityIndicator, Text, View } from "react-native";

type LoadingStateProps = {
  label: string;
};

export function LoadingState({ label }: LoadingStateProps) {
  return (
    <View className="items-center gap-[14px] py-10">
      <ActivityIndicator color="#1f6f5b" size="large" />
      <Text className="text-[15px] font-semibold text-[#557169]">{label}</Text>
    </View>
  );
}
