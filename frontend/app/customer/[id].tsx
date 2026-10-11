import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Platform } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@react-native-vector-icons/feather";
import { makeStyles, useTheme } from "@/src/theme";
import { api } from "@/src/auth";
import { StatusBadge } from "@/src/components/status-badge";

export default function CustomerDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [customer, setCustomer] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>({});

  const load = useCallback(async () => {
    const c = await api<any>(`/customers/${id}`);
    setCustomer(c);
    setForm(c);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    const body = { name: form.name, company: form.company, phone: form.phone, email: form.email, address: form.address, notes: form.notes };
    await api(`/customers/${id}`, { method: "PATCH", body: JSON.stringify(body) });
    setEditing(false);
    await load();
  };

  if (!customer) {
    return <View style={[styles.wrap, { paddingTop: insets.top }]}><Text style={{ padding: 20, color: colors.muted }}>Loading...</Text></View>;
  }

  const upcoming = (customer.jobs || []).filter((j: any) => j.status !== "Completed" && j.status !== "Cancelled");
  const past = (customer.jobs || []).filter((j: any) => j.status === "Completed" || j.status === "Cancelled");

  return (
    <KeyboardAvoidingView style={styles.wrap} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable testID="back-button" onPress={() => router.back()} hitSlop={10}>
          <Feather name="arrow-left" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>{customer.company || customer.name}</Text>
        <Pressable testID="edit-customer-button" onPress={() => setEditing(!editing)} hitSlop={10}>
          <Feather name={editing ? "x" : "edit-2"} size={20} color={colors.brandPrimary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        <View style={styles.card}>
          {editing ? (
            <>
              <SmallLabel>Name</SmallLabel>
              <TextInput testID="cust-name" style={styles.input} value={form.name} onChangeText={(t) => setForm({ ...form, name: t })} placeholderTextColor={colors.muted} />
              <SmallLabel>Company</SmallLabel>
              <TextInput testID="cust-company" style={styles.input} value={form.company} onChangeText={(t) => setForm({ ...form, company: t })} placeholderTextColor={colors.muted} />
              <SmallLabel>Phone</SmallLabel>
              <TextInput testID="cust-phone" style={styles.input} value={form.phone} onChangeText={(t) => setForm({ ...form, phone: t })} placeholderTextColor={colors.muted} />
              <SmallLabel>Email</SmallLabel>
              <TextInput testID="cust-email" style={styles.input} value={form.email} onChangeText={(t) => setForm({ ...form, email: t })} placeholderTextColor={colors.muted} />
              <SmallLabel>Address</SmallLabel>
              <TextInput testID="cust-address" style={[styles.input, { height: 60 }]} value={form.address} multiline onChangeText={(t) => setForm({ ...form, address: t })} placeholderTextColor={colors.muted} />
              <SmallLabel>Notes</SmallLabel>
              <TextInput testID="cust-notes" style={[styles.input, { height: 60 }]} value={form.notes} multiline onChangeText={(t) => setForm({ ...form, notes: t })} placeholderTextColor={colors.muted} />
              <Pressable testID="save-customer-button" style={styles.saveBtn} onPress={save}>
                <Text style={styles.saveBtnText}>Save</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.name}>{customer.name}</Text>
              {customer.company ? <Text style={styles.meta}>{customer.company}</Text> : null}
              {customer.phone ? <InfoRow icon="phone" text={customer.phone} /> : null}
              {customer.email ? <InfoRow icon="mail" text={customer.email} /> : null}
              {customer.address ? <InfoRow icon="map-pin" text={customer.address} /> : null}
              {customer.notes ? <InfoRow icon="file-text" text={customer.notes} /> : null}
            </>
          )}
        </View>

        <Pressable testID="new-job-for-customer" style={styles.quickBtn} onPress={() => router.push(`/job/new?customer_id=${customer.id}`)}>
          <Feather name="plus-circle" size={18} color={colors.brandPrimary} />
          <Text style={styles.quickBtnText}>Schedule a new job</Text>
        </Pressable>

        <Text style={styles.sectionTitle}>Upcoming Jobs ({upcoming.length})</Text>
        {upcoming.length === 0 ? (
          <Text style={styles.emptyText}>No upcoming jobs</Text>
        ) : upcoming.map((j: any) => (
          <Pressable key={j.id} testID={`cust-job-${j.id}`} style={styles.jobRow} onPress={() => router.push(`/job/${j.id}`)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.jobTitle}>{j.scheduled_date} at {j.scheduled_time}</Text>
              <Text style={styles.jobMeta}>{j.category_name}</Text>
            </View>
            <StatusBadge status={j.status} size="sm" />
          </Pressable>
        ))}

        <Text style={styles.sectionTitle}>Past Jobs ({past.length})</Text>
        {past.length === 0 ? (
          <Text style={styles.emptyText}>No past jobs</Text>
        ) : past.map((j: any) => (
          <Pressable key={j.id} testID={`cust-past-job-${j.id}`} style={styles.jobRow} onPress={() => router.push(`/job/${j.id}`)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.jobTitle}>{j.scheduled_date}</Text>
              <Text style={styles.jobMeta}>{j.category_name} • ${(j.price || 0).toFixed(2)}</Text>
            </View>
            <StatusBadge status={j.status} size="sm" />
          </Pressable>
        ))}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function SmallLabel({ children }: { children: React.ReactNode }) {
  const styles = useStyles();
  return <Text style={styles.label}>{children}</Text>;
}

function InfoRow({ icon, text }: { icon: string; text: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.infoRow}>
      <Feather name={icon as any} size={14} color={colors.muted} />
      <Text style={styles.infoText}>{text}</Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  wrap: { flex: 1, backgroundColor: colors.surfaceSecondary },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 12, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 16, fontWeight: "700", color: colors.onSurface, marginHorizontal: 12 },
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border },
  name: { fontSize: 20, fontWeight: "700", color: colors.onSurface },
  meta: { color: colors.muted, marginTop: 2 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  infoText: { color: colors.onSurfaceSecondary, fontSize: 14 },

  label: { fontSize: 12, color: colors.muted, marginTop: 10, marginBottom: 4, fontWeight: "600" },
  input: {
    backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, color: colors.onSurface, fontSize: 14,
  },
  saveBtn: { marginTop: 16, backgroundColor: colors.brandPrimary, borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  saveBtnText: { color: colors.onBrandPrimary, fontWeight: "700" },

  quickBtn: {
    marginTop: 12, backgroundColor: colors.brandTertiary, borderRadius: 12, padding: 14,
    flexDirection: "row", alignItems: "center", gap: 10, justifyContent: "center",
  },
  quickBtnText: { color: colors.onBrandTertiary, fontWeight: "700" },

  sectionTitle: { fontSize: 14, fontWeight: "700", color: colors.onSurface, marginTop: 24, marginBottom: 8 },
  jobRow: {
    flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, padding: 14, borderRadius: 10,
    borderWidth: 1, borderColor: colors.border, marginBottom: 8,
  },
  jobTitle: { fontWeight: "700", color: colors.onSurface, fontSize: 14 },
  jobMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  emptyText: { color: colors.muted, fontSize: 13, paddingVertical: 8 },
}));
