import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Animated } from 'react-native';
import { COLORS, FONTS, FONT_SIZES } from '../../constants/colors';

interface SplashLoaderProps {
  message?: string;
}

export const SplashLoader: React.FC<SplashLoaderProps> = ({
  message = "Loading..."
}) => {
  const [pulseAnim] = useState(new Animated.Value(1));
  const [dotAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    // Pulse animation for the loader container
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );

    // Dot animation for loading text
    const dots = Animated.loop(
      Animated.sequence([
        Animated.timing(dotAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(dotAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ])
    );

    pulse.start();
    dots.start();

    return () => {
      pulse.stop();
      dots.stop();
    };
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.loaderContainer,
          { transform: [{ scale: pulseAnim }] }
        ]}
      >
        <ActivityIndicator
          size="large"
          color={COLORS.PRIMARY[600]}
          style={styles.spinner}
        />
      </Animated.View>

      <View style={styles.textContainer}>
        <Text style={styles.message}>{message}</Text>
        <Animated.View style={[styles.dotsContainer, { opacity: dotAnim }]}>
          <Text style={styles.dots}>...</Text>
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loaderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.PRIMARY[50],
    marginBottom: 20,
  },
  spinner: {
    transform: [{ scale: 1.2 }],
  },
  textContainer: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  message: {
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[700],
    textAlign: 'center',
  },
  dotsContainer: {
    marginLeft: 2,
  },
  dots: {
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.REGULAR,
    color: COLORS.PRIMARY[600],
    fontWeight: 'bold',
  },
});