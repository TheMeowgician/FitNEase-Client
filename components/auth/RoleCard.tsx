import React from 'react';
import { Text, TouchableOpacity, View, ViewStyle, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../../constants/colors';
import { FONTS } from '../../constants/fonts';

export interface FeatureItem {
  text: string;
  icon: keyof typeof Ionicons.glyphMap;
}

export interface RoleData {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  features: FeatureItem[];
  icon: keyof typeof Ionicons.glyphMap;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
}

interface RoleCardProps {
  role: RoleData;
  isSelected: boolean;
  onPress: () => void;
  width: number;
  style?: ViewStyle;
}

export const RoleCard: React.FC<RoleCardProps> = ({
  role,
  isSelected,
  onPress,
  width,
  style,
}) => {
  return (
    <TouchableOpacity
      activeOpacity={0.95}
      onPress={onPress}
      style={[
        styles.cardContainer,
        {
          width,
          borderColor: isSelected ? role.primaryColor : COLORS.SECONDARY[200],
          borderWidth: isSelected ? 2.5 : 1,
          transform: [{ scale: isSelected ? 1 : 0.96 }],
        },
        style,
      ]}
    >
      {/* Gradient Header */}
      <LinearGradient
        colors={[role.primaryColor, role.secondaryColor]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientHeader}
      >
        <View style={styles.headerContent}>
          <View style={styles.iconWrapper}>
            <Ionicons name={role.icon} size={26} color="#FFFFFF" />
          </View>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>{role.title}</Text>
            <Text style={styles.subtitle}>{role.subtitle}</Text>
          </View>
        </View>

        {/* Selection Badge */}
        {isSelected && (
          <View style={styles.selectedBadge}>
            <Ionicons name="checkmark-circle" size={22} color="#FFFFFF" />
          </View>
        )}
      </LinearGradient>

      {/* Card Body */}
      <View style={styles.cardBody}>
        {/* Description */}
        <Text style={styles.description}>{role.description}</Text>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Features */}
        <Text style={styles.featuresLabel}>Features</Text>
        <View style={styles.featuresGrid}>
          {role.features.map((feature, index) => (
            <View key={index} style={styles.featureItem}>
              <View style={[styles.featureIconContainer, { backgroundColor: role.backgroundColor }]}>
                <Ionicons name={feature.icon} size={14} color={role.primaryColor} />
              </View>
              <Text style={styles.featureText} numberOfLines={2}>{feature.text}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Bottom Accent */}
      <View style={[styles.bottomAccent, { backgroundColor: role.backgroundColor }]}>
        <Text style={[styles.accentText, { color: role.primaryColor }]}>
          {role.id === 'mentor' ? 'For fitness leaders' : 'Start your journey'}
        </Text>
        <Ionicons name="arrow-forward" size={14} color={role.primaryColor} />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: COLORS.NEUTRAL.WHITE,
    borderRadius: 20,
    marginHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
    overflow: 'hidden',
  },
  gradientHeader: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    position: 'relative',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontFamily: FONTS.BOLD,
    color: '#FFFFFF',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: FONTS.REGULAR,
    color: 'rgba(255, 255, 255, 0.85)',
  },
  selectedBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  cardBody: {
    padding: 16,
    paddingTop: 14,
  },
  description: {
    fontSize: 14,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    lineHeight: 20,
    marginBottom: 12,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.SECONDARY[100],
    marginBottom: 12,
  },
  featuresLabel: {
    fontSize: 11,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[500],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  featuresGrid: {
    gap: 8,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  featureText: {
    fontSize: 13,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[700],
    flex: 1,
  },
  bottomAccent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 6,
  },
  accentText: {
    fontSize: 13,
    fontFamily: FONTS.SEMIBOLD,
  },
});
