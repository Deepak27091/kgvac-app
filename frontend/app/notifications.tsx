import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, Pressable, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@react-native-vector-icons/feather";
import { makeStyles, useTheme } from "@/src/theme";
import { api } from "@/src/auth";

export default function NotificationsScreen() {
  const router = useRouter();
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [notifs, setNotifs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<any[]>("/notifications");
      setNotifs(data);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const markAll = async () => {
    await api("/notifications/read-all", { method: "POST" });
    await load();
  };

  return (
    <View style={[styles.wrap, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable testID="back-button" onPress={() => router.back()} hitSlop={10}>
          <Feather name="arrow-left" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Notifications</Text>
        <Pressable testID="mark-all-read" onPress={markAll} hitSlop={10}>
          <Text style={{ color: colors.brandPrimary, fontWeight: "700" }}>Mark all</Text>
        </Pressable>
      </View>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
      >
        {notifs.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="bell-off" size={32} color={colors.muted} />
            <Text style={styles.emptyText}>No notifications</Text>
          </View>
        ) : notifs.map((n) => (
          <Pressable
            key={n.id}
            testID={`notif-${n.id}`}
            style={[styles.card, !n.read && styles.cardUnread]}
            onPress={async () => {
              await api(`/notifications/${n.id}/read`, { method: "POST" });
              if (n.job_id) router.push(`/job/${n.job_id}`);
              else load();
            }}
          >
            <View style={styles.cardHead}>
              <Text style={styles.cardTitle}>{n.title}</Text>
              {!n.read ? <View style={styles.unreadDot} /> : null}
            </View>
            <Text style={styles.cardBody}>{n.body}</Text>
            <Text style={styles.cardTime}>{new Date(n.created_at).toLocaleString()}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  wrap: { flex: 1, backgroundColor: colors.surfaceSecondary },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.divider },
  headerTitle: { fontSize: 17, fontWeight: "700", color: colors.onSurface },
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
  cardUnread: { borderLeftWidth: 4, borderLeftColor: colors.brandPrimary },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { flex: 1, fontWeight: "700", color: colors.onSurface, fontSize: 14 },
  unreadDot: { width: 8, height: 8, borderRadius: 999, backgroundColor: colors.brandPrimary },
  cardBody: { color: colors.onSurfaceSecondary, fontSize: 13, marginTop: 4 },
  cardTime: { color: colors.muted, fontSize: 11, marginTop: 6 },
  empty: { padding: 48, alignItems: "center" },
  emptyText: { color: colors.muted, marginTop: 8 },
}));
