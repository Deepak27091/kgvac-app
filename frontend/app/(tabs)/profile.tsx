import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@react-native-vector-icons/feather";
import { makeStyles, useTheme } from "@/src/theme";
import { useAuth, api } from "@/src/auth";

export default function ProfileScreen() {
  const router = useRouter();
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();

  const [earnings, setEarnings] = useState<any>(null);

  const load = useCallback(async () => {
    try {
      const e = await api<any>("/earnings");
      setEarnings(e);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  const money = (n: number) => `$${(n ?? 0).toFixed(2)}`;

  return (
    <View style={[styles.wrap, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        <View style={styles.profileCard}>
          <View style={styles.avatar}><Feather name="user" size={32} color={colors.onBrand} /></View>
          <Text style={styles.name}>{user?.name}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          <View style={[styles.roleBadge, { backgroundColor: user?.role === "admin" ? colors.brandPrimary : colors.brandTertiary }]}>
            <Text style={{ color: user?.role === "admin" ? colors.onBrand : colors.onBrandTertiary, fontWeight: "700", fontSize: 12 }}>
              {user?.role === "admin" ? "Admin" : "Staff"}
            </Text>
          </View>
        </View>

        {/* Earnings card */}
        <View style={styles.earningsCard}>
          <Text style={styles.cardTitle}>{user?.role === "admin" ? "Total Earnings" : "Your Earnings"}</Text>
          <Text testID="profile-earnings-total" style={styles.earningsTotal}>{money(earnings?.all_time_total ?? 0)}</Text>
          <View style={styles.rowAround}>
            <View style={styles.colCenter}>
              <Text style={styles.lblSm}>Today</Text>
              <Text style={styles.valSm}>{money(earnings?.today_total ?? 0)}</Text>
            </View>
            <View style={styles.colCenter}>
              <Text style={styles.lblSm}>This Month</Text>
              <Text style={styles.valSm}>{money(earnings?.month_total ?? 0)}</Text>
            </View>
            <View style={styles.colCenter}>
              <Text style={styles.lblSm}>Completed</Text>
              <Text style={styles.valSm}>{earnings?.all_time_count ?? 0}</Text>
            </View>
          </View>

          {user?.role === "admin" && earnings?.by_staff?.length ? (
            <View style={styles.breakdown}>
              <Text style={styles.breakdownTitle}>By Staff</Text>
              {earnings.by_staff.map((s: any) => (
                <View key={s.staff_id || "unassigned"} style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>{s.staff_name}</Text>
                  <Text style={styles.breakdownValue}>{money(s.total)} • {s.count}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {user?.role === "admin" && earnings?.by_category?.length ? (
            <View style={styles.breakdown}>
              <Text style={styles.breakdownTitle}>By Service</Text>
              {earnings.by_category.map((c: any) => (
                <View key={c.category_id || "none"} style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>{c.category_name}</Text>
                  <Text style={styles.breakdownValue}>{money(c.total)} • {c.count}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        <View style={styles.list}>
          <Pressable testID="change-password-link" style={styles.listItem} onPress={() => router.push("/change-password")}>
            <Feather name="lock" size={18} color={colors.onSurface} />
            <Text style={styles.listText}>Change password</Text>
            <Feather name="chevron-right" size={18} color={colors.muted} />
          </Pressable>
          <Pressable testID="notifications-link" style={styles.listItem} onPress={() => router.push("/notifications")}>
            <Feather name="bell" size={18} color={colors.onSurface} />
            <Text style={styles.listText}>Notifications</Text>
            <Feather name="chevron-right" size={18} color={colors.muted} />
          </Pressable>
          {user?.role === "admin" ? (
            <>
              <Pressable testID="users-link" style={styles.listItem} onPress={() => router.push("/admin/users")}>
                <Feather name="users" size={18} color={colors.onSurface} />
                <Text style={styles.listText}>User Management</Text>
                <Feather name="chevron-right" size={18} color={colors.muted} />
              </Pressable>
              <Pressable testID="categories-link" style={styles.listItem} onPress={() => router.push("/admin/categories")}>
                <Feather name="tag" size={18} color={colors.onSurface} />
                <Text style={styles.listText}>Service Categories</Text>
                <Feather name="chevron-right" size={18} color={colors.muted} />
              </Pressable>
            </>
          ) : null}
          <Pressable testID="logout-button" style={styles.listItem} onPress={logout}>
            <Feather name="log-out" size={18} color={colors.error} />
            <Text style={[styles.listText, { color: colors.error }]}>Sign out</Text>
          </Pressable>
        </View>

        <Text style={styles.footerNote}>
          Earnings reflect completed job revenue only, not collected payments or net profit.
        </Text>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  wrap: { flex: 1, backgroundColor: colors.surfaceSecondary },
  header: { paddingHorizontal: 20, paddingVertical: 14, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.divider },
  title: { fontSize: 20, fontWeight: "700", color: colors.onSurface },
  profileCard: {
    backgroundColor: colors.surface, padding: 24, borderRadius: 16, alignItems: "center",
    borderWidth: 1, borderColor: colors.border,
  },
  avatar: {
    width: 72, height: 72, borderRadius: 999, backgroundColor: colors.brandPrimary,
    alignItems: "center", justifyContent: "center", marginBottom: 12,
  },
  name: { fontSize: 20, fontWeight: "700", color: colors.onSurface },
  email: { color: colors.muted, marginTop: 2 },
  roleBadge: { marginTop: 10, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999 },

  earningsCard: {
    marginTop: 16, backgroundColor: colors.surface, padding: 20, borderRadius: 16,
    borderWidth: 1, borderColor: colors.border,
  },
  cardTitle: { fontSize: 14, fontWeight: "600", color: colors.muted },
  earningsTotal: { fontSize: 28, fontWeight: "800", color: colors.onSurface, marginTop: 4 },
  rowAround: { flexDirection: "row", marginTop: 16, justifyContent: "space-between" },
  colCenter: { flex: 1, alignItems: "center" },
  lblSm: { color: colors.muted, fontSize: 11 },
  valSm: { fontWeight: "700", color: colors.onSurface, marginTop: 2 },
  breakdown: { marginTop: 20, borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 16 },
  breakdownTitle: { fontSize: 13, fontWeight: "700", color: colors.onSurface, marginBottom: 8 },
  breakdownRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  breakdownLabel: { color: colors.onSurfaceSecondary, fontSize: 13 },
  breakdownValue: { color: colors.onSurface, fontSize: 13, fontWeight: "600" },

  list: { marginTop: 16, backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border },
  listItem: {
    flexDirection: "row", alignItems: "center", padding: 16, gap: 12,
    borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  listText: { flex: 1, color: colors.onSurface, fontSize: 15, fontWeight: "500" },
  footerNote: { color: colors.muted, fontSize: 12, textAlign: "center", marginTop: 24, paddingHorizontal: 20, lineHeight: 18 },
}));
