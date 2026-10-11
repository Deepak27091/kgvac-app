import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, Pressable, TextInput, RefreshControl } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@react-native-vector-icons/feather";
import { makeStyles, useTheme } from "@/src/theme";
import { useAuth, api } from "@/src/auth";
import { StatusBadge } from "@/src/components/status-badge";
import { OverdueBadge } from "@/src/components/overdue-badge";

const STATUSES = ["Scheduled", "Start", "Processing", "Completed", "Rescheduled", "Cancelled"];

export default function JobsScreen() {
  const router = useRouter();
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ status?: string; today?: string; upcoming?: string; overdue?: string }>();

  const [jobs, setJobs] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(params.status || null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (statusFilter) qs.set("status", statusFilter);
      if (q) qs.set("q", q);
      if (params.today === "1") {
        const d = new Date().toISOString().slice(0, 10);
        qs.set("date_from", d);
        qs.set("date_to", d);
      }
      if (params.upcoming === "1") {
        const now = new Date();
        now.setDate(now.getDate() + 1);
        qs.set("date_from", now.toISOString().slice(0, 10));
      }
      if (params.overdue === "1") qs.set("overdue", "true");
      const data = await api<any[]>(`/jobs?${qs.toString()}`);
      setJobs(data);
    } finally { setLoading(false); }
  }, [statusFilter, q, params.today, params.upcoming, params.overdue]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (params.status) setStatusFilter(params.status);
  }, [params.status]);

  return (
    <View style={[styles.wrap, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>{user?.role === "admin" ? "All Jobs" : "My Jobs"}</Text>
        {user?.role === "admin" ? (
          <Pressable testID="header-add-job" onPress={() => router.push("/job/new")}>
            <Feather name="plus-circle" size={26} color={colors.brandPrimary} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.searchRow}>
        <Feather name="search" size={16} color={colors.muted} style={{ marginLeft: 12 }} />
        <TextInput
          testID="jobs-search-input"
          style={styles.search}
          value={q}
          onChangeText={setQ}
          onSubmitEditing={load}
          placeholder="Search job ID, customer, phone..."
          placeholderTextColor={colors.muted}
          returnKeyType="search"
        />
      </View>

      <ScrollView
        horizontal
        style={styles.chipRow}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8, alignItems: "center" }}
        showsHorizontalScrollIndicator={false}
      >
        <Pressable
          testID="chip-all"
          style={[styles.chip, !statusFilter && styles.chipActive]}
          onPress={() => setStatusFilter(null)}
        >
          <Text style={[styles.chipText, !statusFilter && styles.chipTextActive]}>All</Text>
        </Pressable>
        {STATUSES.map((s) => (
          <Pressable
            key={s}
            testID={`chip-${s}`}
            style={[styles.chip, statusFilter === s && styles.chipActive]}
            onPress={() => setStatusFilter(statusFilter === s ? null : s)}
          >
            <Text style={[styles.chipText, statusFilter === s && styles.chipTextActive]}>{s}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
      >
        {jobs.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="briefcase" size={32} color={colors.muted} />
            <Text style={styles.emptyText}>No jobs match your filters</Text>
          </View>
        ) : (
          jobs.map((j) => (
            <Pressable
              key={j.id}
              testID={`job-row-${j.id}`}
              style={styles.jobCard}
              onPress={() => router.push(`/job/${j.id}`)}
            >
              <View style={styles.jobHead}>
                <Text style={styles.jobTitle} numberOfLines={1}>{j.customer_company || j.customer_name}</Text>
                <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                  {j.is_overdue ? <OverdueBadge /> : null}
                  <StatusBadge status={j.status} size="sm" />
                </View>
              </View>
              <Text style={styles.jobMeta}>{j.category_name} • {j.scheduled_date} • {j.scheduled_time}</Text>
              {j.assigned_to_name ? <Text style={styles.jobMeta}>Assigned to {j.assigned_to_name}</Text> : null}
              <Text style={styles.jobPrice}>${(j.price || 0).toFixed(2)} CAD</Text>
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  wrap: { flex: 1, backgroundColor: colors.surfaceSecondary },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingVertical: 14, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  title: { fontSize: 20, fontWeight: "700", color: colors.onSurface },
  searchRow: {
    flexDirection: "row", alignItems: "center", backgroundColor: colors.surface,
    marginHorizontal: 16, marginTop: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border,
  },
  search: { flex: 1, paddingVertical: 12, paddingHorizontal: 10, color: colors.onSurface, fontSize: 14 },
  chipRow: { marginTop: 12, maxHeight: 44 },
  chip: {
    paddingVertical: 7, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1,
    borderColor: colors.border, backgroundColor: colors.surface, flexShrink: 0, height: 36, justifyContent: "center",
  },
  chipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  chipText: { color: colors.onSurfaceSecondary, fontSize: 13, fontWeight: "600" },
  chipTextActive: { color: colors.onBrandPrimary },
  jobCard: {
    backgroundColor: colors.surface, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: colors.border, marginBottom: 10,
  },
  jobHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  jobTitle: { flex: 1, fontSize: 15, fontWeight: "700", color: colors.onSurface, marginRight: 8 },
  jobMeta: { fontSize: 13, color: colors.muted, marginTop: 2 },
  jobPrice: { marginTop: 6, color: colors.brandPrimary, fontWeight: "700", fontSize: 14 },
  empty: { padding: 48, alignItems: "center" },
  emptyText: { color: colors.muted, marginTop: 8 },
}));
