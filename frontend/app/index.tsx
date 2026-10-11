import { useEffect } from "react";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/auth";
import { LoadingView } from "@/src/components/loading";

export default function Index() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (user) router.replace("/(tabs)");
    else router.replace("/login");
  }, [user, loading, router]);

  return <LoadingView />;
}
