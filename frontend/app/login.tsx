import { useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, Image, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter, Link } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { makeStyles, useTheme } from "@/src/theme";
import { useAuth } from "@/src/auth";

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useStyles();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      router.replace("/(tabs)");
    } catch (e: any) {
      setError(e.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.wrap} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <View style={styles.heroOverlay} />
          <View style={styles.heroInner}>
            <Text style={styles.brand}>KG Vac Service</Text>
            <Text style={styles.subtitle}>Job Manager</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Sign in</Text>
          <Text style={styles.hint}>Internal access only. Use your assigned credentials.</Text>

          <Text style={styles.label}>Email</Text>
          <TextInput
            testID="login-email-input"
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="you@kgvac.com"
            placeholderTextColor={colors.muted}
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            testID="login-password-input"
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="••••••••"
            placeholderTextColor={colors.muted}
          />

          {error ? <Text testID="login-error" style={styles.error}>{error}</Text> : null}

          <Link href="/forgot-password" asChild>
            <Pressable testID="forgot-password-link" style={styles.forgot}>
              <Text style={styles.forgotText}>Forgot password?</Text>
            </Pressable>
          </Link>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Pressable
          testID="login-submit-button"
          onPress={submit}
          disabled={loading || !email || !password}
          style={({ pressed }) => [
            styles.btn,
            (loading || !email || !password) && styles.btnDisabled,
            pressed && styles.btnPressed,
          ]}
        >
          <Text style={styles.btnText}>{loading ? "Signing in..." : "Sign In"}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles((colors) => ({
  wrap: { flex: 1, backgroundColor: colors.surface },
  scroll: { paddingBottom: 100 },
  hero: {
    height: 200,
    backgroundColor: colors.brandPrimary,
    overflow: "hidden",
    marginBottom: 24,
  },
  heroOverlay: { ...({ position: "absolute" } as any), top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.brandPrimary, opacity: 0.9 },
  heroInner: { flex: 1, justifyContent: "flex-end", padding: 24 },
  brand: { color: colors.onBrand, fontSize: 28, fontWeight: "800" },
  subtitle: { color: colors.onBrand, fontSize: 16, opacity: 0.9, marginTop: 4 },
  card: { paddingHorizontal: 24 },
  title: { fontSize: 24, fontWeight: "700", color: colors.onSurface, marginBottom: 8 },
  hint: { color: colors.muted, fontSize: 14, marginBottom: 24 },
  label: { color: colors.onSurfaceSecondary, fontSize: 13, fontWeight: "600", marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    color: colors.onSurface,
  },
  error: { color: colors.error, marginTop: 12, fontSize: 13 },
  forgot: { marginTop: 16, alignSelf: "flex-start" },
  forgotText: { color: colors.brandPrimary, fontWeight: "600", fontSize: 14 },
  footer: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    paddingHorizontal: 24, paddingTop: 12,
    backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.divider,
  },
  btn: {
    backgroundColor: colors.brandPrimary, borderRadius: 12, paddingVertical: 16, alignItems: "center",
  },
  btnDisabled: { opacity: 0.5 },
  btnPressed: { opacity: 0.85 },
  btnText: { color: colors.onBrandPrimary, fontSize: 16, fontWeight: "700" },
}));
