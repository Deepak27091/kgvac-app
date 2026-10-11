import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, Pressable, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@react-native-vector-icons/feather";
import { makeStyles, useTheme } from "@/src/theme";
import { useAuth, api } from "@/src/auth";
import { StatusBadge } from "@/src/components/status-badge";
import { OverdueBadge } from "@/src/components/overdue-badge";

type Stats = {
  today: number; upcoming: number; scheduled: number; started: number;
  processing: number; completed: number; rescheduled: number; cancelled: number;
  overdue: number;
  today_jobs: any[]; upcoming_jobs: any[];
};

type Earnings = {
  all_time_total: number; all_time_count: number;
  today_total: number; month_total: number;
};

export default function Dashboard() {
  const router = useRouter();
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [stats, setStats] = useState<Stats | null>(null);
  const [earnings, setEarnings] = useState<Earnings | null>(null);
  const [unread, setUnread] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, e, n] = await Promise.all([
        api<Stats>("/dashboard/stats"),
        api<Earnings>("/earnings"),
        api<any[]>("/notifications"),
      ]);
      setStats(s);
      setEarnings(e);
      setUnread(n.filter((x: any) => !x.read).length);
    } catch (err) {
      console.log("dashboard load failed", err);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const money = (n: number) => `$${(n ?? 0).toFixed(2)}`;

  const statCards = [
    { key: "today", label: "Today", value: stats?.today ?? 0, color: colors.brandPrimary, filter: null, filterLabel: "today" },
    { key: "overdue", label: "Overdue", value: stats?.overdue ?? 0, color: colors.error, overdue: true },
    { key: "upcoming", label: "Upcoming (7d)", value: stats?.upcoming ?? 0, color: colors.info },
    { key: "scheduled", label: "Scheduled", value: stats?.scheduled ?? 0, color: colors.warning, status: "Scheduled" },
    { key: "started", label: "Started", value: stats?.started ?? 0, color: colors.info, status: "Start" },
    { key: "processing", label: "Processing", value: stats?.processing ?? 0, color: colors.processing, status: "Processing" },
    { key: "completed", label: "Completed", value: stats?.completed ?? 0, color: colors.success, status: "Completed" },
    { key: "rescheduled", label: "Rescheduled", value: stats?.rescheduled ?? 0, color: colors.rescheduled, status: "Rescheduled" },
    { key: "cancelled", label: "Cancelled", value: stats?.cancelled ?? 0, color: colors.error, status: "Cancelled" },
  ];

  return (
    <View style={[styles.wrap, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.hello}>Hi, {user?.name}</Text>
          <Text style={styles.sub}>{user?.role === "admin" ? "Admin" : "Staff"} Dashboard</Text>
        </View>
        <Pressable testID="notifications-button" onPress={() => router.push("/notifications")} style={styles.bell}>
          <Feather name="bell" size={22} color={colors.onSurface} />
          {unread > 0 ? <View style={styles.dot} /> : null}
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Earnings */}
        <View style={styles.earningsCard}>
          <Text style={styles.earningsLabel}>{user?.role === "admin" ? "Total Earnings" : "Your Earnings"}</Text>
          <Text testID="earnings-total" style={styles.earningsValue}>{money(earnings?.all_time_total ?? 0)}</Text>
          <View style={styles.earningsRow}>
            <View style={styles.earningsCol}>
              <Text style={styles.earningsSub}>Today</Text>
              <Text testID="earnings-today" style={styles.earningsNum}>{money(earnings?.today_total ?? 0)}</Text>
            </View>
            <View style={styles.earningsDivider} />
            <View style={styles.earningsCol}>
              <Text style={styles.earningsSub}>This Month</Text>
              <Text testID="earnings-month" style={styles.earningsNum}>{money(earnings?.month_total ?? 0)}</Text>
            </View>
            <View style={styles.earningsDivider} />
            <View style={styles.earningsCol}>
              <Text style={styles.earningsSub}>Completed</Text>
              <Text style={styles.earningsNum}>{earnings?.all_time_count ?? 0}</Text>
            </View>
          </View>
        </View>

        {/* Stats grid */}
        <View style={styles.gridWrap}>
          {statCards.map((s) => (
            <Pressable
              key={s.key}
              testID={`stat-card-${s.key}`}
              style={styles.statCard}
              onPress={() => {
                if (s.status) router.push(`/(tabs)/jobs?status=${s.status}`);
                else if (s.key === "today") router.push(`/(tabs)/jobs?today=1`);
                else if (s.key === "upcoming") router.push(`/(tabs)/jobs?upcoming=1`);
                else if (s.overdue) router.push(`/(tabs)/jobs?overdue=1`);
              }}
            >
              <View style={[styles.statDot, { backgroundColor: s.color }]} />
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Today's Schedule */}
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Today&apos;s Schedule</Text>
            <Pressable testID="view-today-jobs" onPress={() => router.push("/(tabs)/jobs?today=1")}>
              <Text style={styles.link}>View all</Text>
            </Pressable>
          </View>
          {(stats?.today_jobs ?? []).length === 0 ? (
            <View style={styles.empty}>
              <Feather name="calendar" size={32} color={colors.muted} />
              <Text style={styles.emptyText}>No jobs scheduled for today</Text>
            </View>
          ) : (
            (stats?.today_jobs ?? []).map((j: any) => (
              <Pressable
                key={j.id}
                testID={`job-card-${j.id}`}
                style={styles.jobCard}
                onPress={() => router.push(`/job/${j.id}`)}
              >
                <View style={styles.jobHead}>
                  <Text style={styles.jobTitle}>{j.customer_company || j.customer_name}</Text>
                  <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                    {j.is_overdue ? <OverdueBadge /> : null}
                    <StatusBadge status={j.status} size="sm" />
                  </View>
                </View>
                <Text style={styles.jobMeta}>{j.category_name} • {j.scheduled_time}</Text>
                {j.assigned_to_name ? <Text style={styles.jobMeta}>Assigned: {j.assigned_to_name}</Text> : null}
              </Pressable>
            ))
          )}
        </View>

        {/* Upcoming */}
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Upcoming Jobs</Text>
          </View>
          {(stats?.upcoming_jobs ?? []).length === 0 ? (
            <View style={styles.empty}><Text style={styles.emptyText}>No upcoming jobs</Text></View>
          ) : (
            (stats?.upcoming_jobs ?? []).map((j: any) => (
              <Pressable
                key={j.id}
                testID={`upcoming-job-${j.id}`}
                style={styles.jobCard}
                onPress={() => router.push(`/job/${j.id}`)}
              >
                <View style={styles.jobHead}>
                  <Text style={styles.jobTitle}>{j.customer_company || j.customer_name}</Text>
                  <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                    {j.is_overdue ? <OverdueBadge /> : null}
                    <StatusBadge status={j.status} size="sm" />
                  </View>
                </View>
                <Text style={styles.jobMeta}>{j.category_name} • {j.scheduled_date} at {j.scheduled_time}</Text>
              </Pressable>
            ))
          )}
        </View>
      </ScrollView>

      {user?.role === "admin" ? (
        <Pressable
          testID="fab-add-job"
          style={[styles.fab, { bottom: 16 + 64 + 16 }]}
          onPress={() => router.push("/job/new")}
        >
          <Feather name="plus" size={26} color={colors.onBrand} />
        </Pressable>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  wrap: { flex: 1, backgroundColor: colors.surfaceSecondary },
  header: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 16,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  hello: { fontSize: 20, fontWeight: "700", color: colors.onSurface },
  sub: { fontSize: 13, color: colors.muted, marginTop: 2 },
  bell: { padding: 8, borderRadius: 999, backgroundColor: colors.surfaceSecondary },
  dot: {
    position: "absolute", top: 6, right: 6, width: 10, height: 10, borderRadius: 999,
    backgroundColor: colors.error, borderWidth: 2, borderColor: colors.surface,
  },
  earningsCard: {
    margin: 16, padding: 20, backgroundColor: colors.brandPrimary, borderRadius: 16,
  },
  earningsLabel: { color: colors.onBrand, opacity: 0.8, fontSize: 13, fontWeight: "600" },
  earningsValue: { color: colors.onBrand, fontSize: 32, fontWeight: "800", marginTop: 4 },
  earningsRow: { flexDirection: "row", marginTop: 16, alignItems: "stretch" },
  earningsCol: { flex: 1 },
  earningsDivider: { width: 1, backgroundColor: colors.onBrand, opacity: 0.2, marginHorizontal: 12 },
  earningsSub: { color: colors.onBrand, opacity: 0.8, fontSize: 11 },
  earningsNum: { color: colors.onBrand, fontSize: 14, fontWeight: "700", marginTop: 2 },

  gridWrap: {
    flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 12, gap: 8,
  },
  statCard: {
    width: "48%", backgroundColor: colors.surface, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: colors.border,
  },
  statDot: { width: 8, height: 8, borderRadius: 999, marginBottom: 8 },
  statValue: { fontSize: 22, fontWeight: "800", color: colors.onSurface },
  statLabel: { fontSize: 12, color: colors.muted, marginTop: 2 },

  section: { marginTop: 20, paddingHorizontal: 16 },
  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.onSurface },
  link: { color: colors.brandPrimary, fontSize: 13, fontWeight: "600" },

  jobCard: {
    backgroundColor: colors.surface, padding: 14, borderRadius: 12, marginBottom: 10,
    borderWidth: 1, borderColor: colors.border,
  },
  jobHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  jobTitle: { flex: 1, fontSize: 15, fontWeight: "700", color: colors.onSurface, marginRight: 8 },
  jobMeta: { fontSize: 13, color: colors.muted, marginTop: 2 },

  empty: { padding: 24, alignItems: "center", backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  emptyText: { color: colors.muted, marginTop: 8 },

  fab: {
    position: "absolute", right: 20, width: 56, height: 56, borderRadius: 999,
    backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 6,
  },
}));
