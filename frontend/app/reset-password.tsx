import { useState } from "react";
import { View, Text, TextInput, Pressable } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { makeStyles, useTheme } from "@/src/theme";
import { api } from "@/src/auth";

export default function ResetPassword() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError("");
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    if (password !== confirm) { setError("Passwords do not match"); return; }
    setLoading(true);
    try {
      await api("/auth/reset-password", { method: "POST", body: JSON.stringify({ token, new_password: password }) });
      setSuccess(true);
      setTimeout(() => router.replace("/login"), 1500);
    } catch (e: any) {
      setError(e.message || "Reset failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 24 }]}>
      <View style={styles.body}>
        <Text style={styles.title}>Set new password</Text>
        {success ? (
          <Text testID="reset-success" style={styles.success}>Password updated. Redirecting to sign in...</Text>
        ) : (
          <>
            <Text style={styles.label}>New password</Text>
            <TextInput
              testID="reset-password-input"
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholderTextColor={colors.muted}
            />
            <Text style={styles.label}>Confirm password</Text>
            <TextInput
              testID="reset-confirm-input"
              style={styles.input}
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry
              placeholderTextColor={colors.muted}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable testID="reset-submit-button" onPress={submit} disabled={loading} style={[styles.btn, loading && { opacity: 0.5 }]}>
              <Text style={styles.btnText}>{loading ? "Saving..." : "Save password"}</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  wrap: { flex: 1, backgroundColor: colors.surface },
  body: { padding: 24 },
  title: { fontSize: 24, fontWeight: "700", color: colors.onSurface, marginBottom: 24 },
  label: { color: colors.onSurfaceSecondary, fontSize: 13, fontWeight: "600", marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 14, fontSize: 15, color: colors.onSurface,
  },
  error: { color: colors.error, marginTop: 12 },
  success: { color: colors.success, fontSize: 16, textAlign: "center" },
  btn: { marginTop: 24, backgroundColor: colors.brandPrimary, borderRadius: 12, paddingVertical: 16, alignItems: "center" },
  btnText: { color: colors.onBrandPrimary, fontSize: 16, fontWeight: "700" },
}));
