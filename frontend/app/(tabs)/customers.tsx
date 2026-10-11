import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, Pressable, TextInput, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@react-native-vector-icons/feather";
import { makeStyles, useTheme } from "@/src/theme";
import { api, useAuth } from "@/src/auth";

export default function CustomersScreen() {
  const router = useRouter();
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [list, setList] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<any[]>(`/customers${q ? `?q=${encodeURIComponent(q)}` : ""}`);
      setList(data);
    } finally { setLoading(false); }
  }, [q]);

  useEffect(() => { load(); }, [load]);

  if (user?.role !== "admin") {
    return (
      <View style={[styles.wrap, { paddingTop: insets.top }]}>
        <Text style={styles.title}>Not authorized</Text>
      </View>
    );
  }

  return (
    <View style={[styles.wrap, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Customers</Text>
        <Pressable testID="add-customer-button" onPress={() => router.push("/customer/new")}>
          <Feather name="plus-circle" size={26} color={colors.brandPrimary} />
        </Pressable>
      </View>

      <View style={styles.searchRow}>
        <Feather name="search" size={16} color={colors.muted} style={{ marginLeft: 12 }} />
        <TextInput
          testID="customers-search-input"
          style={styles.search}
          value={q}
          onChangeText={setQ}
          onSubmitEditing={load}
          placeholder="Search by name, company, phone..."
          placeholderTextColor={colors.muted}
          returnKeyType="search"
        />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
      >
        {list.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="users" size={32} color={colors.muted} />
            <Text style={styles.emptyText}>No customers yet</Text>
          </View>
        ) : (
          list.map((c) => (
            <Pressable
              key={c.id}
              testID={`customer-row-${c.id}`}
              style={styles.card}
              onPress={() => router.push(`/customer/${c.id}`)}
            >
              <Text style={styles.cardTitle}>{c.company || c.name}</Text>
              {c.company ? <Text style={styles.cardMeta}>{c.name}</Text> : null}
              {c.phone ? <Text style={styles.cardMeta}>{c.phone}</Text> : null}
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  wrap: { flex: 1, backgroundColor: colors.surfaceSecondary },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingVertical: 14, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  title: { fontSize: 20, fontWeight: "700", color: colors.onSurface },
  searchRow: {
    flexDirection: "row", alignItems: "center", backgroundColor: colors.surface,
    marginHorizontal: 16, marginTop: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border,
  },
  search: { flex: 1, paddingVertical: 12, paddingHorizontal: 10, color: colors.onSurface, fontSize: 14 },
  card: {
    backgroundColor: colors.surface, padding: 14, borderRadius: 12, marginBottom: 10,
    borderWidth: 1, borderColor: colors.border,
  },
  cardTitle: { fontSize: 15, fontWeight: "700", color: colors.onSurface },
  cardMeta: { color: colors.muted, fontSize: 13, marginTop: 2 },
  empty: { padding: 48, alignItems: "center" },
  emptyText: { color: colors.muted, marginTop: 8 },
}));
