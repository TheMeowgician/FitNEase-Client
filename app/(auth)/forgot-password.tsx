import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  StatusBar,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  Keyboard,
  Dimensions
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { VerificationCodeInput, VerificationCodeInputRef } from '../../components/auth/VerificationCodeInput';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useAlert } from '../../contexts/AlertContext';
import { authService } from '../../services/microservices/authService';
import { validateEmail } from '../../utils/validation/authValidation';
import { COLORS, FONTS, FONT_SIZES } from '../../constants/colors';

const { width } = Dimensions.get('window');

type Step = 'email' | 'code' | 'password';

export default function ForgotPasswordScreen() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [enteredCode, setEnteredCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [canResend, setCanResend] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const alert = useAlert();
  const verificationInputRef = useRef<VerificationCodeInputRef>(null);

  const getStatusBarHeight = () => {
    if (Platform.OS === 'android') {
      return StatusBar.currentHeight || 24;
    }
    return 0;
  };

  // Keyboard listeners
  useEffect(() => {
    const showListener = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hideListener = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      showListener.remove();
      hideListener.remove();
    };
  }, []);

  // Countdown timer for resend
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (step === 'code') {
      setCanResend(true);
    }
  }, [countdown, step]);

  // Step 1: Send reset code
  const handleSendCode = async () => {
    setEmailError('');

    if (!email) {
      setEmailError('Email is required');
      return;
    }
    if (!validateEmail(email)) {
      setEmailError('Please enter a valid email address');
      return;
    }

    setIsLoading(true);
    try {
      await authService.forgotPassword({ email: email.trim().toLowerCase() });
      setStep('code');
      setCountdown(60);
      setCanResend(false);
    } catch (error: any) {
      if (error.message?.includes('wait')) {
        alert.warning('Please Wait', 'A reset code was recently sent. Please wait before requesting another one.');
      } else {
        // Still move to code step for security (don't reveal if email exists)
        setStep('code');
        setCountdown(60);
        setCanResend(false);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Resend code
  const handleResendCode = async () => {
    setIsLoading(true);
    setCodeError('');
    setEnteredCode('');
    verificationInputRef.current?.clear();

    try {
      await authService.forgotPassword({ email: email.trim().toLowerCase() });
      alert.success('Code Sent!', 'A new reset code has been sent to your email.');
      setCountdown(60);
      setCanResend(false);
    } catch (error: any) {
      alert.error('Resend Failed', error.message || 'Failed to resend code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Code input handlers
  const handleCodeChange = (code: string) => {
    setEnteredCode(code);
    if (codeError) setCodeError('');
  };

  const handleCodeComplete = (code: string) => {
    setEnteredCode(code);
    // Move to password step
    setStep('password');
  };

  const handleVerifyCode = () => {
    if (!enteredCode || enteredCode.length !== 6) {
      setCodeError('Please enter the 6-digit reset code');
      return;
    }
    setStep('password');
  };

  // Step 3: Reset password
  const handleResetPassword = async () => {
    setPasswordError('');
    setConfirmError('');

    let hasError = false;

    if (!newPassword) {
      setPasswordError('New password is required');
      hasError = true;
    } else if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      hasError = true;
    }

    if (!confirmPassword) {
      setConfirmError('Please confirm your password');
      hasError = true;
    } else if (newPassword !== confirmPassword) {
      setConfirmError('Passwords do not match');
      hasError = true;
    }

    if (hasError) return;

    setIsLoading(true);
    try {
      await authService.resetPassword({
        email: email.trim().toLowerCase(),
        code: enteredCode,
        newPassword: newPassword,
      });

      alert.success(
        'Password Reset!',
        'Your password has been reset successfully. Please log in with your new password.',
        () => {
          router.replace({
            pathname: '/(auth)/login',
            params: { passwordReset: 'true' },
          });
        }
      );
    } catch (error: any) {
      const errorMessage = error.message || 'Password reset failed';

      if (errorMessage.includes('expired')) {
        alert.error('Code Expired', 'Your reset code has expired. Please request a new one.');
        setStep('email');
      } else if (errorMessage.includes('Invalid reset code')) {
        setCodeError('Invalid reset code. Please check and try again.');
        setStep('code');
        verificationInputRef.current?.clear();
        setEnteredCode('');
      } else {
        alert.error('Reset Failed', errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackPress = () => {
    Keyboard.dismiss();
    if (step === 'password') {
      setStep('code');
    } else if (step === 'code') {
      setStep('email');
    } else {
      router.back();
    }
  };

  // Step titles and icons
  const getStepConfig = () => {
    switch (step) {
      case 'email':
        return {
          icon: 'mail' as const,
          title: 'Reset your',
          titleAccent: 'password',
          subtitle: 'Enter your email address and we\'ll send you a 6-digit code to reset your password.',
        };
      case 'code':
        return {
          icon: 'key' as const,
          title: 'Enter your',
          titleAccent: 'reset code',
          subtitle: `We sent a 6-digit code to ${maskEmail(email)}`,
        };
      case 'password':
        return {
          icon: 'lock-closed' as const,
          title: 'Create a',
          titleAccent: 'new password',
          subtitle: 'Enter your new password below. Make sure it\'s at least 8 characters.',
        };
    }
  };

  const maskEmail = (email: string) => {
    const [localPart, domain] = email.split('@');
    if (!localPart || !domain) return email;
    const maskedLocal = localPart.slice(0, 2) + '*'.repeat(Math.max(localPart.length - 2, 1));
    return `${maskedLocal}@${domain}`;
  };

  const config = getStepConfig();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="white" translucent={false} />

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

          {/* Step indicator */}
          <View style={styles.stepIndicator}>
            {(['email', 'code', 'password'] as Step[]).map((s, i) => (
              <View
                key={s}
                style={[
                  styles.stepDot,
                  {
                    backgroundColor: step === s ? '#0091FF' :
                      (['email', 'code', 'password'].indexOf(step) > i ? '#0091FF' : '#E5E7EB'),
                    opacity: step === s ? 1 : (['email', 'code', 'password'].indexOf(step) > i ? 0.5 : 0.3),
                  }
                ]}
              />
            ))}
          </View>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            {/* Logo */}
            {(!keyboardVisible || width > 400) && (
              <View style={styles.logoContainer}>
                <Image
                  source={require('../../assets/images/FitNEase_logo_without_text.png')}
                  style={[styles.logo, { width: width * 0.15, height: width * 0.15 }]}
                  resizeMode="contain"
                />
              </View>
            )}

            {/* Icon */}
            {!keyboardVisible && (
              <View style={styles.iconContainer}>
                <View style={styles.iconCircle}>
                  <Ionicons name={config.icon} size={28} color="#0091FF" />
                </View>
              </View>
            )}

            {/* Title */}
            <View style={styles.titleContainer}>
              <Text style={styles.title}>
                {config.title}{' '}
                <Text style={styles.titleAccent}>{config.titleAccent}</Text>
              </Text>
              <Text style={styles.subtitle}>{config.subtitle}</Text>
            </View>

            {/* Step 1: Email */}
            {step === 'email' && (
              <View style={styles.formContainer}>
                <Input
                  label="Email Address"
                  placeholder="Enter your email address"
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (emailError) setEmailError('');
                  }}
                  error={emailError}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  leftIcon={<Ionicons name="mail-outline" size={20} color={COLORS.SECONDARY[400]} />}
                  style={styles.inputMargin}
                />

                <View style={styles.buttonContainer}>
                  <Button
                    title={isLoading ? 'Sending...' : 'Send Reset Code'}
                    onPress={handleSendCode}
                    loading={isLoading}
                    disabled={!email}
                    style={{
                      backgroundColor: email ? '#0091FF' : '#E5E7EB',
                      shadowColor: email ? '#0091FF' : 'transparent',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.3,
                      shadowRadius: 8,
                      elevation: email ? 8 : 0,
                    }}
                  />
                </View>
              </View>
            )}

            {/* Step 2: Code */}
            {step === 'code' && (
              <View style={styles.formContainer}>
                <View style={styles.codeContainer}>
                  <VerificationCodeInput
                    ref={verificationInputRef}
                    length={6}
                    onCodeChange={handleCodeChange}
                    onComplete={handleCodeComplete}
                    error={codeError}
                    disabled={isLoading}
                  />
                </View>

                <View style={styles.buttonContainer}>
                  <Button
                    title={isLoading ? 'Verifying...' : 'Verify Code'}
                    onPress={handleVerifyCode}
                    loading={isLoading}
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

                {/* Resend */}
                <TouchableOpacity
                  onPress={handleResendCode}
                  disabled={!canResend || isLoading}
                  style={[
                    styles.resendButton,
                    {
                      borderColor: canResend && !isLoading ? '#0091FF' : '#E5E7EB',
                      backgroundColor: canResend && !isLoading ? 'transparent' : '#F9FAFB',
                    }
                  ]}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.resendButtonText,
                      { color: canResend && !isLoading ? '#0091FF' : '#9CA3AF' }
                    ]}
                  >
                    {isLoading ? 'Sending...' : canResend ? 'Resend Code' : `Resend in ${countdown}s`}
                  </Text>
                </TouchableOpacity>

                {!keyboardVisible && (
                  <View style={styles.helpContainer}>
                    <Text style={styles.helpText}>
                      Didn&apos;t receive the code? Check your spam folder or request a new one.
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Step 3: New Password */}
            {step === 'password' && (
              <View style={styles.formContainer}>
                <Input
                  label="New Password"
                  placeholder="Enter your new password"
                  value={newPassword}
                  onChangeText={(text) => {
                    setNewPassword(text);
                    if (passwordError) setPasswordError('');
                  }}
                  error={passwordError}
                  secureTextEntry={!showPassword}
                  leftIcon={<Ionicons name="lock-closed-outline" size={20} color={COLORS.SECONDARY[400]} />}
                  rightIcon={
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                      <Ionicons
                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={20}
                        color={COLORS.SECONDARY[400]}
                      />
                    </TouchableOpacity>
                  }
                  style={styles.inputMargin}
                />

                <Input
                  label="Confirm Password"
                  placeholder="Confirm your new password"
                  value={confirmPassword}
                  onChangeText={(text) => {
                    setConfirmPassword(text);
                    if (confirmError) setConfirmError('');
                  }}
                  error={confirmError}
                  secureTextEntry={!showConfirmPassword}
                  leftIcon={<Ionicons name="lock-closed-outline" size={20} color={COLORS.SECONDARY[400]} />}
                  rightIcon={
                    <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                      <Ionicons
                        name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={20}
                        color={COLORS.SECONDARY[400]}
                      />
                    </TouchableOpacity>
                  }
                  style={styles.inputMargin}
                />

                <View style={styles.buttonContainer}>
                  <Button
                    title={isLoading ? 'Resetting...' : 'Reset Password'}
                    onPress={handleResetPassword}
                    loading={isLoading}
                    disabled={!newPassword || !confirmPassword}
                    style={{
                      backgroundColor: newPassword && confirmPassword ? '#0091FF' : '#E5E7EB',
                      shadowColor: newPassword && confirmPassword ? '#0091FF' : 'transparent',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.3,
                      shadowRadius: 8,
                      elevation: newPassword && confirmPassword ? 8 : 0,
                    }}
                  />
                </View>
              </View>
            )}

            {/* Back to Login */}
            <View style={styles.backToLoginContainer}>
              <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
                <Text style={styles.backToLoginText}>
                  Remember your password?{' '}
                  <Text style={styles.backToLoginLink}>Sign In</Text>
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
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  stepIndicator: {
    flexDirection: 'row',
    flex: 1,
    justifyContent: 'center',
    gap: 8,
    marginRight: 40, // offset for back button
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
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
  logo: {},
  iconContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconCircle: {
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
  },
  formContainer: {
    marginBottom: 24,
  },
  inputMargin: {
    marginBottom: 16,
  },
  codeContainer: {
    marginBottom: 32,
  },
  buttonContainer: {
    marginBottom: 16,
  },
  resendButton: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 2,
    marginBottom: 16,
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
  backToLoginContainer: {
    alignItems: 'center',
    marginTop: 'auto',
    marginBottom: 32,
    paddingVertical: 8,
  },
  backToLoginText: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    textAlign: 'center',
  },
  backToLoginLink: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.SEMIBOLD,
    color: '#0091FF',
  },
});
