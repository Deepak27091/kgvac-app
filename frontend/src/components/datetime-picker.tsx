import React, { useState } from "react";
import { View, Text, Pressable, ScrollView, Modal } from "react-native";
import { Calendar } from "react-native-calendars";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { makeStyles, useTheme } from "@/src/theme";

type Props = {
  visible: boolean;
  initialDate?: string;
  initialTime?: string;
  minDate?: string;
  title?: string;
  onCancel: () => void;
  onConfirm: (date: string, time: string) => void;
};

// 15-minute slots from 06:00 to 20:00
const TIME_SLOTS: string[] = (() => {
  const arr: string[] = [];
  for (let h = 6; h <= 20; h++) {
    for (const m of [0, 15, 30, 45]) {
      if (h === 20 && m > 0) continue;
      arr.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return arr;
})();

export function DateTimePickerSheet({ visible, initialDate, initialTime, minDate, title, onCancel, onConfirm }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(initialDate || today);
  const [time, setTime] = useState(initialTime || "09:00");

  React.useEffect(() => {
    if (visible) {
      setDate(initialDate || today);
      setTime(initialTime || "09:00");
    }
  }, [visible, initialDate, initialTime, today]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={styles.wrap}>
        <Pressable style={styles.backdrop} onPress={onCancel} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.header}>
            <Pressable testID="picker-cancel" onPress={onCancel} hitSlop={10}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Text style={styles.title}>{title || "Select date & time"}</Text>
            <Pressable
              testID="picker-confirm"
              onPress={() => onConfirm(date, time)}
              hitSlop={10}
            >
              <Text style={styles.confirmText}>Done</Text>
            </Pressable>
          </View>

          <Calendar
            testID="picker-calendar"
            current={date}
            minDate={minDate}
            onDayPress={(d: any) => setDate(d.dateString)}
            markedDates={{ [date]: { selected: true, selectedColor: colors.brandPrimary } }}
            theme={{
              backgroundColor: colors.surface,
              calendarBackground: colors.surface,
              selectedDayBackgroundColor: colors.brandPrimary,
              todayTextColor: colors.brandPrimary,
              arrowColor: colors.brandPrimary,
              monthTextColor: colors.onSurface,
              dayTextColor: colors.onSurface,
              textSectionTitleColor: colors.muted,
            }}
          />

          <View style={styles.timeSection}>
            <Text style={styles.timeLabel}>Time — {time}</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
              style={{ maxHeight: 48 }}
            >
              {TIME_SLOTS.map((t) => (
                <Pressable
                  key={t}
                  testID={`time-slot-${t}`}
                  style={[styles.timeChip, time === t && styles.timeChipActive]}
                  onPress={() => setTime(t)}
                >
                  <Text style={[styles.timeChipText, time === t && styles.timeChipTextActive]}>{t}</Text>
                </Pressable>
              ))}
            </ScrollView>
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
  confirmText: { color: colors.brandPrimary, fontSize: 15, fontWeight: "700" },
  timeSection: { paddingTop: 12 },
  timeLabel: { color: colors.onSurfaceSecondary, fontSize: 13, fontWeight: "600", paddingHorizontal: 20, marginBottom: 8 },
  timeChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1,
    borderColor: colors.border, backgroundColor: colors.surfaceSecondary, flexShrink: 0,
    height: 36, justifyContent: "center",
  },
  timeChipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  timeChipText: { color: colors.onSurfaceSecondary, fontWeight: "600", fontSize: 13 },
  timeChipTextActive: { color: colors.onBrandPrimary },
}));
