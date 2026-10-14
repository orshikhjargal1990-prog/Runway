import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { DEFAULT_MARATHON_REGISTRATION_CATEGORIES } from '../marathonRegistration';
import type { Challenge, MarathonRegistrationCategoryId } from '../types';
import { colors, radius } from '../theme';

type Props = {
  challenge: Challenge;
  isJoined: boolean;
  isStarted: boolean;
  progressKm?: number;
  notice?: { title: string; message: string } | null;
  onNoticeClose?: () => void;
  onClose: () => void;
  onRegister: (challenge: Challenge) => void;
  onLeave: (challenge: Challenge) => void;
  onStartRun: (challenge: Challenge) => void;
};

const marathonRegistrationTypes = [
  { id: 'onsite', title: 'Биеэр оролцох', meta: 'Старт дээр ирж дугаараа аваад event өдөр гүйнэ.' },
  { id: 'virtual', title: 'Цахимаар гүйх', meta: 'Event өдөр өөрийн маршрутаар GPS гүйлтээ баталгаажуулна.' }
];

function formatCountdown(seconds: number) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days} өдөр ${hours} цаг ${minutes} мин`;
  return `${hours} цаг ${minutes} мин`;
}

function getChallengeGroupLabel(group: Challenge['group']) {
  if (group === '5k') return '5 км';
  if (group === '10k') return '10 км';
  return 'Холын зайн марафон';
}

function isSingleRunChallenge(challenge: Challenge) {
  return challenge.completionMode === 'single_run' || (!challenge.completionMode && challenge.group === '5k');
}

export function ChallengeModal({ challenge, isJoined, isStarted, progressKm = 0, notice, onNoticeClose, onClose, onRegister, onLeave, onStartRun }: Props) {
  const isMarathon = challenge.group === 'marathon';
  const singleRunChallenge = isSingleRunChallenge(challenge);
  const progressPercent = Math.min(100, Math.round((progressKm / challenge.goalKm) * 100));
  const marathonCategories = useMemo(
    () => (challenge.marathonRegistrationCategories?.length ? challenge.marathonRegistrationCategories : DEFAULT_MARATHON_REGISTRATION_CATEGORIES)
      .filter(category => category.enabled)
      .map(category => ({ ...category, options: category.options.filter(option => option.enabled !== false) }))
      .filter(category => category.options.length > 0),
    [challenge.marathonRegistrationCategories]
  );
  const firstCategory = marathonCategories[0] ?? DEFAULT_MARATHON_REGISTRATION_CATEGORIES[0];
  const [showMarathonTypes, setShowMarathonTypes] = useState(false);
  const [showMarathonCategories, setShowMarathonCategories] = useState(false);
  const [selectedMarathonType, setSelectedMarathonType] = useState(marathonRegistrationTypes[0].id);
  const [selectedParticipantCategory, setSelectedParticipantCategory] = useState<MarathonRegistrationCategoryId>(firstCategory.id);
  const [selectedMarathonOption, setSelectedMarathonOption] = useState(firstCategory.options[0]?.id ?? '');
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [showFiveKStartNotice, setShowFiveKStartNotice] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const previewScrollRef = useRef<ScrollView>(null);
  const { width } = useWindowDimensions();
  const galleryImages = useMemo(() => {
    if (!isMarathon) return [];
    return challenge.galleryImages?.length ? challenge.galleryImages : [challenge.image];
  }, [challenge.galleryImages, challenge.image, isMarathon]);
  const groupLabel = getChallengeGroupLabel(challenge.group);
  const detailDescription = challenge.description ?? `${challenge.org}-ийн зохион байгуулж буй ${groupLabel} challenge. ${singleRunChallenge ? 'Зорилгоо нэг удаагийн баталгаажсан гүйлтээр дуусгана.' : 'Зорилгоо биелүүлэхийн тулд апп-аар бүртгэсэн гүйлтүүдээ тогтмол нэмнэ.'}`;
  const organizerInfo = challenge.organizerInfo ?? `${challenge.org} энэхүү challenge-ийг оролцогчдын идэвх, эрүүл амьдралын хэв маягийг дэмжих зорилгоор зохион байгуулж байна.`;
  const rewardTitle = challenge.reward ?? `${challenge.goalKm} км зорилго`;
  const rewardInfo = challenge.rewardInfo ?? (singleRunChallenge
    ? `${challenge.goalKm} км зорилгоо нэг удаагийн гүйлтээр биелүүлсэн оролцогчдын гүйцэтгэл leaderboard болон profile ахиц дээр бүртгэгдэнэ.`
    : `${challenge.goalKm} км зорилгоо биелүүлсэн оролцогчдын гүйцэтгэл leaderboard болон profile ахиц дээр бүртгэгдэнэ.`);
  const registrationInfo = challenge.registrationInfo ?? `Бүртгэл дуусахаас өмнө challenge-д нэгдээд гүйлтээ эхлүүлнэ.`;

  useEffect(() => {
    if (previewIndex === null) return;
    requestAnimationFrame(() => {
      previewScrollRef.current?.scrollTo({ x: width * previewIndex, animated: false });
    });
  }, [previewIndex, width]);

  const register = () => {
    if (isMarathon && !showMarathonTypes) {
      setShowMarathonTypes(true);
      return;
    }
    if (isMarathon && !showMarathonCategories) {
      setShowMarathonCategories(true);
      return;
    }
    onRegister(challenge);
  };

  const startRun = () => {
    if (singleRunChallenge) {
      setShowFiveKStartNotice(true);
      return;
    }
    onStartRun(challenge);
  };

  const selectParticipantCategory = (categoryId: MarathonRegistrationCategoryId) => {
    setSelectedParticipantCategory(categoryId);
    setSelectedMarathonOption(marathonCategories.find(category => category.id === categoryId)?.options[0]?.id ?? '');
  };
  const selectedCategoryOptions = marathonCategories.find(category => category.id === selectedParticipantCategory)?.options ?? firstCategory.options;
  const fiveKStartNotice = showFiveKStartNotice ? {
    title: 'Анхаарна уу',
    message: `Та ${challenge.goalKm} км зорилгыг нэг гүйлтээр дуусгах ёстойг анхаарна уу. Гүйлт хэмжээндээ хүрэлгүй дуусах тохиолдолд чэллэнж тооцохгүй бөгөөд таны гүйлт ерөнхий мэдээлэлд нэмэгдэх болно.`
  } : null;
  const activeNotice = notice ?? fiveKStartNotice;

  return (
    <Modal visible transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{challenge.title}</Text>
            <Pressable onPress={onClose}><Text style={styles.close}>×</Text></Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.challengeMedia}>
              <Image source={{ uri: challenge.image }} style={styles.coverImage} resizeMode="cover" />
              <View style={styles.coverScrim} />
              <View style={styles.coverBadge}>
                <Text style={styles.coverBadgeText}>{isMarathon ? 'ONE DAY EVENT' : `${groupLabel} CHALLENGE`}</Text>
              </View>
              <View style={styles.coverMeta}>
                <Text style={styles.coverOrg}>{challenge.org}</Text>
                <Text style={styles.coverGoal}>{challenge.goalKm} км зорилго</Text>
              </View>
            </View>

            <View style={styles.countdown}>
              <Text style={styles.countLabel}>Бүртгэл дуусахад</Text>
              <Text style={styles.countValue}>{formatCountdown(challenge.registrationEndsInSeconds)}</Text>
            </View>

            <View style={styles.descriptionCard}>
              <Text style={styles.sectionTitle}>Эвентийн тайлбар</Text>
              <Text style={styles.descriptionText}>{detailDescription}</Text>
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>Зохион байгуулагч</Text>
              <Text style={styles.infoTitle}>{challenge.org}</Text>
              <Text style={styles.infoText}>{organizerInfo}</Text>
            </View>

            <View style={styles.rewardInfoCard}>
              <Text style={styles.rewardInfoLabel}>Шагнал урамшуулал</Text>
              <Text style={styles.rewardInfoTitle}>{rewardTitle}</Text>
              <Text style={styles.rewardInfoText}>{rewardInfo}</Text>
            </View>

            <View style={styles.registrationCard}>
              <Text style={styles.registrationLabel}>Бүртгэлийн мэдээлэл</Text>
              <Text style={styles.registrationText}>{registrationInfo}</Text>
            </View>

            {isMarathon ? (
              <>
                <View style={styles.galleryHeader}>
                  <Text style={styles.sectionTitle}>Галлерей</Text>
                  <Text style={styles.galleryCount}>{galleryImages.length} зураг</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.galleryRow}>
                  {galleryImages.map((image, index) => (
                    <Pressable key={`${image}-${index}`} onPress={() => setPreviewIndex(index)}>
                      <Image source={{ uri: image }} style={styles.galleryImage} />
                    </Pressable>
                  ))}
                </ScrollView>
              </>
            ) : null}

            <Text style={styles.sectionTitle}>Оролцогчид</Text>
            <Text style={styles.muted}>6+ гүйгч бүртгэлтэй</Text>

            <View style={styles.rules}>
              <Text style={styles.sectionTitle}>{isMarathon ? 'Марафоны журам' : 'Чэллэнжийн журам'}</Text>
              {isMarathon ? (
                <>
                  <Text style={styles.rule}>• Оролцогч сонгосон ангиллынхаа албан ёсны зайг event-ийн өдөр тасралтгүй гүйж дуусгана.</Text>
                  <Text style={styles.rule}>• Биеэр оролцогч бүр стартын өмнө bib дугаар, timing chip-ээ авч, заасан corral-аас гараанд гарна.</Text>
                  <Text style={styles.rule}>• Албан ёсны маршрут, checkpoint, эргэлтийн цэг, finish line-ийг бүрэн дайрч өнгөрөх ёстой; зам товчлох, бусдаар гүйлгүүлэхийг хориглоно.</Text>
                  <Text style={styles.rule}>• Цагийн хязгаар, cutoff болон зохион байгуулагчийн аюулгүй байдлын зааврыг мөрдөнө.</Text>
                  <Text style={styles.rule}>• Цахим оролцогч event-ийн өдөр GPS бичлэгээр зай, хугацаа, маршрутаа баталгаажуулна.</Text>
                  <Text style={styles.rule}>• Дүрэм зөрчсөн, буруу мэдээлэл илгээсэн, эсвэл timing/checkpoint баталгаажуулалт дутуу бол үр дүн хүчингүй болно.</Text>
                </>
              ) : (
                <>
                  <Text style={styles.rule}>• Зөвхөн апп-аар бүртгэсэн гүйлт тооцогдоно.</Text>
                  <Text style={styles.rule}>• {singleRunChallenge ? `${challenge.goalKm} км зорилгыг нэг удаагийн GPS гүйлтээр дуусгана.` : 'Гадаа GPS-тэй гүйсэн зайг автоматаар нэмнэ.'}</Text>
                  <Text style={styles.rule}>• Нэг хэрэглэгч {getChallengeGroupLabel(challenge.group)} ангиллаас нэг идэвхтэй чэлленж сонгон оролцоно.</Text>
                  <Text style={styles.rule}>• Challenge дуусахаас өмнө {challenge.goalKm} км зорилгоо биелүүлнэ.</Text>
                </>
              )}
            </View>

            {showMarathonTypes && !isJoined ? (
              <View style={styles.typePicker}>
                <Text style={styles.sectionTitle}>Оролцох хэлбэр сонгох</Text>
                {marathonRegistrationTypes.map(type => {
                  const selected = selectedMarathonType === type.id;
                  return (
                    <Pressable key={type.id} style={[styles.typeOption, selected && styles.typeOptionActive]} onPress={() => {
                      setSelectedMarathonType(type.id);
                    }}>
                      <View style={styles.typeOptionMark}><Text style={styles.typeOptionMarkText}>{selected ? '✓' : ''}</Text></View>
                      <View style={styles.typeOptionCopy}>
                        <Text style={styles.typeOptionTitle}>{type.title}</Text>
                        <Text style={styles.typeOptionMeta}>{type.meta}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            {showMarathonCategories && !isJoined ? (
              <View style={styles.typePicker}>
                <Text style={styles.sectionTitle}>Ангилал сонгох</Text>
                <View style={styles.categoryTabs}>
                  {marathonCategories.map(category => {
                    const selected = selectedParticipantCategory === category.id;
                    return (
                      <Pressable key={category.id} style={[styles.categoryTab, selected && styles.categoryTabActive]} onPress={() => selectParticipantCategory(category.id)}>
                        <Text style={[styles.categoryTabText, selected && styles.categoryTabTextActive]}>{category.title}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <View style={styles.optionGrid}>
                  {selectedCategoryOptions.map(option => {
                    const selected = selectedMarathonOption === option.id;
                    return (
                      <Pressable key={option.id} style={[styles.registrationOptionCard, selected && styles.registrationOptionCardActive]} onPress={() => setSelectedMarathonOption(option.id)}>
                        <View style={styles.registrationOptionTop}>
                          <View style={[styles.registrationOptionIcon, { backgroundColor: option.tone }]}><Text style={styles.registrationOptionIconText}>♕</Text></View>
                          <Text style={[styles.registrationOptionTitle, { color: option.tone }]}>{option.title}</Text>
                        </View>
                        <Text style={styles.registrationOptionMeta}>Зай: {option.distance}</Text>
                        <Text style={styles.registrationOptionMeta}>Нас: {option.age}</Text>
                        <View style={styles.registrationOptionLine}><Text style={styles.registrationOptionFeature}>✓ {option.note}</Text></View>
                        <View style={[styles.registrationOptionSelect, selected && styles.registrationOptionSelectActive]}>
                          <Text style={[styles.registrationOptionSelectText, selected && styles.registrationOptionSelectTextActive]}>{selected ? 'Сонгогдсон' : 'Сонгох'}</Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {!isMarathon || isJoined ? (
              <>
                <View style={styles.progressHeader}>
                  <Text style={styles.sectionTitle}>Таны явц</Text>
                  <Text style={styles.percent}>{progressPercent}%</Text>
                </View>
                <View style={styles.progress}><View style={[styles.progressFill, { width: `${progressPercent}%` }]} /></View>
                <Text style={styles.progressText}>{progressKm.toFixed(2)} / {challenge.goalKm} км</Text>
              </>
            ) : null}
          </ScrollView>

          <View style={styles.footer}>
            {!isJoined ? (
              <Pressable style={styles.primary} onPress={register}>
                <Text style={styles.primaryText}>{isMarathon && showMarathonCategories ? 'Бүртгүүлэх' : isMarathon && showMarathonTypes ? 'Үргэлжлүүлэх' : 'Бүртгүүлэх'}</Text>
              </Pressable>
            ) : (
              <>
                <Pressable style={styles.secondary} onPress={() => setShowLeaveConfirm(true)}><Text style={styles.secondaryText}>{progressPercent >= 100 ? 'Дуусгах' : 'Гарах'}</Text></Pressable>
                <Pressable style={[styles.primary, styles.registered]} onPress={startRun}>
                  <Text style={styles.primaryText}>Гүйлт эхлүүлэх</Text>
                </Pressable>
              </>
            )}
          </View>
          {activeNotice ? (
            <View style={styles.noticeLayer}>
              <View style={styles.noticeCard}>
                <Text style={styles.noticeTitle}>{activeNotice.title}</Text>
                <Text style={styles.noticeMessage}>{activeNotice.message}</Text>
                <Pressable style={styles.noticeButton} onPress={() => {
                  if (notice) {
                    onNoticeClose?.();
                    return;
                  }
                  setShowFiveKStartNotice(false);
                  onStartRun(challenge);
                }}>
                  <Text style={styles.noticeButtonText}>Ойлголоо</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
          {showLeaveConfirm ? (
            <View style={styles.noticeLayer}>
              <View style={styles.noticeCard}>
                <Text style={styles.noticeTitle}>Чэллэнжээс гарах уу?</Text>
                <Text style={styles.noticeMessage}>Та тухайн чэллэнжээс гарахдаа итгэлтэй байна уу?</Text>
                <View style={styles.confirmActions}>
                  <Pressable style={styles.confirmNoButton} onPress={() => setShowLeaveConfirm(false)}>
                    <Text style={styles.confirmNoText}>Үгүй</Text>
                  </Pressable>
                  <Pressable style={styles.confirmYesButton} onPress={() => {
                    setShowLeaveConfirm(false);
                    onLeave(challenge);
                  }}>
                    <Text style={styles.confirmYesText}>Тийм</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          ) : null}
        </View>
        {previewIndex !== null ? (
          <View style={styles.imagePreviewRoot}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setPreviewIndex(null)} />
            <ScrollView
              ref={previewScrollRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              style={styles.imagePreviewPager}
              onMomentumScrollEnd={event => setPreviewIndex(Math.round(event.nativeEvent.contentOffset.x / width))}
            >
              {galleryImages.map((image, index) => (
                <View key={`preview-${image}-${index}`} style={[styles.imagePreviewPage, { width }]}>
                  <Image source={{ uri: image }} style={styles.imagePreview} resizeMode="contain" />
                </View>
              ))}
            </ScrollView>
            <View style={styles.imagePreviewCounter}>
              <Text style={styles.imagePreviewCounterText}>{previewIndex + 1} / {galleryImages.length}</Text>
            </View>
            <Pressable accessibilityLabel="Зураг хаах" style={styles.imagePreviewClose} onPress={() => setPreviewIndex(null)}>
              <Text style={styles.imagePreviewCloseText}>×</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.65)' },
  sheet: { maxHeight: '88%', backgroundColor: '#071016', borderTopLeftRadius: 26, borderTopRightRadius: 26, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', overflow: 'hidden' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 22 },
  title: { color: colors.text, fontSize: 26, fontWeight: '900' },
  close: { color: colors.text, fontSize: 42, lineHeight: 42 },
  content: { paddingHorizontal: 22, paddingBottom: 12 },
  challengeMedia: { height: 178, borderRadius: radius.lg, overflow: 'hidden', marginBottom: 14, borderWidth: 1, borderColor: colors.glassLine, backgroundColor: 'rgba(255,255,255,0.08)' },
  coverImage: { width: '100%', height: '100%' },
  coverScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.22)' },
  coverBadge: { position: 'absolute', left: 12, bottom: 12, height: 26, borderRadius: 13, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.62)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
  coverBadgeText: { color: colors.lime, fontSize: 9, fontWeight: '900' },
  coverMeta: { position: 'absolute', left: 12, right: 12, top: 12 },
  coverOrg: { color: '#FFFFFF', fontSize: 13, fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 8 },
  coverGoal: { color: 'rgba(255,255,255,0.82)', fontSize: 11, fontWeight: '800', marginTop: 3, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 8 },
  countdown: { backgroundColor: colors.glass, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.glassLine, padding: 14, alignItems: 'center', marginBottom: 18 },
  countLabel: { color: colors.muted, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  countValue: { color: colors.orange, fontSize: 22, fontWeight: '900', marginTop: 4 },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },
  descriptionCard: { borderWidth: 1, borderColor: colors.glassLine, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: radius.md, padding: 14, marginBottom: 14 },
  descriptionText: { color: 'rgba(255,255,255,0.78)', fontSize: 13, lineHeight: 20, fontWeight: '700', marginTop: 8 },
  infoCard: { borderWidth: 1, borderColor: 'rgba(6,182,212,0.32)', backgroundColor: 'rgba(6,182,212,0.1)', borderRadius: radius.md, padding: 14, marginBottom: 14 },
  infoLabel: { color: colors.blue, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  infoTitle: { color: colors.text, fontSize: 15, fontWeight: '900', marginTop: 7 },
  infoText: { color: 'rgba(255,255,255,0.78)', fontSize: 13, lineHeight: 20, fontWeight: '700', marginTop: 6 },
  rewardInfoCard: { borderWidth: 1, borderColor: 'rgba(249,115,22,0.34)', backgroundColor: 'rgba(249,115,22,0.1)', borderRadius: radius.md, padding: 14, marginBottom: 14 },
  rewardInfoLabel: { color: colors.orange, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  rewardInfoTitle: { color: colors.text, fontSize: 15, fontWeight: '900', marginTop: 7 },
  rewardInfoText: { color: 'rgba(255,255,255,0.78)', fontSize: 13, lineHeight: 20, fontWeight: '700', marginTop: 6 },
  registrationCard: { borderWidth: 1, borderColor: 'rgba(168,255,24,0.26)', backgroundColor: 'rgba(168,255,24,0.1)', borderRadius: radius.md, padding: 14, marginBottom: 18 },
  registrationLabel: { color: colors.lime, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  registrationText: { color: colors.text, fontSize: 13, lineHeight: 20, fontWeight: '800', marginTop: 7 },
  galleryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 9 },
  galleryCount: { color: colors.lime, fontSize: 10, fontWeight: '900' },
  galleryRow: { gap: 10, paddingBottom: 17 },
  galleryImage: { width: 126, height: 84, borderRadius: radius.md, borderWidth: 1, borderColor: colors.glassLine, backgroundColor: 'rgba(255,255,255,0.08)' },
  imagePreviewRoot: { position: 'absolute', inset: 0, zIndex: 20, alignItems: 'center', justifyContent: 'center', padding: 18, backgroundColor: 'rgba(0,0,0,0.84)' },
  imagePreviewPager: { width: '100%' },
  imagePreviewPage: { height: '100%', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  imagePreview: { width: '100%', height: '76%', borderRadius: radius.lg },
  imagePreviewCounter: { position: 'absolute', bottom: 26, alignSelf: 'center', height: 30, borderRadius: 15, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.24)' },
  imagePreviewCounterText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  imagePreviewClose: { position: 'absolute', right: 18, top: 18, width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)' },
  imagePreviewCloseText: { color: '#FFFFFF', fontSize: 30, lineHeight: 32, fontWeight: '800' },
  muted: { color: colors.muted, marginTop: 6, marginBottom: 18 },
  rules: { borderWidth: 1, borderColor: colors.glassLine, backgroundColor: colors.glassLight, borderRadius: radius.md, padding: 14, gap: 8 },
  rule: { color: 'rgba(255,255,255,0.72)', fontSize: 13, lineHeight: 19 },
  typePicker: { gap: 10, marginTop: 16 },
  typeOption: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', backgroundColor: '#0F1E24', borderRadius: radius.md, padding: 12 },
  typeOptionActive: { borderColor: 'rgba(168,255,24,0.82)', backgroundColor: '#12281D' },
  typeOptionMark: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(168,255,24,0.72)', backgroundColor: 'rgba(168,255,24,0.12)' },
  typeOptionMarkText: { color: colors.lime, fontSize: 14, fontWeight: '900' },
  typeOptionCopy: { flex: 1, minWidth: 0 },
  typeOptionTitle: { color: colors.text, fontSize: 13, fontWeight: '900' },
  typeOptionMeta: { color: 'rgba(255,255,255,0.64)', fontSize: 11, lineHeight: 15, fontWeight: '700', marginTop: 4 },
  categoryTabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryTab: { height: 34, borderRadius: 17, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', backgroundColor: '#101B21' },
  categoryTabActive: { borderColor: 'rgba(168,255,24,0.78)', backgroundColor: '#182C18' },
  categoryTabText: { color: 'rgba(255,255,255,0.68)', fontSize: 11, fontWeight: '900' },
  categoryTabTextActive: { color: colors.lime },
  optionGrid: { gap: 10 },
  registrationOptionCard: { borderRadius: radius.md, padding: 13, borderWidth: 1, borderColor: 'rgba(15,23,42,0.14)', backgroundColor: '#F8FAFC' },
  registrationOptionCardActive: { borderColor: '#84CC16', backgroundColor: '#ECFCCB', shadowColor: '#84CC16', shadowOpacity: 0.32, shadowRadius: 14, shadowOffset: { width: 0, height: 7 } },
  registrationOptionTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  registrationOptionIcon: { width: 31, height: 31, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  registrationOptionIconText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  registrationOptionTitle: { flex: 1, fontSize: 13, lineHeight: 17, fontWeight: '900' },
  registrationOptionMeta: { color: '#475569', fontSize: 11, fontWeight: '800', marginTop: 2 },
  registrationOptionLine: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: 'rgba(15,23,42,0.18)', paddingVertical: 7, marginTop: 10 },
  registrationOptionFeature: { color: '#334155', fontSize: 11, fontWeight: '800' },
  registrationOptionSelect: { height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginTop: 12, backgroundColor: '#E2E8F0', borderWidth: 1, borderColor: 'rgba(15,23,42,0.1)' },
  registrationOptionSelectActive: { backgroundColor: colors.lime, borderColor: 'rgba(15,23,42,0.18)' },
  registrationOptionSelectText: { color: '#475569', fontSize: 12, fontWeight: '900' },
  registrationOptionSelectTextActive: { color: '#102014' },
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
  secondaryText: { color: '#000', fontSize: 16, fontWeight: '800' },
  noticeLayer: { ...StyleSheet.absoluteFillObject, zIndex: 12, alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: 'rgba(0,0,0,0.56)' },
  noticeCard: { width: '100%', borderRadius: radius.lg, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', backgroundColor: '#071016', padding: 20, shadowColor: '#000', shadowOpacity: 0.34, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } },
  noticeTitle: { color: colors.text, fontSize: 21, lineHeight: 27, fontWeight: '900', textAlign: 'center' },
  noticeMessage: { color: 'rgba(255,255,255,0.76)', fontSize: 14, lineHeight: 21, fontWeight: '700', textAlign: 'center', marginTop: 10 },
  noticeButton: { height: 50, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.lime, marginTop: 20 },
  noticeButtonText: { color: '#071016', fontSize: 15, fontWeight: '900' },
  confirmActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  confirmNoButton: { flex: 1, height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  confirmNoText: { color: colors.text, fontSize: 15, fontWeight: '900' },
  confirmYesButton: { flex: 1, height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.lime },
  confirmYesText: { color: '#071016', fontSize: 15, fontWeight: '900' }
});
