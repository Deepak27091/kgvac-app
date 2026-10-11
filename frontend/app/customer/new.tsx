import { useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@react-native-vector-icons/feather";
import { makeStyles, useTheme } from "@/src/theme";
import { api } from "@/src/auth";

export default function NewCustomer() {
  const router = useRouter();
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState({ name: "", company: "", phone: "", email: "", address: "", notes: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setError("");
    if (!form.name.trim()) { setError("Name is required"); return; }
    setSaving(true);
    try {
      await api("/customers", { method: "POST", body: JSON.stringify(form) });
      router.back();
    } catch (e: any) {
      setError(e.message);
    } finally { setSaving(false); }
  };

  return (
    <KeyboardAvoidingView style={styles.wrap} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable testID="back-button" onPress={() => router.back()} hitSlop={10}>
          <Feather name="x" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>New Customer</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        <Label>Name *</Label>
        <TextInput testID="new-cust-name" style={styles.input} value={form.name} onChangeText={(t) => setForm({ ...form, name: t })} placeholder="Jane Smith" placeholderTextColor={colors.muted} />
        <Label>Company / Business</Label>
        <TextInput testID="new-cust-company" style={styles.input} value={form.company} onChangeText={(t) => setForm({ ...form, company: t })} placeholder="ABC Restaurant" placeholderTextColor={colors.muted} />
        <Label>Phone</Label>
        <TextInput testID="new-cust-phone" style={styles.input} value={form.phone} onChangeText={(t) => setForm({ ...form, phone: t })} keyboardType="phone-pad" placeholder="(555) 555-0123" placeholderTextColor={colors.muted} />
        <Label>Email</Label>
        <TextInput testID="new-cust-email" style={styles.input} value={form.email} onChangeText={(t) => setForm({ ...form, email: t })} keyboardType="email-address" autoCapitalize="none" placeholderTextColor={colors.muted} />
        <Label>Service Address</Label>
        <TextInput testID="new-cust-address" style={[styles.input, { height: 70 }]} value={form.address} onChangeText={(t) => setForm({ ...form, address: t })} multiline placeholderTextColor={colors.muted} />
        <Label>Notes</Label>
        <TextInput testID="new-cust-notes" style={[styles.input, { height: 70 }]} value={form.notes} onChangeText={(t) => setForm({ ...form, notes: t })} multiline placeholderTextColor={colors.muted} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Pressable testID="save-customer-button" style={[styles.btn, saving && { opacity: 0.5 }]} onPress={submit} disabled={saving}>
          <Text style={styles.btnText}>{saving ? "Saving..." : "Create Customer"}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  const styles = useStyles();
  return <Text style={styles.label}>{children}</Text>;
}

const useStyles = makeStyles((colors) => ({
  wrap: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.divider },
  headerTitle: { fontSize: 17, fontWeight: "700", color: colors.onSurface },
  label: { fontSize: 12, color: colors.onSurfaceSecondary, marginTop: 14, marginBottom: 6, fontWeight: "600" },
  input: {
    backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 12, color: colors.onSurface, fontSize: 15,
  },
  error: { color: colors.error, marginTop: 12 },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 10, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.divider },
  btn: { backgroundColor: colors.brandPrimary, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  btnText: { color: colors.onBrandPrimary, fontWeight: "700", fontSize: 16 },
}));
