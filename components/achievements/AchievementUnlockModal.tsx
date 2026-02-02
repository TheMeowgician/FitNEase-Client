import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Animated,
  Dimensions,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, FONT_SIZES } from '../../constants/colors';
import { getAchievementIcon } from '../../constants/achievementIcons';

const { width } = Dimensions.get('window');

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
    color: '#6B7280',
    bgColor: '#F3F4F6',
    label: 'COMMON',
  },
  rare: {
    color: '#3B82F6',
    bgColor: '#DBEAFE',
    label: 'RARE',
  },
  epic: {
    color: '#8B5CF6',
    bgColor: '#EDE9FE',
    label: 'EPIC',
  },
  legendary: {
    color: '#F59E0B',
    bgColor: '#FEF3C7',
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
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const badgeScaleAnim = useRef(new Animated.Value(0)).current;
  const textOpacityAnim = useRef(new Animated.Value(0)).current;
  const pointsScaleAnim = useRef(new Animated.Value(0)).current;

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
    fadeAnim.setValue(0);
    scaleAnim.setValue(0.9);
    badgeScaleAnim.setValue(0);
    textOpacityAnim.setValue(0);
    pointsScaleAnim.setValue(0);
  };

  const playEntryAnimation = () => {
    resetAnimations();

    // Sequence of animations
    Animated.sequence([
      // 1. Fade in backdrop and card
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
      ]),
      // 2. Badge appears with bounce
      Animated.spring(badgeScaleAnim, {
        toValue: 1,
        friction: 4,
        tension: 50,
        useNativeDriver: true,
      }),
      // 3. Text fades in
      Animated.timing(textOpacityAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      // 4. Points pop
      Animated.spring(pointsScaleAnim, {
        toValue: 1,
        friction: 5,
        tension: 60,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleNext = () => {
    if (currentIndex < achievements.length - 1) {
      // Animate out, then in for next achievement
      Animated.parallel([
        Animated.timing(scaleAnim, { toValue: 0.9, duration: 200, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 0.5, duration: 200, useNativeDriver: true }),
      ]).start(() => {
        setCurrentIndex(currentIndex + 1);
        playEntryAnimation();
      });
    } else {
      handleClose();
    }
  };

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(scaleAnim, { toValue: 0.9, duration: 200, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => {
      onClose();
    });
  };

  if (!currentAchievement) return null;

  const badgeIcon = currentAchievement.badge_icon || 'trophy';
  const badgeColor = currentAchievement.badge_color || rarityConfig.color;

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={handleClose}>
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <Animated.View
          style={[
            styles.container,
            {
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.starsRow}>
              <Ionicons name="star" size={16} color={COLORS.WARNING[500]} />
              <Text style={styles.unlockedText}>ACHIEVEMENT UNLOCKED</Text>
              <Ionicons name="star" size={16} color={COLORS.WARNING[500]} />
            </View>
          </View>

          {/* Badge */}
          <View style={styles.badgeContainer}>
            <Animated.View
              style={[
                styles.badgeWrapper,
                { transform: [{ scale: badgeScaleAnim }] },
              ]}
            >
              {getAchievementIcon(currentAchievement.achievement_name) ? (
                <Image
                  source={getAchievementIcon(currentAchievement.achievement_name)!}
                  style={styles.achievementImage}
                  resizeMode="contain"
                />
              ) : (
                <View style={[styles.badge, { backgroundColor: badgeColor }]}>
                  <Ionicons name={badgeIcon as any} size={48} color={COLORS.NEUTRAL.WHITE} />
                </View>
              )}
            </Animated.View>
          </View>

          {/* Rarity Badge */}
          <View style={[styles.rarityBadge, { backgroundColor: rarityConfig.bgColor }]}>
            <Text style={[styles.rarityText, { color: rarityConfig.color }]}>
              {rarityConfig.label}
            </Text>
          </View>

          {/* Achievement Info */}
          <Animated.View style={[styles.infoContainer, { opacity: textOpacityAnim }]}>
            <Text style={styles.achievementName}>{currentAchievement.achievement_name}</Text>
            <Text style={styles.achievementDescription}>{currentAchievement.description}</Text>
          </Animated.View>

          {/* Points */}
          <Animated.View
            style={[
              styles.pointsContainer,
              { transform: [{ scale: pointsScaleAnim }] },
            ]}
          >
            <Ionicons name="trophy" size={20} color={COLORS.WARNING[500]} />
            <Text style={styles.pointsText}>+{currentAchievement.points_value}</Text>
            <Text style={styles.pointsLabel}>POINTS</Text>
          </Animated.View>

          {/* Progress Dots */}
          {achievements.length > 1 && (
            <View style={styles.dotsContainer}>
              {achievements.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    i === currentIndex && styles.dotActive,
                  ]}
                />
              ))}
            </View>
          )}

          {/* Action Button */}
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: rarityConfig.color }]}
            onPress={handleNext}
            activeOpacity={0.8}
          >
            <Text style={styles.actionButtonText}>
              {currentIndex < achievements.length - 1
                ? `Next (${currentIndex + 1}/${achievements.length})`
                : 'Awesome!'}
            </Text>
            <Ionicons
              name={currentIndex < achievements.length - 1 ? 'arrow-forward' : 'checkmark'}
              size={20}
              color={COLORS.NEUTRAL.WHITE}
            />
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: width - 40,
    maxWidth: 340,
    backgroundColor: COLORS.NEUTRAL.WHITE,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: COLORS.NEUTRAL.BLACK,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    marginBottom: 20,
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  unlockedText: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.BOLD,
    color: COLORS.WARNING[600],
    letterSpacing: 1.5,
  },
  badgeContainer: {
    marginBottom: 16,
  },
  badgeWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.NEUTRAL.BLACK,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  achievementImage: {
    width: 120,
    height: 120,
  },
  rarityBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 16,
  },
  rarityText: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.BOLD,
    letterSpacing: 1.5,
  },
  infoContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  achievementName: {
    fontSize: FONT_SIZES.XL,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
    textAlign: 'center',
    marginBottom: 8,
  },
  achievementDescription: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  pointsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.WARNING[50],
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.WARNING[200],
  },
  pointsText: {
    fontSize: FONT_SIZES.XL,
    fontFamily: FONTS.BOLD,
    color: COLORS.WARNING[600],
  },
  pointsLabel: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.WARNING[500],
    letterSpacing: 1,
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.SECONDARY[200],
  },
  dotActive: {
    width: 24,
    backgroundColor: COLORS.PRIMARY[500],
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  actionButtonText: {
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.BOLD,
    color: COLORS.NEUTRAL.WHITE,
  },
});
