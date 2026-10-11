import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, Pressable, Modal, TextInput, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@react-native-vector-icons/feather";
import { makeStyles, useTheme } from "@/src/theme";
import { api } from "@/src/auth";

export default function UsersAdmin() {
  const router = useRouter();
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [users, setUsers] = useState<any[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "staff" });
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const load = useCallback(async () => {
    const data = await api<any[]>("/users");
    setUsers(data);
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    setError("");
    try {
      await api("/users", { method: "POST", body: JSON.stringify(form) });
      setShowNew(false);
      setForm({ name: "", email: "", password: "", role: "staff" });
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const toggleDisable = async (u: any) => {
    await api(`/users/${u.id}`, { method: "PATCH", body: JSON.stringify({ disabled: !u.disabled }) });
    await load();
  };

  const resetPw = async (u: any) => {
    await api(`/users/${u.id}/reset-password`, { method: "POST" });
    setInfo(`Reset link emailed to ${u.email}`);
    setTimeout(() => setInfo(""), 3000);
  };

  return (
    <View style={[styles.wrap, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable testID="back-button" onPress={() => router.back()} hitSlop={10}>
          <Feather name="arrow-left" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>User Management</Text>
        <Pressable testID="add-user-button" onPress={() => setShowNew(true)} hitSlop={10}>
          <Feather name="plus-circle" size={24} color={colors.brandPrimary} />
        </Pressable>
      </View>

      {info ? <Text testID="user-info" style={styles.info}>{info}</Text> : null}

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {users.map((u) => (
          <View key={u.id} testID={`user-row-${u.id}`} style={styles.card}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{u.name}</Text>
                <Text style={styles.meta}>{u.email}</Text>
                <View style={{ flexDirection: "row", gap: 6, marginTop: 6 }}>
                  <View style={[styles.badge, { backgroundColor: u.role === "admin" ? colors.brandPrimary : colors.brandTertiary }]}>
                    <Text style={{ color: u.role === "admin" ? colors.onBrand : colors.onBrandTertiary, fontSize: 11, fontWeight: "700" }}>
                      {u.role}
                    </Text>
                  </View>
                  {u.disabled ? (
                    <View style={[styles.badge, { backgroundColor: colors.errorSurface }]}>
                      <Text style={{ color: colors.error, fontSize: 11, fontWeight: "700" }}>Disabled</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </View>
            <View style={styles.actionRow}>
              <Pressable testID={`reset-pw-${u.id}`} style={styles.actionBtn} onPress={() => resetPw(u)}>
                <Feather name="mail" size={14} color={colors.brandPrimary} />
                <Text style={styles.actionText}>Send reset</Text>
              </Pressable>
              <Pressable testID={`toggle-disable-${u.id}`} style={styles.actionBtn} onPress={() => toggleDisable(u)}>
                <Feather name={u.disabled ? "unlock" : "lock"} size={14} color={colors.brandPrimary} />
                <Text style={styles.actionText}>{u.disabled ? "Activate" : "Deactivate"}</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </ScrollView>

      <Modal visible={showNew} transparent animationType="slide" onRequestClose={() => setShowNew(false)}>
        <KeyboardAvoidingView style={styles.modalWrap} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <Pressable style={styles.modalBackdrop} onPress={() => setShowNew(false)} />
          <View style={[styles.modalCard, { paddingBottom: insets.bottom + 24 }]}>
            <Text style={styles.modalTitle}>New User</Text>
            <Text style={styles.label}>Name</Text>
            <TextInput testID="new-user-name" style={styles.input} value={form.name} onChangeText={(t) => setForm({ ...form, name: t })} placeholderTextColor={colors.muted} />
            <Text style={styles.label}>Email</Text>
            <TextInput testID="new-user-email" style={styles.input} value={form.email} onChangeText={(t) => setForm({ ...form, email: t })} autoCapitalize="none" keyboardType="email-address" placeholderTextColor={colors.muted} />
            <Text style={styles.label}>Temporary password</Text>
            <TextInput testID="new-user-password" style={styles.input} value={form.password} onChangeText={(t) => setForm({ ...form, password: t })} placeholderTextColor={colors.muted} />
            <Text style={styles.label}>Role</Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              {["admin", "staff"].map((r) => (
                <Pressable
                  key={r}
                  testID={`role-${r}`}
                  style={[styles.rolePill, form.role === r && { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary }]}
                  onPress={() => setForm({ ...form, role: r })}
                >
                  <Text style={{ color: form.role === r ? colors.onBrand : colors.onSurface, fontWeight: "700" }}>{r}</Text>
                </Pressable>
              ))}
            </View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable testID="create-user-button" style={styles.saveBtn} onPress={create}>
              <Text style={styles.saveBtnText}>Create user</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  wrap: { flex: 1, backgroundColor: colors.surfaceSecondary },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.divider },
  headerTitle: { fontSize: 17, fontWeight: "700", color: colors.onSurface },
  info: { backgroundColor: colors.successSurface, color: colors.success, padding: 10, textAlign: "center", fontSize: 13 },
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border, marginBottom: 10 },
  row: { flexDirection: "row", alignItems: "center" },
  name: { fontWeight: "700", color: colors.onSurface, fontSize: 15 },
  meta: { color: colors.muted, fontSize: 13, marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  actionRow: { flexDirection: "row", marginTop: 10, gap: 8 },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.brandTertiary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  actionText: { color: colors.onBrandTertiary, fontWeight: "600", fontSize: 13 },

  modalWrap: { flex: 1, justifyContent: "flex-end" },
  modalBackdrop: { ...({ position: "absolute" } as any), top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.4)" },
  modalCard: { backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalTitle: { fontSize: 17, fontWeight: "700", color: colors.onSurface, marginBottom: 10 },
  label: { fontSize: 12, color: colors.muted, marginTop: 10, marginBottom: 4, fontWeight: "600" },
  input: {
    backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, color: colors.onSurface, fontSize: 14,
  },
  rolePill: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary },
  error: { color: colors.error, marginTop: 12, fontSize: 13 },
  saveBtn: { marginTop: 16, backgroundColor: colors.brandPrimary, borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  saveBtnText: { color: colors.onBrandPrimary, fontWeight: "700" },
}));
