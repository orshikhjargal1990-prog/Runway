import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme';
import {
  DEFAULT_LOGIN_SLIDES,
  loadLoginSlides,
  LOGIN_SLIDES_VERSION_KEY,
  type LoginSlide
} from '../../content/loginSlides';

type Props = {
  onLogin: (email: string, password: string) => Promise<AuthResult>;
  onRegister: (name: string, email: string, password: string) => Promise<AuthResult>;
  onQuickLogin: () => void;
};

type AuthMode = 'login' | 'register';

type AuthResult = {
  ok: boolean;
  message?: string;
};

export function LoginScreen({ onLogin, onRegister, onQuickLogin }: Props) {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<AuthMode>('register');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [slides, setSlides] = useState<LoginSlide[]>(DEFAULT_LOGIN_SLIDES);
  const [slideIndex, setSlideIndex] = useState(0);
  const authMotion = useRef(new Animated.Value(0)).current;
  const slideReveal = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const refreshSlides = () => loadLoginSlides().then(items => {
      const activeItems = items.filter(item => item.enabled);
      setSlides(activeItems.length ? activeItems : DEFAULT_LOGIN_SLIDES);
      setSlideIndex(0);
    });
    refreshSlides();

    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onStorage = (event: StorageEvent) => {
      if (event.key === LOGIN_SLIDES_VERSION_KEY) refreshSlides();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('runboost-login-slides-updated', refreshSlides);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('runboost-login-slides-updated', refreshSlides);
    };
  }, []);

  useEffect(() => {
    if (slides.length < 2) return;
    const timer = setInterval(() => setSlideIndex(current => (current + 1) % slides.length), 6500);
    return () => clearInterval(timer);
  }, [slides.length]);

  const activeSlide = useMemo(() => slides[slideIndex] ?? DEFAULT_LOGIN_SLIDES[0], [slideIndex, slides]);

  useEffect(() => {
    slideReveal.setValue(0);
    Animated.timing(slideReveal, {
      toValue: 1,
      duration: 720,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web'
    }).start();
  }, [activeSlide.id, slideReveal]);

  useEffect(() => {
    if (!authOpen) return;
    authMotion.setValue(0);
    Animated.timing(authMotion, {
      toValue: 1,
      duration: 430,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    }).start();
  }, [authMotion, authOpen]);

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setError('');
    setAuthOpen(true);
  };

  const closeAuth = () => {
    setError('');
    Animated.timing(authMotion, {
      toValue: 0,
      duration: 260,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true
    }).start(({ finished }) => {
      if (finished) setAuthOpen(false);
    });
  };

  const quickLogin = () => {
    onQuickLogin();
  };

  const slideTextMotion = {
    opacity: slideReveal,
    transform: [
      { translateY: slideReveal.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
      { scale: slideReveal.interpolate({ inputRange: [0, 1], outputRange: [0.985, 1] }) }
    ],
    ...(Platform.OS === 'web' ? {
      filter: slideReveal.interpolate({ inputRange: [0, 1], outputRange: ['blur(12px)', 'blur(0px)'] })
    } : {})
  };

  const authPanelMotion = {
    opacity: authMotion,
    transform: [
      { translateY: authMotion.interpolate({ inputRange: [0, 1], outputRange: [42, 0] }) },
      { scale: authMotion.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }
    ]
  };

  const submit = async () => {
    const normalizedEmail = email.trim();
    const normalizedName = name.trim();
    const normalizedPassword = password.trim();

    if (mode === 'register' && normalizedName.length < 2) {
      setError('Нэрээ оруулна уу.');
      return;
    }

    if (!normalizedEmail.includes('@') || !normalizedEmail.includes('.')) {
      setError('Зөв имэйл хаяг оруулна уу.');
      return;
    }

    if (normalizedPassword.length < 6) {
      setError('Нууц үг 6-аас дээш тэмдэгттэй байх ёстой.');
      return;
    }

    setSubmitting(true);
    const result = mode === 'register'
      ? await onRegister(normalizedName, normalizedEmail, normalizedPassword)
      : await onLogin(normalizedEmail, normalizedPassword);
    setSubmitting(false);

    if (!result.ok) {
      setError(result.message ?? 'Дахин оролдоно уу.');
    }
  };

  const title = mode === 'register' ? 'Бүртгэл үүсгэх' : 'Нэвтрэх';

  return (
    <View style={styles.root}>
      <LoginMedia slide={activeSlide} />
      <View style={styles.imageDim} />
      <LinearGradient
        colors={['rgba(3,7,5,0.05)', 'rgba(3,7,5,0.42)', 'rgba(3,7,5,0.96)']}
        locations={[0, 0.42, 0.78]}
        style={styles.backgroundShade}
      />

      <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 18) }]}> 
        <View style={styles.brandRow}>
          <Text style={styles.brandMark}>↗</Text>
          <Text style={styles.brand}>RUNBOOST</Text>
        </View>
        <View style={styles.brandTag}><Text style={styles.brandTagText}>RUN · SHARE · GROW</Text></View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.content, { paddingBottom: Math.max(insets.bottom + 22, 34) }]}
      >
        {!authOpen ? (
          <>
            <Animated.View style={slideTextMotion}>
              <View style={styles.storyHeader}>
                <View style={styles.eyebrowRow}>
                  <View style={styles.eyebrowLine} />
                  <Text style={styles.eyebrow}>{activeSlide.eyebrow}</Text>
                </View>
                <Text style={styles.slideNumber}>{String(slideIndex + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}</Text>
              </View>

              <Text style={styles.title}>
                {activeSlide.titleBefore}<Text style={styles.accent}>{activeSlide.accent}</Text>{activeSlide.titleAfter}
              </Text>

              <Text style={styles.subtitle}>{activeSlide.subtitle}</Text>
            </Animated.View>

            <View style={styles.slideDots}>
              {slides.map((slide, index) => (
                <Pressable
                  key={slide.id}
                  accessibilityLabel={`${index + 1}-р слайд`}
                  onPress={() => setSlideIndex(index)}
                  style={[styles.slideDot, index === slideIndex && styles.slideDotActive]}
                />
              ))}
            </View>

            <View style={styles.landingActions}>
              <Pressable style={styles.loginButton} onPress={quickLogin}>
                <Text style={styles.loginButtonText}>Нэвтрэх</Text>
              </Pressable>
              <Pressable style={styles.getStartedButton} onPress={() => switchMode('register')}>
                <Text style={styles.getStartedText}>Эхлэх</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <Animated.View style={[styles.authPanel, authPanelMotion]}>
            <View style={styles.authHeader}>
              <View><Text style={styles.authEyebrow}>RUNBOOST</Text><Text style={styles.authTitle}>{mode === 'register' ? 'Бүртгэл үүсгэх' : 'Тавтай морил'}</Text></View>
              <Pressable accessibilityLabel="Форм хаах" style={styles.closeButton} onPress={closeAuth}><Text style={styles.closeText}>×</Text></Pressable>
            </View>

            <View style={styles.form}>
              {mode === 'register' && (
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Таны нэр"
                  placeholderTextColor="rgba(255,255,255,0.48)"
                  autoCapitalize="words"
                  autoCorrect={false}
                  style={styles.input}
                />
              )}

              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="Имэйл хаяг"
                placeholderTextColor="rgba(255,255,255,0.48)"
                keyboardType="email-address"
                textContentType="emailAddress"
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.input}
              />

              <View style={styles.passwordField}>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Нууц үг"
                  placeholderTextColor="rgba(255,255,255,0.48)"
                  textContentType={mode === 'register' ? 'newPassword' : 'password'}
                  secureTextEntry={!isPasswordVisible}
                  style={styles.passwordInput}
                  onSubmitEditing={submit}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={isPasswordVisible ? 'Нууц үг нуух' : 'Нууц үг харах'}
                  hitSlop={10}
                  style={styles.passwordToggle}
                  onPress={() => setIsPasswordVisible(current => !current)}
                >
                  <Text style={styles.passwordToggleText}>{isPasswordVisible ? 'Нуух' : 'Харах'}</Text>
                </Pressable>
              </View>

              {error ? <Text style={styles.error}>{error}</Text> : null}
            </View>

            <Pressable disabled={submitting} style={[styles.primaryButton, submitting && styles.primaryButtonDisabled]} onPress={submit}>
              <Text style={styles.primaryText}>{submitting ? 'Түр хүлээнэ үү...' : title}</Text>
              <Text style={styles.primaryArrow}>→</Text>
            </Pressable>
            <Pressable style={styles.switchLink} onPress={() => switchMode(mode === 'register' ? 'login' : 'register')}>
              <Text style={styles.switchLinkText}>{mode === 'register' ? 'Бүртгэлтэй юу? Нэвтрэх' : 'Шинэ хэрэглэгч үү? Бүртгүүлэх'}</Text>
            </Pressable>
          </Animated.View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

function LoginMedia({ slide }: { slide: LoginSlide }) {
  if (Platform.OS === 'web' && slide.mediaType === 'video') {
    return (
      <video
        key={slide.id}
        autoPlay
        loop
        muted
        playsInline
        src={slide.mediaUri}
        style={webVideoStyle}
      />
    );
  }

  return (
    <ImageBackground source={{ uri: slide.mediaUri }} resizeMode="cover" style={styles.mediaBackground}>
      <Image source={{ uri: slide.mediaUri }} style={styles.mediaPreload} />
    </ImageBackground>
  );
}

const webVideoStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  objectFit: 'cover'
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#050505'
  },
  mediaBackground: {
    ...StyleSheet.absoluteFillObject
  },
  mediaPreload: {
    width: 1,
    height: 1,
    opacity: 0
  },
  imageDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.28)'
  },
  backgroundShade: {
    ...StyleSheet.absoluteFillObject
  },
  topBar: {
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  brandMark: {
    color: colors.lime,
    fontSize: 29,
    fontWeight: '900',
    marginRight: 7
  },
  brand: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0
  },
  brandTag: {
    height: 27,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.46)',
    paddingHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center'
  },
  brandTagText: {
    color: 'rgba(255,255,255,0.86)',
    fontSize: 7,
    fontWeight: '800'
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 20
  },
  storyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  eyebrowLine: {
    width: 28,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.lime,
    marginRight: 9
  },
  eyebrow: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800'
  },
  slideNumber: {
    color: 'rgba(255,255,255,0.58)',
    fontSize: 10,
    fontWeight: '700'
  },
  title: {
    color: '#ffffff',
    fontSize: 35,
    lineHeight: 39,
    fontWeight: '900',
    fontStyle: 'italic',
    textTransform: 'uppercase',
    marginBottom: 10,
    maxWidth: 410
  },
  accent: {
    color: colors.lime
  },
  subtitle: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 14,
    lineHeight: 20,
    maxWidth: 390,
    marginBottom: 13
  },
  slideDots: {
    flexDirection: 'row',
    gap: 5,
    marginBottom: 12
  },
  slideDot: {
    flex: 1,
    height: 2,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.38)'
  },
  slideDotActive: {
    backgroundColor: colors.lime
  },
  landingActions: {
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(8,10,9,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    padding: 4,
    flexDirection: 'row',
    gap: 5
  },
  loginButton: {
    flex: 1,
    borderRadius: 23,
    backgroundColor: 'rgba(10,12,11,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  loginButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800'
  },
  getStartedButton: {
    flex: 1,
    borderRadius: 23,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center'
  },
  getStartedText: {
    color: '#121512',
    fontSize: 12,
    fontWeight: '900'
  },
  authPanel: {
    borderRadius: 22,
    backgroundColor: 'rgba(8,11,9,0.91)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    padding: 16
  },
  authHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 15
  },
  authEyebrow: {
    color: colors.lime,
    fontSize: 8,
    fontWeight: '900',
    marginBottom: 4
  },
  authTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '900'
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  closeText: {
    color: '#ffffff',
    fontSize: 22,
    lineHeight: 24,
    fontWeight: '400'
  },
  form: {
    gap: 8,
    marginBottom: 10
  },
  input: {
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    paddingHorizontal: 17
  },
  passwordField: {
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 17,
    paddingRight: 6
  },
  passwordInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    paddingVertical: 0
  },
  passwordToggle: {
    minWidth: 52,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center'
  },
  passwordToggleText: {
    color: colors.lime,
    fontSize: 11,
    fontWeight: '900'
  },
  error: {
    color: '#ff8a8a',
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 8
  },
  primaryButton: {
    height: 50,
    borderRadius: 25,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16
  },
  primaryText: {
    color: '#121512',
    fontSize: 14,
    fontWeight: '900'
  },
  primaryButtonDisabled: {
    opacity: 0.62
  },
  primaryArrow: {
    color: '#121512',
    fontSize: 20,
    fontWeight: '700'
  },
  switchLink: {
    height: 34,
    alignItems: 'center',
    justifyContent: 'flex-end'
  },
  switchLinkText: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: 11,
    fontWeight: '700'
  }
});
