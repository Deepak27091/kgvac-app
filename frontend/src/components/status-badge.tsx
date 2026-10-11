import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { STATUS_COLORS } from "@/src/theme";

export function StatusBadge({ status, size = "md" }: { status: string; size?: "sm" | "md" }) {
  const c = STATUS_COLORS[status] || { fg: "#64748B", bg: "#F1F5F9" };
  const padV = size === "sm" ? 2 : 4;
  const padH = size === "sm" ? 8 : 10;
  const font = size === "sm" ? 11 : 12;
  return (
    <View
      testID={`status-badge-${status.toLowerCase()}`}
      style={[styles.badge, { backgroundColor: c.bg, paddingVertical: padV, paddingHorizontal: padH }]}
    >
      <Text style={[styles.text, { color: c.fg, fontSize: font }]}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { borderRadius: 999, alignSelf: "flex-start" },
  text: { fontWeight: "700", letterSpacing: 0.2 },
});
