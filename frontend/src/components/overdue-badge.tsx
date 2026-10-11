import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors } from "@/src/theme";

export function OverdueBadge() {
  return (
    <View testID="overdue-badge" style={styles.wrap}>
      <View style={styles.dot} />
      <Text style={styles.text}>Overdue</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: colors.errorSurface,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, gap: 4,
    alignSelf: "flex-start",
  },
  dot: { width: 6, height: 6, borderRadius: 999, backgroundColor: colors.error },
  text: { color: colors.error, fontSize: 11, fontWeight: "800", letterSpacing: 0.3 },
});
