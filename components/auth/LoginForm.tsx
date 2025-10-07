import React, { useState } from 'react';
import { View, Text, Alert, ViewStyle, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { validateEmail } from '../../utils/validation/authValidation';
import { COLORS, FONTS, FONT_SIZES } from '../../constants/colors';

interface LoginFormProps {
  onForgotPassword: () => void;
  onCreateAccount: () => void;
  style?: ViewStyle;
  preFilledEmail?: string;
  showVerificationMessage?: boolean;
}

export const LoginForm: React.FC<LoginFormProps> = ({
  onForgotPassword,
  onCreateAccount,
  style,
  preFilledEmail,
  showVerificationMessage,
}) => {
  const [email, setEmail] = useState(preFilledEmail || '');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { login, user } = useAuth();

  const validateForm = (): boolean => {
    let isValid = true;

    // Reset errors
    setEmailError('');
    setPasswordError('');

    // Email validation
    if (!email) {
      setEmailError('Email is required');
      isValid = false;
    } else if (!validateEmail(email)) {
      setEmailError('Please enter a valid email address');
      isValid = false;
    }

    // Password validation
    if (!password) {
      setPasswordError('Password is required');
      isValid = false;
    }

    return isValid;
  };

  const handleLogin = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      const success = await login(email, password);
      if (success) {
        console.log('🔑 Login successful, triggering navigation...');

        // Small delay to ensure state updates propagate
        setTimeout(() => {
          console.log('🔑 Checking user state for navigation...');
          // Force navigation based on current auth state
          router.replace('/');
        }, 200);
      }
    } catch (error: any) {
      let errorMessage = 'An error occurred during login. Please try again.';

      if (error.message) {
        if (error.message.includes('email') || error.message.includes('user')) {
          errorMessage = 'No account found with this email address. Please check your email or create a new account.';
        } else if (error.message.includes('password') || error.message.includes('credential')) {
          errorMessage = 'Incorrect password. Please try again or reset your password.';
        } else if (error.message.includes('verified')) {
          errorMessage = 'Please verify your email address before logging in. Check your inbox for a verification link.';
        } else {
          errorMessage = error.message;
        }
      }

      Alert.alert('Login Failed', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={style}>
      {/* Title and Subtitle */}
      <View style={styles.headerSection}>
        <Text style={styles.title}>
          Welcome back to <Text style={styles.titleAccent}>FitNEase</Text>
        </Text>
        <Text style={styles.subtitle}>
          Ready to continue your Tabata fitness journey?
        </Text>
      </View>

      {/* Verification Success Message */}
      {showVerificationMessage && (
        <View style={styles.verificationSuccess}>
          <View style={styles.successRow}>
            <Ionicons name="checkmark-circle" size={20} color="#10B981" />
            <Text style={styles.successText}>
              Email verified successfully! Please log in to continue.
            </Text>
          </View>
        </View>
      )}

      {/* Login Section */}
      <View style={styles.loginSection}>
        <Text style={styles.sectionTitle}>Sign In</Text>
        <Text style={styles.sectionSubtitle}>
          Enter your credentials to access your account.
        </Text>

        {/* Email */}
        <Input
          label="Email Address"
          placeholder="Your email address"
          value={email}
          onChangeText={setEmail}
          error={emailError}
          keyboardType="email-address"
          autoCapitalize="none"
          leftIcon={<Ionicons name="mail-outline" size={20} color={COLORS.SECONDARY[400]} />}
          style={styles.inputMargin}
        />

        {/* Password */}
        <Input
          label="Password"
          placeholder="Your password"
          value={password}
          onChangeText={setPassword}
          error={passwordError}
          secureTextEntry={!showPassword}
          leftIcon={<Ionicons name="lock-closed-outline" size={20} color={COLORS.SECONDARY[400]} />}
          rightIcon={
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Ionicons
                name={showPassword ? "eye-off-outline" : "eye-outline"}
                size={20}
                color={COLORS.SECONDARY[400]}
              />
            </TouchableOpacity>
          }
          style={styles.inputMargin}
        />

        {/* Forgot Password Link */}
        <TouchableOpacity onPress={onForgotPassword} style={styles.forgotPasswordContainer}>
          <Text style={styles.forgotPasswordText}>Forgot your password?</Text>
        </TouchableOpacity>

        {/* Sign In Button */}
        <View style={styles.submitContainer}>
          <Button
            title={isLoading ? "Signing In..." : "Sign In"}
            onPress={handleLogin}
            loading={isLoading}
            style={styles.submitButton}
            size="large"
          />
        </View>

        {/* Create Account Section */}
        <TouchableOpacity onPress={onCreateAccount} style={styles.createAccountContainer}>
          <Text style={styles.createAccountText}>
            Don&apos;t have an account?{' '}
            <Text style={styles.createAccountLink}>Sign Up</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = {
  headerSection: {
    marginBottom: 32,
  },
  title: {
    fontSize: 20,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
    marginBottom: 4,
    textAlign: 'center' as const,
  },
  titleAccent: {
    color: '#0091FF',
  },
  subtitle: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    lineHeight: 20,
    textAlign: 'center' as const,
  },
  verificationSuccess: {
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
    padding: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  successRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  successText: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.MEDIUM,
    color: '#059669',
    marginLeft: 8,
    flex: 1,
  },
  loginSection: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: FONTS.SEMIBOLD,
    color: '#0091FF',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[500],
    marginBottom: 24,
  },
  inputMargin: {
    marginBottom: 16,
  },
  forgotPasswordContainer: {
    alignSelf: 'flex-end' as const,
    marginBottom: 24,
  },
  forgotPasswordText: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: '#0091FF',
  },
  submitContainer: {
    marginBottom: 24,
  },
  submitButton: {
    backgroundColor: '#0091FF',
    shadowColor: '#0091FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  createAccountContainer: {
    alignItems: 'center' as const,
    marginTop: 16,
    paddingVertical: 8,
  },
  createAccountText: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    textAlign: 'center' as const,
  },
  createAccountLink: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.SEMIBOLD,
    color: '#0091FF',
  },
};