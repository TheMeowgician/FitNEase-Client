import { useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { View, Text, Image, StyleSheet, Animated, Dimensions } from 'react-native';
import * as Updates from 'expo-updates';
import { useAuth } from '../contexts/AuthContext';
import { COLORS, FONTS, FONT_SIZES } from '../constants/colors';

const { width, height } = Dimensions.get('window');

type UpdatePhase = 'checking' | 'downloading' | 'applying' | 'ready';

export default function IndexPage() {
  const { isAuthenticated, isLoading, onboardingCompleted, pendingVerificationEmail, user } = useAuth();

  const [updatePhase, setUpdatePhase] = useState<UpdatePhase>('checking');
  const [statusMessage, setStatusMessage] = useState('Loading FitNEase...');
  const progressAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const hasRouted = useRef(false);

  // Check for updates on mount
  useEffect(() => {
    // Logo animations (same as splash.tsx)
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    let timeoutId: ReturnType<typeof setTimeout>;

    async function handleUpdates() {
      // Skip update check in development mode (expo-updates APIs don't work in dev)
      if (__DEV__) {
        setStatusMessage('Loading FitNEase...');
        Animated.timing(progressAnim, {
          toValue: 0.5,
          duration: 800,
          useNativeDriver: false,
        }).start();
        setUpdatePhase('ready');
        return;
      }

      try {
        // Phase 1: Checking for updates (progress 0% → 20%)
        setStatusMessage('Checking for updates...');
        Animated.timing(progressAnim, {
          toValue: 0.2,
          duration: 1500,
          useNativeDriver: false,
        }).start();

        const check = await Updates.checkForUpdateAsync();

        if (check.isAvailable) {
          // Phase 2: Downloading update (progress 20% → 80%)
          setUpdatePhase('downloading');
          setStatusMessage('Downloading update...');
          Animated.timing(progressAnim, {
            toValue: 0.8,
            duration: 10000,
            useNativeDriver: false,
          }).start();

          const result = await Updates.fetchUpdateAsync();

          if (result.isNew) {
            // Phase 3: Applying update (progress 80% → 100%)
            setUpdatePhase('applying');
            setStatusMessage('Applying update...');
            progressAnim.stopAnimation();
            Animated.timing(progressAnim, {
              toValue: 1,
              duration: 500,
              useNativeDriver: false,
            }).start();

            // Brief delay so user sees 100% before reload
            await new Promise(resolve => setTimeout(resolve, 600));
            await Updates.reloadAsync();
            return; // App restarts — code below won't execute
          }
        } else {
          setStatusMessage('Loading FitNEase...');
        }
      } catch (e) {
        // Update check failed — continue with current version
        console.log('Update check skipped:', e);
        setStatusMessage('Loading FitNEase...');
      }

      setUpdatePhase('ready');
    }

    // Safety timeout: don't block app launch for more than 15 seconds
    timeoutId = setTimeout(() => {
      setUpdatePhase('ready');
      setStatusMessage('Loading FitNEase...');
    }, 15000);

    handleUpdates().then(() => clearTimeout(timeoutId));

    return () => clearTimeout(timeoutId);
  }, []);

  // Route when both update check and auth loading are done
  useEffect(() => {
    if (updatePhase !== 'ready' || isLoading || hasRouted.current) return;

    // Stop any running progress animation and complete to 100%
    progressAnim.stopAnimation();
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: false,
    }).start(() => {
      // Route after progress bar finishes
      if (hasRouted.current) return;
      hasRouted.current = true;

      if (!isAuthenticated) {
        if (pendingVerificationEmail) {
          router.push({ pathname: '/(auth)/verify-email', params: { email: pendingVerificationEmail } });
        } else {
          router.push('/(auth)/login');
        }
      } else if (!onboardingCompleted) {
        router.push('/(onboarding)/welcome');
      } else {
        router.push('/(tabs)');
      }
    });
  }, [updatePhase, isAuthenticated, isLoading, onboardingCompleted, pendingVerificationEmail]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, width * 0.7],
  });

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Logo Section — same visual as splash.tsx */}
        <View style={styles.logoContainer}>
          <Animated.View
            style={[
              styles.logoWrapper,
              {
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }],
              },
            ]}
          >
            <Image
              source={require('../assets/images/fitnease-og-logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </Animated.View>

          <Animated.View style={[styles.textContainer, { opacity: fadeAnim }]}>
            <Text style={styles.tagline}>Your Personal Tabata Companion</Text>
          </Animated.View>
        </View>

        {/* Loading Section — synced to update progress */}
        <Animated.View style={[styles.loadingContainer, { opacity: fadeAnim }]}>
          <Text style={styles.statusMessage}>{statusMessage}</Text>
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressBar, { width: progressWidth }]} />
          </View>
        </Animated.View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.version}>Version 1.0.0</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.NEUTRAL.WHITE,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: height * 0.12,
    paddingBottom: height * 0.08,
  },
  logoContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  logoWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
  },
  logo: {
    width: width * 0.5,
    height: width * 0.5,
    maxWidth: 200,
    maxHeight: 200,
  },
  textContainer: {
    alignItems: 'center',
  },
  tagline: {
    fontSize: FONT_SIZES.LG,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    textAlign: 'center',
    lineHeight: 24,
    marginTop: 20,
  },
  loadingContainer: {
    alignItems: 'center',
    marginBottom: 40,
    padding: 20,
  },
  statusMessage: {
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    textAlign: 'center',
    marginBottom: 20,
  },
  progressTrack: {
    width: width * 0.7,
    height: 4,
    backgroundColor: COLORS.SECONDARY[200],
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: COLORS.PRIMARY[600],
    borderRadius: 2,
  },
  footer: {
    alignItems: 'center',
    paddingBottom: 20,
  },
  version: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[400],
  },
});
