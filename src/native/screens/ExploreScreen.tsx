import React from 'react';
import { ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Challenge } from '../types';
import { colors, radius } from '../theme';

type Props = {
  challenges: Challenge[];
  joinedChallengeIds: string[];
  onOpenChallenge: (challenge: Challenge) => void;
  onRegisterChallenge: (challenge: Challenge) => void;
};

function ChallengeTile({
  challenge,
  joined,
  onOpenChallenge,
  onRegisterChallenge
}: {
  challenge: Challenge;
  joined: boolean;
  onOpenChallenge: (challenge: Challenge) => void;
  onRegisterChallenge: (challenge: Challenge) => void;
}) {
  return (
    <Pressable style={styles.tile} onPress={() => onOpenChallenge(challenge)}>
      <ImageBackground source={{ uri: challenge.image }} imageStyle={styles.tileImage} style={styles.tileImageWrap}>
        <View style={styles.tileShade}>
          <View>
            <Text style={styles.type}>{challenge.type}</Text>
            <Text style={styles.title}>{challenge.title}</Text>
            <Text style={styles.meta}>{challenge.org} · {challenge.goalKm} км</Text>
          </View>
          <Pressable
            style={[styles.register, joined && styles.joined]}
            onPress={event => {
              event.stopPropagation();
              if (joined) onOpenChallenge(challenge);
              else onRegisterChallenge(challenge);
            }}
          >
            <Text style={styles.registerText}>{joined ? 'Идэвхтэй' : 'Бүртгүүлэх'}</Text>
          </Pressable>
        </View>
      </ImageBackground>
    </Pressable>
  );
}

export function ExploreScreen({ challenges, joinedChallengeIds, onOpenChallenge, onRegisterChallenge }: Props) {
  const fiveKm = challenges.filter(challenge => challenge.group === '5k');
  const tenKm = challenges.filter(challenge => challenge.group === '10k');

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.heading}>Чэллэнжүүд</Text>

      <Text style={styles.sectionTitle}>5 км чэлленж</Text>
      {fiveKm.map(challenge => (
        <ChallengeTile
          key={challenge.id}
          challenge={challenge}
          joined={joinedChallengeIds.includes(challenge.id)}
          onOpenChallenge={onOpenChallenge}
          onRegisterChallenge={onRegisterChallenge}
        />
      ))}

      <Text style={styles.sectionTitle}>10 км чэлленж</Text>
      {tenKm.map(challenge => (
        <ChallengeTile
          key={challenge.id}
          challenge={challenge}
          joined={joinedChallengeIds.includes(challenge.id)}
          onOpenChallenge={onOpenChallenge}
          onRegisterChallenge={onRegisterChallenge}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 18, paddingTop: 54, paddingBottom: 118 },
  heading: { color: colors.text, fontSize: 32, fontWeight: '900', marginBottom: 22 },
  sectionTitle: { color: colors.text, fontSize: 22, fontWeight: '900', marginBottom: 12, marginTop: 8 },
  tile: { height: 178, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassLine, marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 16 },
  tileImageWrap: { flex: 1 },
  tileImage: { borderRadius: radius.lg },
  tileShade: { flex: 1, padding: 18, justifyContent: 'space-between', backgroundColor: 'rgba(0,0,0,0.55)' },
  type: { color: colors.lime, textTransform: 'uppercase', fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  title: { color: colors.text, fontSize: 26, fontWeight: '900', marginTop: 4 },
  meta: { color: 'rgba(255,255,255,0.78)', fontSize: 14, marginTop: 4 },
  register: { alignSelf: 'flex-start', borderRadius: 999, backgroundColor: colors.lime, paddingHorizontal: 18, paddingVertical: 10 },
  joined: { backgroundColor: colors.green },
  registerText: { color: '#000', fontWeight: '900' }
});
