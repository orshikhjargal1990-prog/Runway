import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import type { TabKey } from '../types';
import { colors } from '../theme';

type Props = {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  children: React.ReactNode;
};

const tabs: { key: TabKey; label: string; icon: string }[] = [
  { key: 'home', label: 'Нүүр', icon: '⌂' },
  { key: 'run', label: 'Гүйлт', icon: '⌁' },
  { key: 'explore', label: 'Shop', icon: '◈' },
  { key: 'profile', label: 'Профайл', icon: '○' }
];

export function Shell({ activeTab, onTabChange, children }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <View style={styles.content}>{children}</View>
      <View style={[styles.tabs, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <BlurView intensity={72} tint="dark" style={styles.tabGlass}>
          {tabs.map(tab => {
            const active = tab.key === activeTab;
            return (
              <Pressable key={tab.key} style={styles.tab} onPress={() => onTabChange(tab.key)}>
                <View style={[styles.iconWrap, active && styles.activeIconWrap]}>
                  <Text style={[styles.icon, active && styles.active]}>{tab.icon}</Text>
                </View>
                <Text style={[styles.label, active && styles.active]}>{tab.label}</Text>
              </Pressable>
            );
          })}
        </BlurView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0, backgroundColor: colors.bg, overflow: 'hidden' },
  content: { flex: 1, minHeight: 0, overflow: 'hidden' },
  tabs: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 0,
    backgroundColor: 'transparent',
    shadowColor: '#000',
    shadowOpacity: 0.38,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 }
  },
  tabGlass: {
    flexDirection: 'row',
    minHeight: 64,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: 'rgba(8,18,24,0.82)',
    paddingTop: 8,
    paddingHorizontal: 8,
    paddingBottom: 8
  },
  tab: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', gap: 3, borderRadius: 18 },
  iconWrap: { width: 38, height: 27, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  activeIconWrap: { backgroundColor: 'rgba(168,255,24,0.16)', borderWidth: 1, borderColor: 'rgba(168,255,24,0.5)', shadowColor: colors.accent, shadowOpacity: 0.32, shadowRadius: 12 },
  icon: { color: 'rgba(219,232,237,0.62)', fontSize: 19, fontWeight: '900' },
  label: { color: 'rgba(219,232,237,0.62)', fontSize: 9, fontWeight: '900' },
  active: { color: colors.accent }
});
