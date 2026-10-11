// Design tokens from /app/design_guidelines.json
import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const light = {
  surface: "#FFFFFF",
  onSurface: "#0F172A",
  surfaceSecondary: "#F4F6F8",
  onSurfaceSecondary: "#1E293B",
  surfaceTertiary: "#E2E8F0",
  onSurfaceTertiary: "#334155",
  surfaceInverse: "#0F172A",
  onSurfaceInverse: "#FFFFFF",
  muted: "#64748B",

  brand: "#1E3A8A",
  onBrand: "#FFFFFF",
  brandPrimary: "#1E3A8A",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#3B82F6",
  onBrandSecondary: "#FFFFFF",
  brandTertiary: "#DBEAFE",
  onBrandTertiary: "#1E3A8A",

  success: "#10B981",
  onSuccess: "#FFFFFF",
  successSurface: "#D1FAE5",
  warning: "#F59E0B",
  onWarning: "#FFFFFF",
  warningSurface: "#FEF3C7",
  error: "#EF4444",
  onError: "#FFFFFF",
  errorSurface: "#FEE2E2",
  info: "#3B82F6",
  onInfo: "#FFFFFF",
  infoSurface: "#DBEAFE",
  processing: "#F97316",
  processingSurface: "#FFEDD5",
  rescheduled: "#8B5CF6",
  rescheduledSurface: "#EDE9FE",

  border: "#E2E8F0",
  borderStrong: "#CBD5E1",
  divider: "#F1F5F9",
};

export type ThemeColors = typeof light;
export const defaultScheme = "light" satisfies ColorScheme;
export const themes: { light: ThemeColors; dark?: ThemeColors } = { light };

export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme ?? "unspecified");
}
setColorScheme?.(themes.dark ? null : defaultScheme);

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const scheme: ColorScheme = system && themes[system] ? system : defaultScheme;
  return { scheme, colors: themes[scheme] ?? themes.light };
}

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}

export const colors = light;

export const STATUS_COLORS: Record<string, { fg: string; bg: string }> = {
  Scheduled: { fg: light.warning, bg: light.warningSurface },
  Start: { fg: light.info, bg: light.infoSurface },
  Processing: { fg: light.processing, bg: light.processingSurface },
  Completed: { fg: light.success, bg: light.successSurface },
  Rescheduled: { fg: light.rescheduled, bg: light.rescheduledSurface },
  Cancelled: { fg: light.error, bg: light.errorSurface },
};
