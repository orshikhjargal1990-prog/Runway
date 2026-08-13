import React, { useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { MediaItem } from '../types';
import { colors, radius } from '../theme';

type Props = {
  onCancel: () => void;
  onSave: (title: string, description: string, media: MediaItem[]) => Promise<void>;
};

export function PostComposer({ onCancel, onSave }: Props) {
  const [title, setTitle] = useState('Morning Run');
  const [description, setDescription] = useState('');
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await onSave(title.trim() || 'Гүйлт', description, media);
    } finally {
      setSaving(false);
    }
  };

  const pickMedia = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Зөвшөөрөл хэрэгтэй', 'Зураг/бичлэг нэмэхийн тулд media library зөвшөөрөл өгнө үү.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 1
    });

    if (result.canceled) return;
    setMedia(prev => [
      ...prev,
      ...result.assets.map((asset: ImagePicker.ImagePickerAsset) => ({
        id: `${asset.uri}-${Date.now()}`,
        uri: asset.uri,
        type: asset.type === 'video' ? 'video' as const : 'image' as const
      }))
    ]);
  };

  return (
    <Modal visible animationType="slide">
      <View style={styles.root}>
        <View style={styles.header}>
          <Pressable onPress={onCancel}><Text style={styles.cancel}>Болих</Text></Pressable>
          <Text style={styles.heading}>Нийтлэл үүсгэх</Text>
          <Pressable disabled={saving} onPress={save}>
            <Text style={[styles.save, saving && styles.saveDisabled]}>{saving ? 'Хадгалж байна...' : 'Хадгалах'}</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.label}>Гарчиг</Text>
          <TextInput value={title} onChangeText={setTitle} style={styles.input} placeholderTextColor={colors.muted} />

          <Text style={styles.label}>Тайлбар</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            style={[styles.input, styles.textarea]}
            multiline
            placeholder="Гүйлт хэрхэн явсан бэ?"
            placeholderTextColor={colors.muted}
          />

          <Pressable onPress={pickMedia} style={styles.addButton}>
            <Text style={styles.addText}>Зураг / бичлэг нэмэх</Text>
          </Pressable>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mediaRow}>
            {media.map(item => (
              <View key={item.id} style={styles.thumbWrap}>
                {item.type === 'image' ? (
                  <Image source={{ uri: item.uri }} style={styles.thumb} />
                ) : (
                  <View style={[styles.thumb, styles.videoThumb]}><Text style={styles.videoText}>▶</Text></View>
                )}
              </View>
            ))}
          </ScrollView>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 54, paddingHorizontal: 18, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: colors.line },
  heading: { color: colors.text, fontSize: 16, fontWeight: '900' },
  cancel: { color: colors.muted, fontWeight: '800' },
  save: { color: colors.orange, fontWeight: '900' },
  saveDisabled: { opacity: 0.55 },
  content: { padding: 18, gap: 12 },
  label: { color: colors.muted, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  input: { backgroundColor: colors.panel, color: colors.text, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, borderWidth: 1, borderColor: colors.line },
  textarea: { minHeight: 110, textAlignVertical: 'top' },
  addButton: { borderRadius: radius.md, borderWidth: 1, borderColor: colors.orange, padding: 16, alignItems: 'center', backgroundColor: 'rgba(255,107,44,0.12)' },
  addText: { color: colors.orange, fontWeight: '900' },
  mediaRow: { marginTop: 6 },
  thumbWrap: { marginRight: 10 },
  thumb: { width: 110, height: 110, borderRadius: radius.md, backgroundColor: '#000' },
  videoThumb: { alignItems: 'center', justifyContent: 'center' },
  videoText: { color: colors.text, fontSize: 28 }
});
