import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, Pressable, Modal, TextInput, KeyboardAvoidingView, Platform } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@react-native-vector-icons/feather";
import { makeStyles, useTheme, STATUS_COLORS } from "@/src/theme";
import { api, useAuth } from "@/src/auth";
import { StatusBadge } from "@/src/components/status-badge";
import { OverdueBadge } from "@/src/components/overdue-badge";
import { DateTimePickerSheet } from "@/src/components/datetime-picker";

const STATUSES = ["Scheduled", "Start", "Processing", "Completed", "Rescheduled", "Cancelled"];

export default function JobDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [job, setJob] = useState<any>(null);
  const [statusModal, setStatusModal] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [schedDate, setSchedDate] = useState("");
  const [schedTime, setSchedTime] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);

  const load = useCallback(async () => {
    try {
      const j = await api<any>(`/jobs/${id}`);
      setJob(j);
    } catch (e: any) {
      setError(e.message);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const confirmStatus = async () => {
    if (!statusModal) return;
    try {
      const body: any = { new_status: statusModal, note };
      if (statusModal === "Rescheduled") {
        body.scheduled_date = schedDate;
        body.scheduled_time = schedTime;
      }
      if (statusModal === "Cancelled") body.reason = reason;
      await api(`/jobs/${id}/status`, { method: "POST", body: JSON.stringify(body) });
      setStatusModal(null); setNote(""); setSchedDate(""); setSchedTime(""); setReason("");
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  if (!job) {
    return (
      <View style={[styles.wrap, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable testID="back-button" onPress={() => router.back()} hitSlop={10}>
            <Feather name="arrow-left" size={24} color={colors.onSurface} />
          </Pressable>
          <Text style={styles.headerTitle}>Job Details</Text>
        </View>
        <Text style={{ padding: 20, color: colors.muted }}>{error || "Loading..."}</Text>
      </View>
    );
  }

  const canEdit = user?.role === "admin";

  return (
    <View style={[styles.wrap, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable testID="back-button" onPress={() => router.back()} hitSlop={10}>
          <Feather name="arrow-left" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Job #{job.id.slice(0, 8)}</Text>
        {canEdit ? (
          <Pressable testID="edit-job-button" onPress={() => router.push(`/job/new?id=${job.id}`)}>
            <Feather name="edit-2" size={20} color={colors.brandPrimary} />
          </Pressable>
        ) : <View style={{ width: 20 }} />}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
        <View style={styles.card}>
          <Text style={styles.customer}>{job.customer_company || job.customer_name}</Text>
          <Text style={styles.title}>{job.title || job.category_name}</Text>
          <View style={{ marginTop: 8, flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
            <StatusBadge status={job.status} />
            {job.is_overdue ? <OverdueBadge /> : null}
          </View>
          <View style={styles.metaRow}>
            <Feather name="calendar" size={14} color={colors.muted} />
            <Text style={styles.metaText}>{job.scheduled_date} at {job.scheduled_time}</Text>
          </View>
          <View style={styles.metaRow}>
            <Feather name="clock" size={14} color={colors.muted} />
            <Text style={styles.metaText}>Duration: {job.duration_minutes} min</Text>
          </View>
          <View style={styles.metaRow}>
            <Feather name="tag" size={14} color={colors.muted} />
            <Text style={styles.metaText}>{job.category_name}</Text>
          </View>
          <View style={styles.metaRow}>
            <Feather name="dollar-sign" size={14} color={colors.muted} />
            <Text style={[styles.metaText, { color: colors.brandPrimary, fontWeight: "700" }]}>
              ${(job.price || 0).toFixed(2)} CAD
            </Text>
          </View>
          {job.assigned_to_name ? (
            <View style={styles.metaRow}>
              <Feather name="user" size={14} color={colors.muted} />
              <Text style={styles.metaText}>Assigned: {job.assigned_to_name}</Text>
            </View>
          ) : null}
        </View>

        {/* Status actions */}
        {job.status !== "Cancelled" && job.status !== "Completed" ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Update Status</Text>
            <View style={styles.statusGrid}>
              {STATUSES.filter((s) => s !== job.status).map((s) => (
                <Pressable
                  key={s}
                  testID={`status-action-${s}`}
                  style={[styles.statusBtn, { borderColor: STATUS_COLORS[s].fg }]}
                  onPress={() => setStatusModal(s)}
                >
                  <Text style={{ color: STATUS_COLORS[s].fg, fontWeight: "700" }}>{s}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {/* Customer */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Customer</Text>
          <Text style={styles.rowLabel}>{job.customer_name}</Text>
          {job.customer_company ? <Text style={styles.rowMeta}>{job.customer_company}</Text> : null}
          {job.customer_phone ? <Text style={styles.rowMeta}>{job.customer_phone}</Text> : null}
          {job.customer_address ? <Text style={styles.rowMeta}>{job.customer_address}</Text> : null}
        </View>

        {job.description ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.body}>{job.description}</Text>
          </View>
        ) : null}

        {/* Notes */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Internal Notes</Text>
          <TextInput
            testID="notes-input"
            style={styles.notesInput}
            value={job.notes || ""}
            onChangeText={(t) => setJob({ ...job, notes: t })}
            multiline
            placeholder="Add notes..."
            placeholderTextColor={colors.muted}
          />
          <Pressable
            testID="save-notes-button"
            style={styles.saveBtn}
            onPress={async () => {
              await api(`/jobs/${job.id}/notes`, { method: "POST", body: JSON.stringify({ note: job.notes || "" }) });
              await load();
            }}
          >
            <Text style={styles.saveBtnText}>Save notes</Text>
          </Pressable>
        </View>

        {/* Activity */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Activity Log</Text>
          {(job.activity || []).length === 0 ? (
            <Text style={styles.rowMeta}>No activity yet</Text>
          ) : (job.activity || []).map((a: any) => (
            <View key={a.id} style={styles.activityRow}>
              <Feather name="activity" size={14} color={colors.muted} />
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.activityText}>{a.user_name} — {a.action.replace(/_/g, " ")}</Text>
                <Text style={styles.activityTime}>{new Date(a.created_at).toLocaleString()}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Status change modal */}
      <Modal visible={!!statusModal} transparent animationType="slide" onRequestClose={() => setStatusModal(null)}>
        <KeyboardAvoidingView style={styles.modalWrap} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <Pressable style={styles.modalBackdrop} onPress={() => setStatusModal(null)} />
          <View style={[styles.modalCard, { paddingBottom: 24 + insets.bottom }]}>
            <Text style={styles.modalTitle}>Change status to {statusModal}</Text>
            {statusModal === "Rescheduled" ? (
              <>
                <Text style={styles.label}>Pick new date & time</Text>
                <Pressable testID="open-date-picker" style={styles.pickerBtn} onPress={() => setShowDatePicker(true)}>
                  <Text style={schedDate ? styles.pickerBtnText : styles.pickerBtnPlaceholder}>
                    {schedDate && schedTime ? `${schedDate} at ${schedTime}` : "Tap to select date & time"}
                  </Text>
                  <Feather name="calendar" size={16} color={colors.brandPrimary} />
                </Pressable>
              </>
            ) : null}
            {statusModal === "Cancelled" ? (
              <>
                <Text style={styles.label}>Reason (optional)</Text>
                <TextInput testID="cancel-reason-input" style={styles.input} value={reason} onChangeText={setReason} placeholder="Customer rescheduled..." placeholderTextColor={colors.muted} />
              </>
            ) : null}
            <Text style={styles.label}>Note (optional)</Text>
            <TextInput testID="status-note-input" style={[styles.input, { height: 60 }]} value={note} onChangeText={setNote} multiline placeholderTextColor={colors.muted} />
            <Pressable testID="confirm-status-button" style={styles.saveBtn} onPress={() => {
              if (statusModal === "Rescheduled" && (!schedDate || !schedTime)) { setError("Pick a new date and time"); return; }
              confirmStatus();
            }}>
              <Text style={styles.saveBtnText}>Confirm</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <DateTimePickerSheet
        visible={showDatePicker}
        initialDate={schedDate || undefined}
        initialTime={schedTime || undefined}
        minDate={new Date().toISOString().slice(0, 10)}
        title="Reschedule to"
        onCancel={() => setShowDatePicker(false)}
        onConfirm={(d, t) => { setSchedDate(d); setSchedTime(t); setShowDatePicker(false); }}
      />
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  wrap: { flex: 1, backgroundColor: colors.surfaceSecondary },
  header: {
    flexDirection: "row", alignItems: "center", gap: 16, paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  headerTitle: { fontSize: 16, fontWeight: "700", color: colors.onSurface, flex: 1 },
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
  customer: { fontSize: 18, fontWeight: "800", color: colors.onSurface },
  title: { fontSize: 14, color: colors.muted, marginTop: 2 },
  metaRow: { flexDirection: "row", alignItems: "center", marginTop: 10, gap: 8 },
  metaText: { color: colors.onSurfaceSecondary, fontSize: 14 },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: colors.onSurface, marginBottom: 10 },
  statusGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statusBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1.5 },
  rowLabel: { fontWeight: "700", color: colors.onSurface, fontSize: 15 },
  rowMeta: { color: colors.muted, fontSize: 13, marginTop: 2 },
  body: { color: colors.onSurfaceSecondary, fontSize: 14, lineHeight: 20 },
  notesInput: {
    backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: 10,
    padding: 10, color: colors.onSurface, minHeight: 70, textAlignVertical: "top",
  },
  saveBtn: { marginTop: 10, backgroundColor: colors.brandPrimary, borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  saveBtnText: { color: colors.onBrandPrimary, fontWeight: "700" },
  activityRow: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.divider },
  activityText: { color: colors.onSurface, fontSize: 13, fontWeight: "500" },
  activityTime: { color: colors.muted, fontSize: 11, marginTop: 2 },

  modalWrap: { flex: 1, justifyContent: "flex-end" },
  modalBackdrop: { ...({ position: "absolute" } as any), top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.4)" },
  modalCard: { backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalTitle: { fontSize: 16, fontWeight: "700", color: colors.onSurface, marginBottom: 12 },
  label: { fontSize: 12, color: colors.muted, marginTop: 8, marginBottom: 4, fontWeight: "600" },
  input: {
    backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, color: colors.onSurface, fontSize: 14,
  },
  pickerBtn: {
    backgroundColor: colors.brandTertiary, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 14,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderWidth: 1, borderColor: colors.brandSecondary,
  },
  pickerBtnText: { color: colors.onBrandTertiary, fontWeight: "700", fontSize: 15 },
  pickerBtnPlaceholder: { color: colors.muted, fontSize: 14 },
}));
