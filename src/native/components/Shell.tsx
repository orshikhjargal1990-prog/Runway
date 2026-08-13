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
  { key: 'run', label: 'Гүйх', icon: '⌁' },
  { key: 'explore', label: 'Routes', icon: '◇' },
  { key: 'profile', label: 'Профайл', icon: '○' }
];

export function Shell({ activeTab, onTabChange, children }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <View style={styles.content}>{children}</View>
      <View style={styles.tabs}>
        <BlurView intensity={58} tint="dark" style={[styles.tabGlass, { paddingBottom: Math.max(insets.bottom, 10) }]}> 
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
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    backgroundColor: 'rgba(36,46,53,0.18)',
    shadowColor: '#000',
    shadowOpacity: 0.32,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -10 }
  },
  tabGlass: {
    flexDirection: 'row',
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: 'rgba(30,40,47,0.48)',
    paddingTop: 10,
    paddingHorizontal: 10
  },
  tab: { flex: 1, alignItems: 'center', gap: 3 },
  iconWrap: { width: 34, height: 25, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  activeIconWrap: { backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.38)', shadowColor: '#ffffff', shadowOpacity: 0.2, shadowRadius: 12 },
  icon: { color: colors.subtle, fontSize: 20, fontWeight: '900' },
  label: { color: colors.subtle, fontSize: 10, fontWeight: '800' },
  active: { color: colors.accent }
});
