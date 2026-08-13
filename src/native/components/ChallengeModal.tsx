import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Challenge } from '../types';
import { colors, radius } from '../theme';

type Props = {
  challenge: Challenge;
  isJoined: boolean;
  isStarted: boolean;
  progressKm?: number;
  onClose: () => void;
  onRegister: (challenge: Challenge) => void;
  onLeave: (challenge: Challenge) => void;
  onStartRun: (challenge: Challenge) => void;
};

function formatCountdown(seconds: number) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days} өдөр ${hours} цаг ${minutes} мин`;
  return `${hours} цаг ${minutes} мин`;
}

export function ChallengeModal({ challenge, isJoined, isStarted, progressKm = 0, onClose, onRegister, onLeave, onStartRun }: Props) {
  const progressPercent = Math.min(100, Math.round((progressKm / challenge.goalKm) * 100));
  return (
    <Modal visible transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{challenge.title}</Text>
            <Pressable onPress={onClose}><Text style={styles.close}>×</Text></Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.countdown}>
              <Text style={styles.countLabel}>Бүртгэл дуусахад</Text>
              <Text style={styles.countValue}>{formatCountdown(challenge.registrationEndsInSeconds)}</Text>
            </View>

            <Text style={styles.sectionTitle}>Оролцогчид</Text>
            <Text style={styles.muted}>6+ гүйгч бүртгэлтэй</Text>

            <View style={styles.rules}>
              <Text style={styles.sectionTitle}>Чэллэнжийн журам</Text>
              <Text style={styles.rule}>• Зөвхөн апп-аар бүртгэсэн гүйлт тооцогдоно.</Text>
              <Text style={styles.rule}>• Гадаа GPS-тэй гүйсэн зайг автоматаар нэмнэ.</Text>
              <Text style={styles.rule}>• Нэг хэрэглэгч {challenge.group === '5k' ? '5 км' : '10 км'} ангиллаас нэг идэвхтэй чэлленж сонгон оролцоно.</Text>
              <Text style={styles.rule}>• Challenge дуусахаас өмнө {challenge.goalKm} км зорилгоо биелүүлнэ.</Text>
            </View>

            <View style={styles.progressHeader}>
              <Text style={styles.sectionTitle}>Таны явц</Text>
              <Text style={styles.percent}>{progressPercent}%</Text>
            </View>
            <View style={styles.progress}><View style={[styles.progressFill, { width: `${progressPercent}%` }]} /></View>
            <Text style={styles.progressText}>{progressKm.toFixed(2)} / {challenge.goalKm} км</Text>
          </ScrollView>

          <View style={styles.footer}>
            {!isJoined ? (
              <Pressable style={styles.primary} onPress={() => onRegister(challenge)}>
                <Text style={styles.primaryText}>Бүртгүүлэх</Text>
              </Pressable>
            ) : (
              <>
                <Pressable style={styles.secondary} onPress={() => onLeave(challenge)}><Text style={styles.secondaryText}>{progressPercent >= 100 ? 'Дуусгах' : 'Гарах'}</Text></Pressable>
                <Pressable style={[styles.primary, styles.registered]} onPress={() => onStartRun(challenge)}>
                  <Text style={styles.primaryText}>{isStarted ? 'Гүйлтээ үргэлжлүүлэх' : 'Гүйлт эхлүүлэх'}</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.65)' },
  sheet: { maxHeight: '88%', backgroundColor: colors.glassStrong, borderTopLeftRadius: 26, borderTopRightRadius: 26, borderWidth: 1, borderColor: colors.glassLine, overflow: 'hidden' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 22 },
  title: { color: colors.text, fontSize: 26, fontWeight: '900' },
  close: { color: colors.text, fontSize: 42, lineHeight: 42 },
  content: { paddingHorizontal: 22, paddingBottom: 12 },
  countdown: { backgroundColor: colors.glass, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.glassLine, padding: 14, alignItems: 'center', marginBottom: 18 },
  countLabel: { color: colors.muted, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  countValue: { color: colors.orange, fontSize: 22, fontWeight: '900', marginTop: 4 },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },
  muted: { color: colors.muted, marginTop: 6, marginBottom: 18 },
  rules: { borderWidth: 1, borderColor: colors.glassLine, backgroundColor: colors.glassLight, borderRadius: radius.md, padding: 14, gap: 8 },
  rule: { color: 'rgba(255,255,255,0.72)', fontSize: 13, lineHeight: 19 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 18, marginBottom: 8 },
  percent: { color: colors.green, fontWeight: '900' },
  progress: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.12)', overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.green },
  progressText: { color: colors.muted, fontSize: 12, textAlign: 'right', marginTop: 6 },
  footer: { flexDirection: 'row', gap: 12, padding: 18, borderTopWidth: 1, borderTopColor: colors.line },
  primary: { flex: 2, alignItems: 'center', borderRadius: radius.md, padding: 15, backgroundColor: colors.lime },
  registered: { backgroundColor: colors.green },
  primaryText: { color: '#000', fontSize: 16, fontWeight: '900' },
  secondary: { flex: 1, alignItems: 'center', borderRadius: radius.md, padding: 15, backgroundColor: '#f1f1f1' },
  secondaryText: { color: '#000', fontSize: 16, fontWeight: '800' }
});
