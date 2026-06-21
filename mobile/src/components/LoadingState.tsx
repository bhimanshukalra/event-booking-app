import { ActivityIndicator, Text, View } from "react-native";
import { colors } from "../theme";

type LoadingStateProps = {
  label: string;
};

export function LoadingState({ label }: LoadingStateProps) {
  return (
    <View className="items-center gap-[14px] py-10">
      <ActivityIndicator color={colors.brand} size="large" />
      <Text className="text-[15px] font-semibold text-muted">{label}</Text>
    </View>
  );
}
