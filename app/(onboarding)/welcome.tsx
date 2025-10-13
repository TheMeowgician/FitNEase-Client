import React from 'react';
import { View, Text, StyleSheet, Image, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { Button } from '../../components/ui/Button';
import { COLORS } from '../../constants/colors';
import { FONTS } from '../../constants/fonts';

const { width } = Dimensions.get('window');

export default function WelcomeScreen() {
  const handleContinue = () => {
    router.push('/(onboarding)/fitness-assessment');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* FitNEase Logo */}
        <View style={styles.logoContainer}>
          <Image
            source={require('../../assets/images/FitNEase_logo_without_text.png')}
            style={[styles.logo, {
              width: width * 0.3,
              height: width * 0.3,
            }]}
            resizeMode="contain"
          />
        </View>

        <Text style={styles.title}>Welcome to FitNEase!</Text>
        <Text style={styles.subtitle}>
          Your personalized Tabata workout companion
        </Text>

        <Button
          title="Get Started"
          onPress={handleContinue}
          style={styles.button}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.NEUTRAL.WHITE,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    // Dynamic size set inline
  },
  title: {
    fontSize: 32,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
    textAlign: 'center',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    textAlign: 'center',
    marginBottom: 40,
  },
  button: {
    width: '100%',
  },
});