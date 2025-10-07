import React from 'react';
import { View, ActivityIndicator, Text, ViewStyle, TextStyle } from 'react-native';
import { COLORS, FONTS, FONT_SIZES } from '../../constants/colors';

interface LoadingSpinnerProps {
  size?: 'small' | 'large';
  color?: string;
  message?: string;
  overlay?: boolean;
  style?: ViewStyle;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'large',
  color = COLORS.PRIMARY[600],
  message,
  overlay = false,
  style,
}) => {
  const containerStyle: ViewStyle = {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    ...(overlay && {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.3)',
      zIndex: 1000,
    }),
    ...style,
  };

  const messageStyle: TextStyle = {
    marginTop: 12,
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.REGULAR,
    color: overlay ? COLORS.NEUTRAL.WHITE : COLORS.SECONDARY[700],
    textAlign: 'center',
  };

  return (
    <View style={containerStyle}>
      <ActivityIndicator size={size} color={color} />
      {message && <Text style={messageStyle}>{message}</Text>}
    </View>
  );
};