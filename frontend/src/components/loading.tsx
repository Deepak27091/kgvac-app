import React from "react";
import { ActivityIndicator, View, StyleSheet } from "react-native";
import { useTheme } from "@/src/theme";

export function LoadingView() {
  const { colors } = useTheme();
  return (
    <View style={[styles.center, { backgroundColor: colors.surface }]} testID="loading-view">
      <ActivityIndicator size="large" color={colors.brandPrimary} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
