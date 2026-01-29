import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Animated,
  Dimensions,
  TouchableOpacity,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { COLORS, FONTS } from '../../constants/colors';

const { width, height } = Dimensions.get('window');

export interface UnlockedAchievement {
  achievement_id: number;
  achievement_name: string;
  description: string;
  badge_icon: string;
  badge_color: string;
  rarity_level: 'common' | 'rare' | 'epic' | 'legendary';
  points_value: number;
}

interface AchievementUnlockModalProps {
  visible: boolean;
  achievements: UnlockedAchievement[];
  onClose: () => void;
}

const RARITY_CONFIG = {
  common: {
    gradient: ['#6B7280', '#4B5563'],
    glow: '#9CA3AF',
    label: 'COMMON',
  },
  rare: {
    gradient: ['#3B82F6', '#2563EB'],
    glow: '#60A5FA',
    label: 'RARE',
  },
  epic: {
    gradient: ['#8B5CF6', '#7C3AED'],
    glow: '#A78BFA',
    label: 'EPIC',
  },
  legendary: {
    gradient: ['#F59E0B', '#D97706'],
    glow: '#FBBF24',
    label: 'LEGENDARY',
  },
};

export default function AchievementUnlockModal({
  visible,
  achievements,
  onClose,
}: AchievementUnlockModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Animations
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.3)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const badgeScale = useRef(new Animated.Value(0)).current;
  const badgeRotation = useRef(new Animated.Value(0)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;
  const glowScale = useRef(new Animated.Value(0.8)).current;
  const sparkleOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const pointsScale = useRef(new Animated.Value(0)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;

  const currentAchievement = achievements[currentIndex];
  const rarityConfig = currentAchievement
    ? RARITY_CONFIG[currentAchievement.rarity_level] || RARITY_CONFIG.common
    : RARITY_CONFIG.common;

  useEffect(() => {
    if (visible && achievements.length > 0) {
      setCurrentIndex(0);
      playEntryAnimation();
    } else {
      resetAnimations();
    }
  }, [visible, achievements]);

  const resetAnimations = () => {
    backdropOpacity.setValue(0);
    cardScale.setValue(0.3);
    cardOpacity.setValue(0);
    badgeScale.setValue(0);
    badgeRotation.setValue(0);
    glowOpacity.setValue(0);
    glowScale.setValue(0.8);
    sparkleOpacity.setValue(0);
    textOpacity.setValue(0);
    pointsScale.setValue(0);
    buttonOpacity.setValue(0);
  };

  const playEntryAnimation = () => {
    resetAnimations();

    // Sequence of animations
    Animated.sequence([
      // 1. Fade in backdrop
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      // 2. Card appears with bounce
      Animated.parallel([
        Animated.spring(cardScale, {
          toValue: 1,
          friction: 6,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(cardOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]),
      // 3. Glow pulse starts
      Animated.parallel([
        Animated.timing(glowOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(glowScale, {
          toValue: 1.2,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
      // 4. Badge appears with spin
      Animated.parallel([
        Animated.spring(badgeScale, {
          toValue: 1,
          friction: 4,
          tension: 50,
          useNativeDriver: true,
        }),
        Animated.timing(badgeRotation, {
          toValue: 1,
          duration: 600,
          easing: Easing.out(Easing.back(1.5)),
          useNativeDriver: true,
        }),
        Animated.timing(sparkleOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]),
      // 5. Text fades in
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      // 6. Points pop
      Animated.spring(pointsScale, {
        toValue: 1,
        friction: 5,
        tension: 60,
        useNativeDriver: true,
      }),
      // 7. Button appears
      Animated.timing(buttonOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    // Start continuous glow pulse
    startGlowPulse();
  };

  const startGlowPulse = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowScale, {
          toValue: 1.4,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(glowScale, {
          toValue: 1.2,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const handleNext = () => {
    if (currentIndex < achievements.length - 1) {
      // Animate out, then in for next achievement
      Animated.parallel([
        Animated.timing(cardScale, { toValue: 0.8, duration: 200, useNativeDriver: true }),
        Animated.timing(cardOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start(() => {
        setCurrentIndex(currentIndex + 1);
        resetAnimations();
        backdropOpacity.setValue(1);
        playEntryAnimation();
      });
    } else {
      handleClose();
    }
  };

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(cardScale, { toValue: 0.8, duration: 200, useNativeDriver: true }),
      Animated.timing(cardOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(backdropOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => {
      onClose();
    });
  };

  const rotationInterpolate = badgeRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  if (!currentAchievement) return null;

  const badgeIcon = currentAchievement.badge_icon || 'trophy';

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <BlurView intensity={30} style={StyleSheet.absoluteFill} tint="dark" />

        <Animated.View
          style={[
            styles.cardContainer,
            {
              opacity: cardOpacity,
              transform: [{ scale: cardScale }],
            },
          ]}
        >
          {/* Glow Effect */}
          <Animated.View
            style={[
              styles.glowEffect,
              {
                backgroundColor: rarityConfig.glow,
                opacity: Animated.multiply(glowOpacity, 0.4),
                transform: [{ scale: glowScale }],
              },
            ]}
          />

          {/* Main Card */}
          <LinearGradient
            colors={['#1F2937', '#111827']}
            style={styles.card}
          >
            {/* Achievement Unlocked Header */}
            <Animated.View style={[styles.header, { opacity: textOpacity }]}>
              <View style={styles.unlockedBadge}>
                <Ionicons name="star" size={12} color="#FBBF24" />
                <Text style={styles.unlockedText}>ACHIEVEMENT UNLOCKED</Text>
                <Ionicons name="star" size={12} color="#FBBF24" />
              </View>
            </Animated.View>

            {/* Badge Container */}
            <View style={styles.badgeContainer}>
              {/* Sparkles */}
              <Animated.View style={[styles.sparkleContainer, { opacity: sparkleOpacity }]}>
                {[...Array(8)].map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.sparkle,
                      {
                        transform: [
                          { rotate: `${i * 45}deg` },
                          { translateY: -60 },
                        ],
                      },
                    ]}
                  >
                    <Ionicons name="sparkles" size={16} color={rarityConfig.glow} />
                  </View>
                ))}
              </Animated.View>

              {/* Badge */}
              <Animated.View
                style={[
                  styles.badge,
                  {
                    transform: [
                      { scale: badgeScale },
                      { rotate: rotationInterpolate },
                    ],
                  },
                ]}
              >
                <LinearGradient
                  colors={rarityConfig.gradient}
                  style={styles.badgeGradient}
                >
                  <Ionicons
                    name={badgeIcon as any}
                    size={48}
                    color="white"
                  />
                </LinearGradient>
              </Animated.View>
            </View>

            {/* Rarity Label */}
            <Animated.View style={{ opacity: textOpacity }}>
              <LinearGradient
                colors={rarityConfig.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.rarityBadge}
              >
                <Text style={styles.rarityText}>{rarityConfig.label}</Text>
              </LinearGradient>
            </Animated.View>

            {/* Achievement Name & Description */}
            <Animated.View style={[styles.textContainer, { opacity: textOpacity }]}>
              <Text style={styles.achievementName}>{currentAchievement.achievement_name}</Text>
              <Text style={styles.achievementDescription}>{currentAchievement.description}</Text>
            </Animated.View>

            {/* Points */}
            <Animated.View
              style={[
                styles.pointsContainer,
                { transform: [{ scale: pointsScale }] },
              ]}
            >
              <Ionicons name="trophy" size={20} color="#FBBF24" />
              <Text style={styles.pointsText}>+{currentAchievement.points_value}</Text>
              <Text style={styles.pointsLabel}>POINTS</Text>
            </Animated.View>

            {/* Action Button */}
            <Animated.View style={{ opacity: buttonOpacity, width: '100%' }}>
              <TouchableOpacity onPress={handleNext} activeOpacity={0.8}>
                <LinearGradient
                  colors={rarityConfig.gradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.actionButton}
                >
                  <Text style={styles.actionButtonText}>
                    {currentIndex < achievements.length - 1
                      ? `NEXT (${currentIndex + 1}/${achievements.length})`
                      : 'AWESOME!'}
                  </Text>
                  <Ionicons
                    name={currentIndex < achievements.length - 1 ? 'arrow-forward' : 'checkmark'}
                    size={20}
                    color="white"
                  />
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>

            {/* Progress dots */}
            {achievements.length > 1 && (
              <View style={styles.dotsContainer}>
                {achievements.map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.dot,
                      i === currentIndex && styles.dotActive,
                      i === currentIndex && { backgroundColor: rarityConfig.glow },
                    ]}
                  />
                ))}
              </View>
            )}
          </LinearGradient>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  cardContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowEffect: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    top: 20,
  },
  card: {
    width: width * 0.85,
    maxWidth: 340,
    borderRadius: 28,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  header: {
    marginBottom: 24,
  },
  unlockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)',
  },
  unlockedText: {
    fontSize: 11,
    fontFamily: FONTS.BOLD,
    color: '#FBBF24',
    letterSpacing: 1.5,
  },
  badgeContainer: {
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  sparkleContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sparkle: {
    position: 'absolute',
  },
  badge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  badgeGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  rarityBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 16,
  },
  rarityText: {
    fontSize: 11,
    fontFamily: FONTS.BOLD,
    color: 'white',
    letterSpacing: 2,
  },
  textContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  achievementName: {
    fontSize: 22,
    fontFamily: FONTS.BOLD,
    color: 'white',
    textAlign: 'center',
    marginBottom: 8,
  },
  achievementDescription: {
    fontSize: 14,
    fontFamily: FONTS.REGULAR,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  pointsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.2)',
  },
  pointsText: {
    fontSize: 24,
    fontFamily: FONTS.BOLD,
    color: '#FBBF24',
  },
  pointsLabel: {
    fontSize: 12,
    fontFamily: FONTS.SEMIBOLD,
    color: 'rgba(251, 191, 36, 0.8)',
    letterSpacing: 1,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    gap: 8,
  },
  actionButtonText: {
    fontSize: 16,
    fontFamily: FONTS.BOLD,
    color: 'white',
    letterSpacing: 0.5,
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  dotActive: {
    width: 24,
  },
});
