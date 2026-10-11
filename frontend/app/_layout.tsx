import { QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import { LogBox, Platform } from "react-native";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import * as Linking from "expo-linking";
import { useEffect } from "react";

import { ErrorBoundary } from "@/src/components/error-boundary";
import { queryClient } from "@/src/query-client";
import { AuthProvider, useAuth, api } from "@/src/auth";

LogBox.ignoreAllLogs(true);

// Module-scope: Notification handler (native only)
if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    } as any),
  });
}

if (Platform.OS === "android") {
  Notifications.setNotificationChannelAsync("default", {
    name: "Default",
    importance: Notifications.AndroidImportance.MAX,
    sound: "default",
  });
}

function RootNav() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === "(auth)" || segments[0] === "login" || segments[0] === "forgot-password" || segments[0] === "reset-password";
    if (!user && !inAuthGroup) router.replace("/login");
    else if (user && inAuthGroup) router.replace("/(tabs)");
  }, [user, loading, segments, router]);

  // Push registration + tap listeners
  useEffect(() => {
    if (Platform.OS === "web" || !user) return;

    (async () => {
      try {
        const perm = await Notifications.requestPermissionsAsync();
        if (perm.status !== "granted") return;
        const tok = await Notifications.getDevicePushTokenAsync();
        await api("/register-push", {
          method: "POST",
          body: JSON.stringify({ platform: Platform.OS, device_token: tok.data }),
        });
      } catch (e) {
        console.log("push register failed", e);
      }
    })();

    const tapSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as any;
      const url = data?.deeplink || data?.action_url;
      if (!url) return;
      if (url.startsWith("http")) Linking.openURL(url);
      else router.push(url);
    });

    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      const data = response.notification.request.content.data as any;
      const url = data?.deeplink || data?.action_url;
      if (url) {
        if (url.startsWith("http")) Linking.openURL(url);
        else router.push(url);
      }
    });

    return () => tapSub.remove();
  }, [user, router]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="reset-password" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="job/[id]" options={{ presentation: "card" }} />
      <Stack.Screen name="job/new" options={{ presentation: "modal" }} />
      <Stack.Screen name="customer/[id]" />
      <Stack.Screen name="customer/new" options={{ presentation: "modal" }} />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="change-password" />
      <Stack.Screen name="admin/users" />
      <Stack.Screen name="admin/categories" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <KeyboardProvider>
            <AuthProvider>
              <StatusBar style="dark" />
              <RootNav />
            </AuthProvider>
          </KeyboardProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
