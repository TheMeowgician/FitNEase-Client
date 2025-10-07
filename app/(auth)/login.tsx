import React from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, StatusBar, Image } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LoginForm } from '../../components/auth/LoginForm';
import { COLORS } from '../../constants/colors';

export default function LoginScreen() {
  const params = useLocalSearchParams();
  const preFilledEmail = params.email as string;
  const isFromVerification = params.verified === 'true';
  const handleForgotPassword = () => {
    router.push('/(auth)/forgot-password');
  };

  const handleCreateAccount = () => {
    // Navigate to role selection first, then to register
    router.push('/(onboarding)/role-selection');
  };


  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="white"
        translucent={false}
      />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo Section */}
          <View style={styles.logoContainer}>
            <Image
              source={require('../../assets/images/FitNEase_logo_without_text.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          <LoginForm
            onForgotPassword={handleForgotPassword}
            onCreateAccount={handleCreateAccount}
            preFilledEmail={preFilledEmail}
            showVerificationMessage={isFromVerification}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.NEUTRAL.WHITE,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 40,
    paddingBottom: 40,
  },
  logoContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    marginBottom: 20,
  },
  logo: {
    width: 120,
    height: 120,
  },
});