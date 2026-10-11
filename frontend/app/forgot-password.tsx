import { useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@react-native-vector-icons/feather";
import { makeStyles, useTheme } from "@/src/theme";
import { api } from "@/src/auth";

export default function ForgotPassword() {
  const router = useRouter();
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    try {
      await api("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email: email.trim().toLowerCase() }) });
      setSent(true);
    } catch {}
    setLoading(false);
  };

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Pressable testID="back-button" onPress={() => router.back()} hitSlop={10}>
          <Feather name="arrow-left" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Forgot password</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {sent ? (
          <View testID="forgot-sent-state">
            <Text style={styles.title}>Check your email</Text>
            <Text style={styles.body2}>If an account exists for {email}, we've sent a password reset link that expires in 60 minutes.</Text>
            <Pressable testID="back-to-login" onPress={() => router.replace("/login")} style={styles.btn}>
              <Text style={styles.btnText}>Back to sign in</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Text style={styles.title}>Reset your password</Text>
            <Text style={styles.body2}>Enter your email and we'll send you a secure link to set a new password.</Text>
            <Text style={styles.label}>Email</Text>
            <TextInput
              testID="forgot-email-input"
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="you@kgvac.com"
              placeholderTextColor={colors.muted}
            />
            <Pressable
              testID="forgot-submit-button"
              onPress={submit}
              disabled={!email || loading}
              style={[styles.btn, (!email || loading) && { opacity: 0.5 }]}
            >
              <Text style={styles.btnText}>{loading ? "Sending..." : "Send reset link"}</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  wrap: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", gap: 16, paddingHorizontal: 20, paddingBottom: 16 },
  headerTitle: { fontSize: 18, fontWeight: "700", color: colors.onSurface },
  body: { padding: 24 },
  title: { fontSize: 22, fontWeight: "700", color: colors.onSurface, marginBottom: 8 },
  body2: { color: colors.muted, fontSize: 14, marginBottom: 24, lineHeight: 20 },
  label: { color: colors.onSurfaceSecondary, fontSize: 13, fontWeight: "600", marginBottom: 6 },
  input: {
    backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 14, fontSize: 15, color: colors.onSurface, marginBottom: 24,
  },
  btn: { backgroundColor: colors.brandPrimary, borderRadius: 12, paddingVertical: 16, alignItems: "center" },
  btnText: { color: colors.onBrandPrimary, fontSize: 16, fontWeight: "700" },
}));
