import React from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity, StatusBar } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { FONTS } from '../../constants/fonts';

import { RegisterMentorForm } from '../../components/auth/RegisterMentorForm';
import { COLORS } from '../../constants/colors';

export default function RegisterMentorScreen() {

  const handleRegistrationSuccess = (requiresEmailVerification: boolean, userEmail?: string) => {
    // Navigate directly to disclaimer screen - the RegisterMentorForm already showed a success alert
    router.push({
      pathname: '/(auth)/disclaimer',
      params: {
        email: requiresEmailVerification ? userEmail : undefined,
      }
    });
  };

  const navigateToLogin = () => {
    router.push('/(auth)/login');
  };

  const handleBackPress = () => {
    router.back();
  };

  // Get status bar height for Android
  const getStatusBarHeight = () => {
    if (Platform.OS === 'android') {
      return StatusBar.currentHeight || 24;
    }
    return 0;
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
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {/* Header with Back Button */}
        <View style={[
          styles.headerContainer,
          {
            paddingTop: Platform.OS === 'android' ? getStatusBarHeight() + 16 : 16,
            minHeight: Platform.OS === 'android' ? 60 : 50,
          }
        ]}>
          <TouchableOpacity
            onPress={handleBackPress}
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={24} color="#374151" />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Mentor Role Display */}
          <View style={styles.roleHeader}>
            <Text style={styles.roleTitle}>
              Creating Mentor Account
            </Text>
            <Text style={styles.roleSubtitle}>
              Lead and inspire others as a fitness mentor
            </Text>
          </View>

          <RegisterMentorForm
            onSuccess={handleRegistrationSuccess}
            onLoginRedirect={navigateToLogin}
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
  headerContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  roleHeader: {
    paddingVertical: 20,
    paddingHorizontal: 8,
    marginBottom: 16,
    backgroundColor: COLORS.PRIMARY[50],
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.PRIMARY[200],
  },
  roleTitle: {
    fontSize: 18,
    fontFamily: FONTS.BOLD,
    color: COLORS.PRIMARY[700],
    textAlign: 'center',
    marginBottom: 4,
  },
  roleSubtitle: {
    fontSize: 14,
    fontFamily: FONTS.REGULAR,
    color: COLORS.PRIMARY[600],
    textAlign: 'center',
    lineHeight: 20,
  },
});
