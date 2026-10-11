import { useEffect, useMemo, useState, useCallback } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Calendar as RNCalendar } from "react-native-calendars";
import Feather from "@react-native-vector-icons/feather";
import { makeStyles, useTheme, STATUS_COLORS } from "@/src/theme";
import { api, useAuth } from "@/src/auth";
import { StatusBadge } from "@/src/components/status-badge";

export default function CalendarScreen() {
  const router = useRouter();
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [selected, setSelected] = useState<string>(todayStr);
  const [jobs, setJobs] = useState<any[]>([]);
  const [monthJobs, setMonthJobs] = useState<Record<string, any[]>>({});

  const load = useCallback(async (dateStr: string) => {
    const first = `${dateStr.slice(0, 7)}-01`;
    const d = new Date(first);
    const next = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const last = next.toISOString().slice(0, 10);
    const data = await api<any[]>(`/jobs?date_from=${first}&date_to=${last}`);
    const map: Record<string, any[]> = {};
    for (const j of data) {
      if (!map[j.scheduled_date]) map[j.scheduled_date] = [];
      map[j.scheduled_date].push(j);
    }
    setMonthJobs(map);
    setJobs((map[dateStr] ?? []).sort((a, b) => a.scheduled_time.localeCompare(b.scheduled_time)));
  }, []);

  useEffect(() => { load(selected); }, [load, selected]);

  const marked = useMemo(() => {
    const m: any = {};
    for (const d of Object.keys(monthJobs)) {
      const dots = monthJobs[d].slice(0, 4).map((j) => ({ color: STATUS_COLORS[j.status]?.fg || colors.muted }));
      m[d] = { dots };
    }
    m[selected] = { ...(m[selected] || {}), selected: true, selectedColor: colors.brandPrimary };
    return m;
  }, [monthJobs, selected, colors]);

  return (
    <View style={[styles.wrap, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Calendar</Text>
        {user?.role === "admin" ? (
          <Pressable testID="calendar-add-job" onPress={() => router.push(`/job/new?date=${selected}`)}>
            <Feather name="plus-circle" size={26} color={colors.brandPrimary} />
          </Pressable>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        <RNCalendar
          testID="calendar-view"
          current={selected}
          markedDates={marked}
          markingType="multi-dot"
          onDayPress={(d: any) => setSelected(d.dateString)}
          theme={{
            backgroundColor: colors.surface,
            calendarBackground: colors.surface,
            selectedDayBackgroundColor: colors.brandPrimary,
            todayTextColor: colors.brandPrimary,
            arrowColor: colors.brandPrimary,
            monthTextColor: colors.onSurface,
            textSectionTitleColor: colors.muted,
            dayTextColor: colors.onSurface,
          }}
        />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Jobs on {selected}</Text>
          {jobs.length === 0 ? (
            <View style={styles.empty}>
              <Feather name="calendar" size={32} color={colors.muted} />
              <Text style={styles.emptyText}>No jobs on this date</Text>
            </View>
          ) : jobs.map((j: any) => (
            <Pressable
              key={j.id}
              testID={`calendar-job-${j.id}`}
              style={styles.jobCard}
              onPress={() => router.push(`/job/${j.id}`)}
            >
              <View style={styles.rowBetween}>
                <Text style={styles.time}>{j.scheduled_time}</Text>
                <StatusBadge status={j.status} size="sm" />
              </View>
              <Text style={styles.jobTitle}>{j.customer_company || j.customer_name}</Text>
              <Text style={styles.jobMeta}>{j.category_name}</Text>
              {j.assigned_to_name ? <Text style={styles.jobMeta}>Assigned: {j.assigned_to_name}</Text> : null}
            </Pressable>
          ))}
        </View>
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
  section: { padding: 16 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.onSurface, marginBottom: 10 },
  jobCard: {
    backgroundColor: colors.surface, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: colors.border, marginBottom: 10,
  },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  time: { color: colors.brandPrimary, fontWeight: "700", fontSize: 15 },
  jobTitle: { fontSize: 15, fontWeight: "700", color: colors.onSurface, marginTop: 6 },
  jobMeta: { fontSize: 13, color: colors.muted, marginTop: 2 },
  empty: { padding: 32, alignItems: "center", backgroundColor: colors.surface, borderRadius: 12 },
  emptyText: { color: colors.muted, marginTop: 8 },
}));
