import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, TextInput, Pressable, Modal, KeyboardAvoidingView, Platform } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@react-native-vector-icons/feather";
import { makeStyles, useTheme } from "@/src/theme";
import { api } from "@/src/auth";
import { DateTimePickerSheet } from "@/src/components/datetime-picker";

export default function JobForm() {
  const { id, date } = useLocalSearchParams<{ id?: string; date?: string }>();
  const router = useRouter();
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const isEdit = !!id;

  const [customers, setCustomers] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);

  const [customerId, setCustomerId] = useState("");
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledDate, setScheduledDate] = useState(date || new Date().toISOString().slice(0, 10));
  const [scheduledTime, setScheduledTime] = useState("09:00");
  const [duration, setDuration] = useState("60");
  const [assignedTo, setAssignedTo] = useState("");
  const [price, setPrice] = useState("0");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [pickerType, setPickerType] = useState<null | "customer" | "category" | "staff">(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const loadRefs = useCallback(async () => {
    const [c, cat, u] = await Promise.all([
      api<any[]>("/customers"),
      api<any[]>("/categories"),
      api<any[]>("/users"),
    ]);
    setCustomers(c);
    setCategories(cat.filter((x) => x.active !== false));
    setStaff(u.filter((x: any) => !x.disabled));
  }, []);

  useEffect(() => {
    loadRefs();
    if (isEdit) {
      (async () => {
        const j = await api<any>(`/jobs/${id}`);
        setCustomerId(j.customer_id);
        setTitle(j.title || "");
        setCategoryId(j.category_id);
        setDescription(j.description || "");
        setScheduledDate(j.scheduled_date);
        setScheduledTime(j.scheduled_time);
        setDuration(String(j.duration_minutes || 60));
        setAssignedTo(j.assigned_to || "");
        setPrice(String(j.price || 0));
        setNotes(j.notes || "");
      })();
    }
  }, [id, isEdit, loadRefs]);

  const submit = async () => {
    setError("");
    if (!customerId) { setError("Select a customer"); return; }
    if (!categoryId) { setError("Select a service category"); return; }
    if (!scheduledDate || !scheduledTime) { setError("Date and time are required"); return; }
    setSaving(true);
    try {
      const body = {
        customer_id: customerId,
        title,
        category_id: categoryId,
        description,
        scheduled_date: scheduledDate,
        scheduled_time: scheduledTime,
        duration_minutes: parseInt(duration) || 60,
        assigned_to: assignedTo || null,
        price: parseFloat(price) || 0,
        notes,
      };
      if (isEdit) {
        await api(`/jobs/${id}`, { method: "PATCH", body: JSON.stringify(body) });
      } else {
        await api(`/jobs`, { method: "POST", body: JSON.stringify(body) });
      }
      router.back();
    } catch (e: any) {
      setError(e.message);
    } finally { setSaving(false); }
  };

  const customerLabel = customers.find((c) => c.id === customerId);
  const categoryLabel = categories.find((c) => c.id === categoryId);
  const staffLabel = staff.find((s) => s.id === assignedTo);

  return (
    <KeyboardAvoidingView style={styles.wrap} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable testID="back-button" onPress={() => router.back()} hitSlop={10}>
          <Feather name="x" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>{isEdit ? "Edit Job" : "New Job"}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        <SectionLabel>Customer</SectionLabel>
        <Pressable testID="customer-picker" style={styles.pickerInput} onPress={() => setPickerType("customer")}>
          <Text style={customerLabel ? styles.pickerText : styles.pickerPlaceholder}>
            {customerLabel ? (customerLabel.company || customerLabel.name) : "Select customer"}
          </Text>
          <Feather name="chevron-down" size={16} color={colors.muted} />
        </Pressable>

        <SectionLabel>Service Category</SectionLabel>
        <Pressable testID="category-picker" style={styles.pickerInput} onPress={() => setPickerType("category")}>
          <Text style={categoryLabel ? styles.pickerText : styles.pickerPlaceholder}>
            {categoryLabel?.name || "Select category"}
          </Text>
          <Feather name="chevron-down" size={16} color={colors.muted} />
        </Pressable>

        <SectionLabel>Job Title (optional)</SectionLabel>
        <TextInput testID="title-input" style={styles.input} value={title} onChangeText={setTitle} placeholder="e.g. Monthly grease trap service" placeholderTextColor={colors.muted} />

        <SectionLabel>Description</SectionLabel>
        <TextInput testID="description-input" style={[styles.input, { height: 80 }]} value={description} onChangeText={setDescription} multiline placeholderTextColor={colors.muted} />

        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <SectionLabel>Date & Time</SectionLabel>
            <Pressable testID="open-datetime-picker" style={styles.pickerInput} onPress={() => setShowDatePicker(true)}>
              <Text style={styles.pickerText}>{scheduledDate} at {scheduledTime}</Text>
              <Feather name="calendar" size={16} color={colors.brandPrimary} />
            </Pressable>
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <SectionLabel>Duration (minutes)</SectionLabel>
            <TextInput testID="duration-input" style={styles.input} value={duration} onChangeText={setDuration} keyboardType="numeric" placeholderTextColor={colors.muted} />
          </View>
          <View style={{ flex: 1 }}>
            <SectionLabel>Price (CAD $)</SectionLabel>
            <TextInput testID="price-input" style={styles.input} value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholderTextColor={colors.muted} />
          </View>
        </View>

        <SectionLabel>Assign to Staff</SectionLabel>
        <Pressable testID="staff-picker" style={styles.pickerInput} onPress={() => setPickerType("staff")}>
          <Text style={staffLabel ? styles.pickerText : styles.pickerPlaceholder}>
            {staffLabel?.name || "Unassigned"}
          </Text>
          <Feather name="chevron-down" size={16} color={colors.muted} />
        </Pressable>

        <SectionLabel>Internal Notes</SectionLabel>
        <TextInput testID="notes-input" style={[styles.input, { height: 70 }]} value={notes} onChangeText={setNotes} multiline placeholderTextColor={colors.muted} />

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Pressable testID="save-job-button" style={[styles.btn, saving && { opacity: 0.5 }]} onPress={submit} disabled={saving}>
          <Text style={styles.btnText}>{saving ? "Saving..." : (isEdit ? "Save Changes" : "Create Job")}</Text>
        </Pressable>
      </View>

      {/* Pickers */}
      <Modal visible={!!pickerType} transparent animationType="slide" onRequestClose={() => setPickerType(null)}>
        <View style={styles.modalWrap}>
          <Pressable style={styles.modalBackdrop} onPress={() => setPickerType(null)} />
          <View style={[styles.modalCard, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.pickerHeader}>
              <Text style={styles.modalTitle}>
                {pickerType === "customer" ? "Select Customer" : pickerType === "category" ? "Select Category" : "Assign to"}
              </Text>
              {pickerType === "customer" ? (
                <Pressable testID="picker-new-customer" onPress={() => { setPickerType(null); router.push("/customer/new"); }}>
                  <Text style={{ color: colors.brandPrimary, fontWeight: "700" }}>+ New</Text>
                </Pressable>
              ) : null}
            </View>
            <ScrollView style={{ maxHeight: 400 }}>
              {pickerType === "customer" && customers.map((c) => (
                <Pressable key={c.id} testID={`picker-customer-${c.id}`} style={styles.pickerRow} onPress={() => { setCustomerId(c.id); setPickerType(null); }}>
                  <Text style={styles.pickerRowText}>{c.company || c.name}</Text>
                  {c.company ? <Text style={styles.pickerRowSub}>{c.name}</Text> : null}
                </Pressable>
              ))}
              {pickerType === "category" && categories.map((c) => (
                <Pressable key={c.id} testID={`picker-category-${c.id}`} style={styles.pickerRow} onPress={() => { setCategoryId(c.id); setPickerType(null); }}>
                  <Text style={styles.pickerRowText}>{c.name}</Text>
                </Pressable>
              ))}
              {pickerType === "staff" && (
                <>
                  <Pressable testID="picker-unassigned" style={styles.pickerRow} onPress={() => { setAssignedTo(""); setPickerType(null); }}>
                    <Text style={styles.pickerRowText}>Unassigned</Text>
                  </Pressable>
                  {staff.map((s) => (
                    <Pressable key={s.id} testID={`picker-staff-${s.id}`} style={styles.pickerRow} onPress={() => { setAssignedTo(s.id); setPickerType(null); }}>
                      <Text style={styles.pickerRowText}>{s.name}</Text>
                      <Text style={styles.pickerRowSub}>{s.role === "admin" ? "Admin" : "Staff"}</Text>
                    </Pressable>
                  ))}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <DateTimePickerSheet
        visible={showDatePicker}
        initialDate={scheduledDate}
        initialTime={scheduledTime}
        title="Job date & time"
        onCancel={() => setShowDatePicker(false)}
        onConfirm={(d, t) => { setScheduledDate(d); setScheduledTime(t); setShowDatePicker(false); }}
      />
    </KeyboardAvoidingView>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  const styles = useStyles();
  return <Text style={styles.label}>{children}</Text>;
}

const useStyles = makeStyles((colors) => ({
  wrap: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  headerTitle: { fontSize: 17, fontWeight: "700", color: colors.onSurface },
  label: { fontSize: 12, color: colors.onSurfaceSecondary, marginTop: 14, marginBottom: 6, fontWeight: "600" },
  input: {
    backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 12, color: colors.onSurface, fontSize: 15,
  },
  pickerInput: {
    backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  pickerText: { color: colors.onSurface, fontSize: 15 },
  pickerPlaceholder: { color: colors.muted, fontSize: 15 },
  error: { color: colors.error, marginTop: 12, fontSize: 13 },
  footer: {
    position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 10,
    backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.divider,
  },
  btn: { backgroundColor: colors.brandPrimary, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  btnText: { color: colors.onBrandPrimary, fontWeight: "700", fontSize: 16 },

  modalWrap: { flex: 1, justifyContent: "flex-end" },
  modalBackdrop: { ...({ position: "absolute" } as any), top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.4)" },
  modalCard: { backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  pickerHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  modalTitle: { fontSize: 16, fontWeight: "700", color: colors.onSurface },
  pickerRow: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.divider },
  pickerRowText: { color: colors.onSurface, fontSize: 15, fontWeight: "500" },
  pickerRowSub: { color: colors.muted, fontSize: 12, marginTop: 2 },
}));
