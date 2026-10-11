import React, { useRef, useState } from "react";
import { View, Text, Pressable, Modal } from "react-native";
import SignatureScreen, { SignatureViewRef } from "react-native-signature-canvas";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { makeStyles } from "@/src/theme";

type Props = {
  visible: boolean;
  onCancel: () => void;
  onConfirm: (signatureBase64: string) => void;
};

const WEB_STYLE = `
.m-signature-pad { box-shadow: none; border: none; }
.m-signature-pad--body { border: 1px dashed #CBD5E1; border-radius: 12px; }
.m-signature-pad--footer { display: none; margin: 0; }
body, html { background: transparent; }
`;

export function SignaturePad({ visible, onCancel, onConfirm }: Props) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const ref = useRef<SignatureViewRef>(null);
  const [empty, setEmpty] = useState(true);

  const handleOK = (sig: string) => {
    onConfirm(sig);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={styles.wrap}>
        <Pressable style={styles.backdrop} onPress={onCancel} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.header}>
            <Pressable testID="sig-cancel" onPress={onCancel} hitSlop={10}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Text style={styles.title}>Customer signature</Text>
            <View style={{ width: 60 }} />
          </View>

          <Text style={styles.hint}>Have the customer sign below to confirm job completion.</Text>

          <View style={styles.canvasWrap}>
            <SignatureScreen
              ref={ref}
              onOK={handleOK}
              onEmpty={() => setEmpty(true)}
              onBegin={() => setEmpty(false)}
              webStyle={WEB_STYLE}
              descriptionText=""
              backgroundColor="#F4F6F8"
              penColor="#0F172A"
            />
          </View>

          <View style={styles.actions}>
            <Pressable
              testID="sig-clear"
              style={styles.btnSecondary}
              onPress={() => { ref.current?.clearSignature(); setEmpty(true); }}
            >
              <Text style={styles.btnSecondaryText}>Clear</Text>
            </Pressable>
            <Pressable
              testID="sig-save"
              style={[styles.btnPrimary, empty && { opacity: 0.5 }]}
              onPress={() => ref.current?.readSignature()}
              disabled={empty}
            >
              <Text style={styles.btnPrimaryText}>Save & Complete</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((colors) => ({
  wrap: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...({ position: "absolute" } as any), top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 12 },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  title: { fontSize: 16, fontWeight: "700", color: colors.onSurface },
  cancelText: { color: colors.muted, fontSize: 15 },
  hint: { color: colors.muted, fontSize: 13, paddingHorizontal: 20, marginTop: 12 },
  canvasWrap: {
    height: 260, margin: 16, borderRadius: 12, overflow: "hidden",
    backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border,
  },
  actions: { flexDirection: "row", gap: 10, paddingHorizontal: 16 },
  btnSecondary: {
    flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: 12, paddingVertical: 14,
    alignItems: "center", borderWidth: 1, borderColor: colors.border,
  },
  btnSecondaryText: { color: colors.onSurfaceSecondary, fontWeight: "700" },
  btnPrimary: { flex: 2, backgroundColor: colors.brandPrimary, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  btnPrimaryText: { color: colors.onBrandPrimary, fontWeight: "700", fontSize: 15 },
}));
