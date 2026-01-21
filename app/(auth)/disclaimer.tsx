import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import { FONTS } from '../../constants/fonts';
import { useAlert } from '../../contexts/AlertContext';
import { authService } from '../../services/microservices/authService';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

const DISCLAIMER_KEY = '@fitnease_disclaimer_accepted';

export default function DisclaimerScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const alert = useAlert();
  const [isAcknowledged, setIsAcknowledged] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleContinue = async () => {
    if (!isAcknowledged) {
      alert.warning('Acknowledgment Required', 'Please read and acknowledge the disclaimer to continue.');
      return;
    }

    setIsLoading(true);
    try {
      // Store disclaimer acceptance locally
      await AsyncStorage.setItem(DISCLAIMER_KEY, JSON.stringify({
        accepted: true,
        acceptedAt: new Date().toISOString(),
      }));

      // Try to update user profile with disclaimer acceptance
      try {
        await authService.updateUserProfile({
          disclaimer_accepted: true,
          disclaimer_accepted_at: new Date().toISOString(),
        });
      } catch (error) {
        // If not logged in yet, that's okay - we stored it locally
        console.log('Could not update profile (user may not be fully authenticated yet)');
      }

      // Navigate to email verification or onboarding
      if (params.email) {
        router.replace({
          pathname: '/(auth)/verify-email',
          params: { email: params.email }
        });
      } else {
        router.replace('/(onboarding)/welcome');
      }
    } catch (error) {
      console.error('Error saving disclaimer acceptance:', error);
      alert.error('Error', 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Icon */}
        <View style={styles.iconContainer}>
          <View style={styles.iconCircle}>
            <Ionicons name="warning" size={48} color={COLORS.WARNING[500]} />
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>Important Health Disclaimer</Text>
        <Text style={styles.subtitle}>Please read carefully before proceeding</Text>

        {/* Disclaimer Content */}
        <View style={styles.disclaimerCard}>
          {/* HIIT Warning */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="fitness" size={24} color={COLORS.PRIMARY[600]} />
              <Text style={styles.sectionTitle}>High-Intensity Training</Text>
            </View>
            <Text style={styles.sectionText}>
              FitNEase utilizes <Text style={styles.bold}>Tabata training</Text>, a form of
              High-Intensity Interval Training (HIIT). This type of exercise involves short
              bursts of intense activity followed by brief rest periods, which places
              significant demands on your cardiovascular system.
            </Text>
          </View>

          {/* Medical Consultation */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="medkit" size={24} color={COLORS.ERROR[500]} />
              <Text style={styles.sectionTitle}>Medical Consultation Required</Text>
            </View>
            <Text style={styles.sectionText}>
              Before starting any high-intensity exercise program, we <Text style={styles.bold}>strongly recommend</Text> that you:
            </Text>
            <View style={styles.bulletPoints}>
              <View style={styles.bulletItem}>
                <Ionicons name="checkmark-circle" size={18} color={COLORS.SUCCESS[500]} />
                <Text style={styles.bulletText}>Consult with your doctor or healthcare provider</Text>
              </View>
              <View style={styles.bulletItem}>
                <Ionicons name="checkmark-circle" size={18} color={COLORS.SUCCESS[500]} />
                <Text style={styles.bulletText}>Obtain medical clearance for high-intensity exercise</Text>
              </View>
              <View style={styles.bulletItem}>
                <Ionicons name="checkmark-circle" size={18} color={COLORS.SUCCESS[500]} />
                <Text style={styles.bulletText}>Discuss any pre-existing health conditions</Text>
              </View>
              <View style={styles.bulletItem}>
                <Ionicons name="checkmark-circle" size={18} color={COLORS.SUCCESS[500]} />
                <Text style={styles.bulletText}>Understand your physical limitations</Text>
              </View>
            </View>
          </View>

          {/* Who Should Not Use */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="alert-circle" size={24} color={COLORS.WARNING[500]} />
              <Text style={styles.sectionTitle}>Important Considerations</Text>
            </View>
            <Text style={styles.sectionText}>
              High-intensity training may not be suitable for individuals with:
            </Text>
            <View style={styles.bulletPoints}>
              <View style={styles.bulletItem}>
                <Ionicons name="close-circle" size={18} color={COLORS.ERROR[500]} />
                <Text style={styles.bulletText}>Heart conditions or cardiovascular disease</Text>
              </View>
              <View style={styles.bulletItem}>
                <Ionicons name="close-circle" size={18} color={COLORS.ERROR[500]} />
                <Text style={styles.bulletText}>High blood pressure (uncontrolled)</Text>
              </View>
              <View style={styles.bulletItem}>
                <Ionicons name="close-circle" size={18} color={COLORS.ERROR[500]} />
                <Text style={styles.bulletText}>Joint or bone problems</Text>
              </View>
              <View style={styles.bulletItem}>
                <Ionicons name="close-circle" size={18} color={COLORS.ERROR[500]} />
                <Text style={styles.bulletText}>Pregnancy or recent surgery</Text>
              </View>
              <View style={styles.bulletItem}>
                <Ionicons name="close-circle" size={18} color={COLORS.ERROR[500]} />
                <Text style={styles.bulletText}>Other medical conditions affecting exercise ability</Text>
              </View>
            </View>
          </View>

          {/* Target Audience */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="people" size={24} color={COLORS.PRIMARY[600]} />
              <Text style={styles.sectionTitle}>Intended Users</Text>
            </View>
            <Text style={styles.sectionText}>
              This application is designed for <Text style={styles.bold}>fitness enthusiasts aged 18-54</Text> who:
            </Text>
            <View style={styles.bulletPoints}>
              <View style={styles.bulletItem}>
                <Ionicons name="checkmark-circle" size={18} color={COLORS.SUCCESS[500]} />
                <Text style={styles.bulletText}>Are in good general health</Text>
              </View>
              <View style={styles.bulletItem}>
                <Ionicons name="checkmark-circle" size={18} color={COLORS.SUCCESS[500]} />
                <Text style={styles.bulletText}>Have received medical clearance for intense exercise</Text>
              </View>
              <View style={styles.bulletItem}>
                <Ionicons name="checkmark-circle" size={18} color={COLORS.SUCCESS[500]} />
                <Text style={styles.bulletText}>Understand the risks of high-intensity training</Text>
              </View>
              <View style={styles.bulletItem}>
                <Ionicons name="checkmark-circle" size={18} color={COLORS.SUCCESS[500]} />
                <Text style={styles.bulletText}>Are committed to exercising responsibly</Text>
              </View>
            </View>
          </View>

          {/* Liability */}
          <View style={[styles.section, styles.lastSection]}>
            <View style={styles.sectionHeader}>
              <Ionicons name="document-text" size={24} color={COLORS.NEUTRAL[600]} />
              <Text style={styles.sectionTitle}>Assumption of Risk</Text>
            </View>
            <Text style={styles.sectionText}>
              By using FitNEase, you acknowledge that you understand the risks associated
              with high-intensity interval training and accept full responsibility for
              your health and safety during exercise. The developers of this application
              are not liable for any injuries or health issues that may occur.
            </Text>
          </View>
        </View>

        {/* Acknowledgment Checkbox */}
        <TouchableOpacity
          style={styles.checkboxContainer}
          onPress={() => setIsAcknowledged(!isAcknowledged)}
          activeOpacity={0.7}
        >
          <View style={[styles.checkbox, isAcknowledged && styles.checkboxChecked]}>
            {isAcknowledged && (
              <Ionicons name="checkmark" size={18} color={COLORS.NEUTRAL.WHITE} />
            )}
          </View>
          <Text style={styles.checkboxLabel}>
            I have read and understood the above disclaimer. I confirm that I am in good
            health and have consulted with a healthcare provider regarding my fitness for
            high-intensity exercise.
          </Text>
        </TouchableOpacity>

        {/* Continue Button */}
        <TouchableOpacity
          style={[
            styles.continueButton,
            !isAcknowledged && styles.continueButtonDisabled
          ]}
          onPress={handleContinue}
          disabled={!isAcknowledged || isLoading}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <Text style={styles.continueButtonText}>Processing...</Text>
          ) : (
            <>
              <Text style={styles.continueButtonText}>I Understand & Agree</Text>
              <Ionicons name="arrow-forward" size={20} color={COLORS.NEUTRAL.WHITE} />
            </>
          )}
        </TouchableOpacity>

        {/* Footer Note */}
        <Text style={styles.footerNote}>
          If you experience any discomfort, dizziness, or pain during exercise,
          stop immediately and seek medical attention.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.NEUTRAL[50],
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 40,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: COLORS.WARNING[50],
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: COLORS.WARNING[200],
  },
  title: {
    fontSize: 26,
    fontFamily: FONTS.BOLD,
    color: COLORS.NEUTRAL[900],
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: FONTS.REGULAR,
    color: COLORS.NEUTRAL[500],
    textAlign: 'center',
    marginBottom: 24,
  },
  disclaimerCard: {
    backgroundColor: COLORS.NEUTRAL.WHITE,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.NEUTRAL[100],
  },
  lastSection: {
    marginBottom: 0,
    paddingBottom: 0,
    borderBottomWidth: 0,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.NEUTRAL[800],
    flex: 1,
  },
  sectionText: {
    fontSize: 15,
    fontFamily: FONTS.REGULAR,
    color: COLORS.NEUTRAL[600],
    lineHeight: 24,
  },
  bold: {
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.NEUTRAL[800],
  },
  bulletPoints: {
    marginTop: 12,
    gap: 10,
  },
  bulletItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  bulletText: {
    fontSize: 14,
    fontFamily: FONTS.REGULAR,
    color: COLORS.NEUTRAL[600],
    flex: 1,
    lineHeight: 20,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.PRIMARY[50],
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.PRIMARY[200],
    gap: 12,
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.PRIMARY[400],
    backgroundColor: COLORS.NEUTRAL.WHITE,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: COLORS.PRIMARY[600],
    borderColor: COLORS.PRIMARY[600],
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 14,
    fontFamily: FONTS.REGULAR,
    color: COLORS.NEUTRAL[700],
    lineHeight: 22,
  },
  continueButton: {
    backgroundColor: COLORS.PRIMARY[600],
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    shadowColor: COLORS.PRIMARY[600],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  continueButtonDisabled: {
    backgroundColor: COLORS.NEUTRAL[300],
    shadowOpacity: 0,
    elevation: 0,
  },
  continueButtonText: {
    fontSize: 17,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.NEUTRAL.WHITE,
  },
  footerNote: {
    fontSize: 13,
    fontFamily: FONTS.REGULAR,
    color: COLORS.NEUTRAL[500],
    textAlign: 'center',
    marginTop: 20,
    lineHeight: 20,
    paddingHorizontal: 16,
  },
});
