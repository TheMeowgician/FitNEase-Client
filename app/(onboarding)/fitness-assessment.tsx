import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { COLORS } from '../../constants/colors';
import { FONTS } from '../../constants/fonts';

export default function FitnessAssessmentScreen() {
  // Auto-skip this screen and set all users to beginner
  React.useEffect(() => {
    // Automatically navigate to next step with beginner level
    const timer = setTimeout(() => {
      router.replace({
        pathname: '/(onboarding)/preferences',
        params: {
          fitnessLevel: 'beginner'
        }
      });
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.text}>Setting up your profile...</Text>
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
  },
  text: {
    fontSize: 16,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
  },
});