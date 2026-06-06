import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

type LoadingStateProps = {
  label: string;
};

export function LoadingState({ label }: LoadingStateProps) {
  return (
    <View style={styles.container}>
      <ActivityIndicator color="#1f6f5b" size="large" />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: 14,
    paddingVertical: 40,
  },
  label: {
    color: "#557169",
    fontSize: 15,
    fontWeight: "600",
  },
});
