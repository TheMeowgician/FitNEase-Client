import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';
import { COLORS, FONTS, FONT_SIZES } from '../../constants/colors';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  icon,
  style,
  textStyle,
}) => {
  const getButtonStyle = (): ViewStyle => {
    const baseStyle: ViewStyle = {
      borderRadius: 8,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      opacity: disabled ? 0.6 : 1,
    };

    // Size styles
    const sizeStyles = {
      small: { paddingHorizontal: 12, paddingVertical: 8 },
      medium: { paddingHorizontal: 16, paddingVertical: 12 },
      large: { paddingHorizontal: 24, paddingVertical: 16 },
    };

    // Variant styles
    const variantStyles = {
      primary: {
        backgroundColor: COLORS.PRIMARY[600],
        borderWidth: 0,
      },
      secondary: {
        backgroundColor: COLORS.SECONDARY[600],
        borderWidth: 0,
      },
      outline: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: COLORS.PRIMARY[600],
      },
      ghost: {
        backgroundColor: 'transparent',
        borderWidth: 0,
      },
      danger: {
        backgroundColor: COLORS.ERROR[600],
        borderWidth: 0,
      },
    };

    return {
      ...baseStyle,
      ...sizeStyles[size],
      ...variantStyles[variant],
      ...style,
    };
  };

  const getTextStyle = (): TextStyle => {
    const baseTextStyle: TextStyle = {
      fontFamily: FONTS.SEMIBOLD,
      textAlign: 'center',
    };

    // Size text styles
    const sizeTextStyles = {
      small: { fontSize: FONT_SIZES.SM },
      medium: { fontSize: FONT_SIZES.BASE },
      large: { fontSize: FONT_SIZES.LG },
    };

    // Variant text styles
    const variantTextStyles = {
      primary: { color: COLORS.NEUTRAL.WHITE },
      secondary: { color: COLORS.NEUTRAL.WHITE },
      outline: { color: COLORS.PRIMARY[600] },
      ghost: { color: COLORS.PRIMARY[600] },
      danger: { color: COLORS.NEUTRAL.WHITE },
    };

    return {
      ...baseTextStyle,
      ...sizeTextStyles[size],
      ...variantTextStyles[variant],
      ...textStyle,
    };
  };

  return (
    <TouchableOpacity
      style={getButtonStyle()}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'outline' || variant === 'ghost' ? COLORS.PRIMARY[600] : COLORS.NEUTRAL.WHITE}
        />
      ) : (
        <>
          {icon && icon}
          <Text style={[getTextStyle(), icon ? { marginLeft: 8 } : undefined]}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
};