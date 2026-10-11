import { useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@react-native-vector-icons/feather";
import { makeStyles, useTheme } from "@/src/theme";
import { api, useAuth } from "@/src/auth";

export default function ChangePassword() {
  const router = useRouter();
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { logout } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError("");
    if (next.length < 6) { setError("Password must be at least 6 characters"); return; }
    if (next !== confirm) { setError("Passwords do not match"); return; }
    setLoading(true);
    try {
      await api("/auth/change-password", { method: "POST", body: JSON.stringify({ current_password: current, new_password: next }) });
      setSuccess(true);
      setTimeout(logout, 1500);
    } catch (e: any) {
      setError(e.message);
    } finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView style={styles.wrap} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable testID="back-button" onPress={() => router.back()} hitSlop={10}>
          <Feather name="arrow-left" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Change password</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        {success ? (
          <Text testID="change-pw-success" style={styles.success}>Password updated. Signing out...</Text>
        ) : (
          <>
            <Text style={styles.label}>Current password</Text>
            <TextInput testID="current-password" style={styles.input} value={current} onChangeText={setCurrent} secureTextEntry placeholderTextColor={colors.muted} />
            <Text style={styles.label}>New password</Text>
            <TextInput testID="new-password" style={styles.input} value={next} onChangeText={setNext} secureTextEntry placeholderTextColor={colors.muted} />
            <Text style={styles.label}>Confirm new password</Text>
            <TextInput testID="confirm-password" style={styles.input} value={confirm} onChangeText={setConfirm} secureTextEntry placeholderTextColor={colors.muted} />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable testID="submit-change-pw" style={[styles.btn, loading && { opacity: 0.5 }]} onPress={submit} disabled={loading}>
              <Text style={styles.btnText}>{loading ? "Saving..." : "Update password"}</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles((colors) => ({
  wrap: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", gap: 16, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.divider },
  headerTitle: { fontSize: 17, fontWeight: "700", color: colors.onSurface },
  label: { color: colors.onSurfaceSecondary, fontSize: 13, fontWeight: "600", marginTop: 14, marginBottom: 6 },
  input: {
    backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 12, color: colors.onSurface, fontSize: 15,
  },
  error: { color: colors.error, marginTop: 12 },
  success: { color: colors.success, fontSize: 15, textAlign: "center", marginTop: 20 },
  btn: { marginTop: 24, backgroundColor: colors.brandPrimary, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  btnText: { color: colors.onBrandPrimary, fontWeight: "700", fontSize: 16 },
}));
