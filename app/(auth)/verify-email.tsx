import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
  Image,
  StatusBar,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  Keyboard,
  Dimensions
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { VerificationCodeInput, VerificationCodeInputRef } from '../../components/auth/VerificationCodeInput';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { authService } from '../../services/microservices/authService';
import { COLORS, FONTS, FONT_SIZES } from '../../constants/colors';

const { width } = Dimensions.get('window');

export default function VerifyEmailScreen() {
  const [isResending, setIsResending] = useState(false);
  const [canResend, setCanResend] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [isVerifying, setIsVerifying] = useState(false);
  const [enteredCode, setEnteredCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const { email } = useLocalSearchParams<{ email?: string }>();
  const { user, verifyEmail, resendVerification } = useAuth();
  const verificationInputRef = useRef<VerificationCodeInputRef>(null);

  // Get status bar height for Android
  const getStatusBarHeight = () => {
    if (Platform.OS === 'android') {
      return StatusBar.currentHeight || 24;
    }
    return 0;
  };

  // Keyboard listeners
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => {
        setKeyboardVisible(true);
      }
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setKeyboardVisible(false);
      }
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  // Countdown timer for resend button
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [countdown]);

  // Handle code input change
  const handleCodeChange = (code: string) => {
    setEnteredCode(code);
    if (codeError) {
      setCodeError('');
    }
  };

  // Handle code completion (auto-submit when 6 digits entered)
  const handleCodeComplete = (code: string) => {
    setEnteredCode(code);
    handleVerifyEmail(code);
  };

  // Email verification
  const handleVerifyEmail = async (code?: string) => {
    const verificationCode = code || enteredCode;

    if (!verificationCode || verificationCode.length !== 6) {
      setCodeError('Please enter the 6-digit verification code');
      if (!verificationCode) {
        verificationInputRef.current?.focus();
      }
      return;
    }

    setIsVerifying(true);
    setCodeError('');

    try {
      await verifyEmail(verificationCode, email);

      // Clear the input
      verificationInputRef.current?.clear();
      setEnteredCode('');

      // Email verified successfully! Now redirect to login with pre-filled email
      const userEmail = user?.email || email || '';

      Alert.alert(
        '✅ Email Verified Successfully!',
        'Your email has been verified. Please log in to complete your registration and access FitNEase.',
        [
          {
            text: 'Log In Now',
            onPress: () => {
              // Redirect to login with pre-filled email
              router.replace({
                pathname: '/(auth)/login',
                params: { email: userEmail, verified: 'true' }
              });
            }
          }
        ]
      );

    } catch (error: any) {
      setCodeError(error.message || 'Invalid verification code');
    } finally {
      setIsVerifying(false);
    }
  };

  // Resend email and reset code input
  const handleResendEmail = async () => {
    setIsResending(true);
    setCodeError('');
    setEnteredCode('');

    verificationInputRef.current?.clear();

    try {
      const userEmail = user?.email || email;
      await resendVerification(userEmail);
      Alert.alert(
        'New Code Sent! ✅',
        'We&apos;ve sent a new 6-digit verification code to your email. Please check your inbox.'
      );
      setCountdown(60);
      setCanResend(false);
    } catch (error: any) {
      Alert.alert('Resend Failed', error.message || 'Failed to resend email. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  const handleGetDebugCode = async () => {
    const userEmail = user?.email || email;
    if (!userEmail) {
      Alert.alert('Error', 'No email address available');
      return;
    }

    try {
      const debugResponse = await authService.getVerificationCodeForDebug(userEmail);
      Alert.alert(
        'Debug Code',
        `Verification code: ${debugResponse.verification_code}\nExpires: ${debugResponse.expires_at}\nIs expired: ${debugResponse.is_expired}`,
        [
          {
            text: 'Use Code',
            onPress: () => {
              setEnteredCode(debugResponse.verification_code);
              verificationInputRef.current?.setValue?.(debugResponse.verification_code);
            }
          },
          { text: 'OK' }
        ]
      );
    } catch (error: any) {
      // If user is already verified, try to get status and offer reset
      if (error.message.includes('already verified')) {
        Alert.alert(
          'User Already Verified',
          'This user appears to be already verified. Check status or reset verification?',
          [
            {
              text: 'Check Status',
              onPress: () => handleCheckUserStatus()
            },
            {
              text: 'Reset Verification',
              onPress: () => handleResetVerification()
            },
            { text: 'Cancel', style: 'cancel' }
          ]
        );
      } else {
        Alert.alert('Debug Error', error.message || 'Failed to get debug code');
      }
    }
  };

  const handleCheckUserStatus = async () => {
    const userEmail = user?.email || email;
    if (!userEmail) return;

    try {
      const status = await authService.getUserStatusForDebug(userEmail);
      Alert.alert(
        'User Status',
        `Email: ${status.email}\nUsername: ${status.username}\nVerified: ${status.is_verified}\nHas Code: ${status.has_verification_code}\nCode: ${status.verification_code || 'None'}\nExpired: ${status.code_is_expired}\nCreated: ${status.created_at}`
      );
    } catch (error: any) {
      Alert.alert('Status Error', error.message || 'Failed to get user status');
    }
  };

  const handleResetVerification = async () => {
    const userEmail = user?.email || email;
    if (!userEmail) return;

    try {
      const resetResponse = await authService.resetVerificationForDebug(userEmail);
      Alert.alert(
        'Verification Reset',
        `${resetResponse.message}\nNew code: ${resetResponse.new_verification_code}`,
        [
          {
            text: 'Use New Code',
            onPress: () => {
              setEnteredCode(resetResponse.new_verification_code);
              verificationInputRef.current?.setValue?.(resetResponse.new_verification_code);
            }
          },
          { text: 'OK' }
        ]
      );
    } catch (error: any) {
      Alert.alert('Reset Error', error.message || 'Failed to reset verification');
    }
  };

  const handleSkipVerification = () => {
    Alert.alert(
      'Skip Verification?',
      'You can verify your email later in settings. Some features may be limited.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Skip',
          onPress: () => {
            Keyboard.dismiss();
            router.replace('/(tabs)');
          },
        },
      ]
    );
  };

  const handleBackPress = () => {
    Alert.alert(
      'Go Back?',
      'You&apos;ll need to sign up again if you go back now.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Go Back',
          onPress: () => {
            Keyboard.dismiss();
            router.back();
          },
        },
      ]
    );
  };

  const maskEmail = (email: string) => {
    const [localPart, domain] = email.split('@');
    const maskedLocal = localPart.slice(0, 2) + '*'.repeat(localPart.length - 2);
    return `${maskedLocal}@${domain}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="white"
        translucent={false}
      />

      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
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
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Main Content */}
          <View style={styles.content}>
            {/* Logo - Hide when keyboard is visible on small screens */}
            {(!keyboardVisible || width > 400) && (
              <View style={styles.logoContainer}>
                <Image
                  source={require('../../assets/images/FitNEase_logo_without_text.png')}
                  style={[styles.logo, {
                    width: width * 0.15,
                    height: width * 0.15,
                  }]}
                  resizeMode="contain"
                />
              </View>
            )}

            {/* Email Icon - Hide when keyboard is visible */}
            {!keyboardVisible && (
              <View style={styles.emailIconContainer}>
                <View style={styles.emailIcon}>
                  <Ionicons name="mail" size={28} color="#0091FF" />
                </View>
              </View>
            )}

            {/* Title and Description */}
            <View style={styles.titleContainer}>
              <Text style={styles.title}>
                Enter your{' '}
                <Text style={styles.titleAccent}>verification code</Text>
              </Text>

              <Text style={styles.subtitle}>
                We sent a 6-digit code to{' '}
                <Text style={styles.emailText}>
                  {user?.email ? maskEmail(user.email) : email ? maskEmail(email) : ''}
                </Text>
              </Text>

              <Text style={styles.description}>
                After verification, you&apos;ll be automatically logged in.
              </Text>
            </View>

            {/* Verification Code Input */}
            <View style={styles.codeContainer}>
              <VerificationCodeInput
                ref={verificationInputRef}
                length={6}
                onCodeChange={handleCodeChange}
                onComplete={handleCodeComplete}
                error={codeError}
                disabled={isVerifying}
              />
            </View>

            {/* Action Buttons */}
            <View style={styles.buttonsContainer}>
              {/* Manual Verify Button */}
              <View style={styles.verifyButtonWrapper}>
                <Button
                  title={isVerifying ? 'Verifying...' : 'Verify & Continue'}
                  onPress={() => handleVerifyEmail()}
                  loading={isVerifying}
                  disabled={enteredCode.length !== 6}
                  style={{
                    backgroundColor: enteredCode.length === 6 ? '#0091FF' : '#E5E7EB',
                    shadowColor: enteredCode.length === 6 ? '#0091FF' : 'transparent',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                    elevation: enteredCode.length === 6 ? 8 : 0,
                  }}
                />
              </View>

              {/* Resend Button */}
              <TouchableOpacity
                onPress={handleResendEmail}
                disabled={!canResend || isResending}
                style={[
                  styles.resendButton,
                  {
                    borderColor: canResend && !isResending ? '#0091FF' : '#E5E7EB',
                    backgroundColor: canResend && !isResending ? 'transparent' : '#F9FAFB',
                  }
                ]}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.resendButtonText,
                    {
                      color: canResend && !isResending ? '#0091FF' : '#9CA3AF',
                    }
                  ]}
                >
                  {isResending
                    ? 'Sending...'
                    : canResend
                      ? 'Resend Code'
                      : `Resend in ${countdown}s`}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Help Text - Hide when keyboard is visible */}
            {!keyboardVisible && (
              <View style={styles.helpContainer}>
                <Text style={styles.helpText}>
                  Didn&apos;t receive the code? Check your spam folder or request a new one.
                </Text>
              </View>
            )}

            {/* Skip Option - Always at bottom */}
            <View style={styles.skipContainer}>
              <TouchableOpacity onPress={handleSkipVerification}>
                <Text style={styles.skipText}>
                  I&apos;ll verify later
                </Text>
              </TouchableOpacity>
            </View>
          </View>
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
  keyboardContainer: {
    flex: 1,
  },
  headerContainer: {
    paddingHorizontal: 24,
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
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    // Dynamic size set inline
  },
  emailIconContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  emailIcon: {
    width: 64,
    height: 64,
    backgroundColor: '#EBF8FF',
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  titleContainer: {
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
    textAlign: 'center',
    marginBottom: 16,
  },
  titleAccent: {
    color: '#0091FF',
  },
  subtitle: {
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 8,
  },
  emailText: {
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[900],
  },
  description: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[500],
    textAlign: 'center',
    lineHeight: 20,
  },
  codeContainer: {
    marginBottom: 32,
  },
  buttonsContainer: {
    marginBottom: 24,
  },
  verifyButtonWrapper: {
    marginBottom: 16,
  },
  resendButton: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 2,
  },
  resendButtonText: {
    textAlign: 'center',
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.SEMIBOLD,
  },
  helpContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  helpText: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[500],
    textAlign: 'center',
    lineHeight: 20,
  },
  skipContainer: {
    alignItems: 'center',
    marginTop: 'auto',
    marginBottom: 32,
  },
  skipText: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[500],
    textAlign: 'center',
  },
});