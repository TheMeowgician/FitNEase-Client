import React from 'react';
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { COLORS } from '../../constants/colors';

interface PageIndicatorProps {
  totalPages: number;
  currentIndex: number;
  onPagePress?: (index: number) => void;
  activeColor?: string;
  inactiveColor?: string;
  size?: number;
}

export const PageIndicator: React.FC<PageIndicatorProps> = ({
  totalPages,
  currentIndex,
  onPagePress,
  activeColor = COLORS.PRIMARY[500],
  inactiveColor = COLORS.NEUTRAL[300],
  size = 12,
}) => {
  return (
    <View style={styles.container}>
      {Array.from({ length: totalPages }).map((_, index) => (
        <TouchableOpacity
          key={index}
          onPress={() => onPagePress?.(index)}
          style={[
            styles.dot,
            {
              width: currentIndex === index ? size + 4 : size,
              height: currentIndex === index ? size + 4 : size,
              borderRadius: currentIndex === index ? (size + 4) / 2 : size / 2,
              backgroundColor: currentIndex === index ? activeColor : 'transparent',
              borderWidth: currentIndex === index ? 0 : 2,
              borderColor: currentIndex === index ? 'transparent' : inactiveColor,
              marginHorizontal: 4,
              opacity: currentIndex === index ? 1 : 0.6,
            }
          ]}
          activeOpacity={0.7}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    // Dynamic styles applied inline
  },
});