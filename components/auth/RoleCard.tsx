import React from 'react';
import { Text, TouchableOpacity, View, ViewStyle, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import { FONTS } from '../../constants/fonts';

export interface RoleData {
  id: string;
  title: string;
  description: string;
  features: string[];
  icon: keyof typeof Ionicons.glyphMap;
  primaryColor: string;
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
      activeOpacity={0.9}
      onPress={onPress}
      style={[
        styles.cardContainer,
        {
          width,
          borderColor: isSelected ? COLORS.PRIMARY[600] : COLORS.SECONDARY[200],
          borderWidth: isSelected ? 3 : 1,
          transform: [{ scale: isSelected ? 1.02 : 0.98 }],
          shadowOpacity: isSelected ? 0.2 : 0.1,
          elevation: isSelected ? 8 : 5,
        },
        style,
      ]}
    >
      {/* Header Icon */}
      <View style={styles.iconContainer}>
        <View
          style={[
            styles.iconBackground,
            { backgroundColor: role.backgroundColor },
          ]}
        >
          <Ionicons name={role.icon} size={36} color={role.primaryColor} />
        </View>
      </View>

      {/* Title */}
      <Text style={styles.title} numberOfLines={1}>{role.title}</Text>

      {/* Description */}
      <Text style={styles.description} numberOfLines={3}>{role.description}</Text>

      {/* Features */}
      <View style={styles.featuresContainer}>
        <Text style={styles.featuresTitle}>What you'll get:</Text>
        <View style={styles.featuresListContainer}>
          {role.features.slice(0, 6).map((feature, index) => (
            <FeatureItem key={index} feature={feature} />
          ))}
        </View>
      </View>

      {/* Selection Indicator */}
      {isSelected && (
        <View style={styles.selectionIndicator}>
          <View style={styles.checkmarkContainer}>
            <Ionicons name="checkmark" size={16} color={COLORS.NEUTRAL.WHITE} />
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
};

interface FeatureItemProps {
  feature: string;
}

const FeatureItem: React.FC<FeatureItemProps> = ({ feature }) => (
  <View style={styles.featureItem}>
    <Ionicons
      name="checkmark-circle"
      size={16}
      color={COLORS.PRIMARY[600]}
      style={styles.featureIcon}
    />
    <Text style={styles.featureText} numberOfLines={2}>{feature}</Text>
  </View>
);

const styles = StyleSheet.create({
  cardContainer: {
    height: 480,
    backgroundColor: COLORS.NEUTRAL.WHITE,
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 8,
    shadowColor: COLORS.SECONDARY[900],
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowRadius: 8,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconBackground: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontSize: 14,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  featuresContainer: {
    flex: 1,
  },
  featuresTitle: {
    fontSize: 13,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[800],
    marginBottom: 12,
  },
  featuresListContainer: {
    flex: 1,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    paddingRight: 4,
  },
  featureIcon: {
    marginRight: 8,
    marginTop: 1,
  },
  featureText: {
    fontSize: 12,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[700],
    flex: 1,
    lineHeight: 16,
  },
  selectionIndicator: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  checkmarkContainer: {
    backgroundColor: COLORS.PRIMARY[600],
    borderRadius: 10,
    padding: 4,
  },
});