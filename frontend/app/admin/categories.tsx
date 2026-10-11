import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, Pressable, Modal, TextInput, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@react-native-vector-icons/feather";
import { makeStyles, useTheme } from "@/src/theme";
import { api } from "@/src/auth";

export default function CategoriesAdmin() {
  const router = useRouter();
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [cats, setCats] = useState<any[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState("");

  const load = useCallback(async () => {
    const data = await api<any[]>("/categories");
    setCats(data);
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!name.trim()) return;
    await api("/categories", { method: "POST", body: JSON.stringify({ name }) });
    setName("");
    setShowNew(false);
    await load();
  };

  const toggleActive = async (c: any) => {
    await api(`/categories/${c.id}`, { method: "PATCH", body: JSON.stringify({ active: !c.active }) });
    await load();
  };

  return (
    <View style={[styles.wrap, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable testID="back-button" onPress={() => router.back()} hitSlop={10}>
          <Feather name="arrow-left" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Service Categories</Text>
        <Pressable testID="add-category-button" onPress={() => setShowNew(true)} hitSlop={10}>
          <Feather name="plus-circle" size={24} color={colors.brandPrimary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {cats.map((c) => (
          <View key={c.id} testID={`cat-row-${c.id}`} style={styles.card}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{c.name}</Text>
              <Text style={styles.meta}>{c.active === false ? "Inactive" : "Active"}</Text>
            </View>
            <Pressable testID={`toggle-cat-${c.id}`} style={styles.toggle} onPress={() => toggleActive(c)}>
              <Feather name={c.active === false ? "eye" : "eye-off"} size={16} color={colors.brandPrimary} />
              <Text style={styles.toggleText}>{c.active === false ? "Activate" : "Deactivate"}</Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>

      <Modal visible={showNew} transparent animationType="slide" onRequestClose={() => setShowNew(false)}>
        <KeyboardAvoidingView style={styles.modalWrap} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <Pressable style={styles.modalBackdrop} onPress={() => setShowNew(false)} />
          <View style={[styles.modalCard, { paddingBottom: insets.bottom + 24 }]}>
            <Text style={styles.modalTitle}>New Category</Text>
            <TextInput testID="new-cat-name" style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Hood Cleaning" placeholderTextColor={colors.muted} />
            <Pressable testID="create-cat-button" style={styles.saveBtn} onPress={create}>
              <Text style={styles.saveBtnText}>Create</Text>
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
  card: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border, marginBottom: 10 },
  name: { fontWeight: "700", color: colors.onSurface, fontSize: 15 },
  meta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  toggle: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.brandTertiary, borderRadius: 10 },
  toggleText: { color: colors.onBrandTertiary, fontWeight: "600", fontSize: 13 },

  modalWrap: { flex: 1, justifyContent: "flex-end" },
  modalBackdrop: { ...({ position: "absolute" } as any), top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.4)" },
  modalCard: { backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalTitle: { fontSize: 17, fontWeight: "700", color: colors.onSurface, marginBottom: 12 },
  input: {
    backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 12, color: colors.onSurface, fontSize: 15,
  },
  saveBtn: { marginTop: 16, backgroundColor: colors.brandPrimary, borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  saveBtnText: { color: colors.onBrandPrimary, fontWeight: "700" },
}));
