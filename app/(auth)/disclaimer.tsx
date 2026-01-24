import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  BackHandler,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import { FONTS } from '../../constants/fonts';
import { useAlert } from '../../contexts/AlertContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DISCLAIMER_KEY = '@fitnease_disclaimer_accepted';
const SUPPORT_EMAIL = 'support.recoders@gmail.com';

export default function DisclaimerScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const alert = useAlert();
  const [isAcknowledged, setIsAcknowledged] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeSection, setActiveSection] = useState<'terms' | 'privacy'>('terms');

  const handleContinue = async () => {
    if (!isAcknowledged) {
      alert.warning('Acknowledgment Required', 'Please read and acknowledge the Terms of Use and Privacy Policy to continue.');
      return;
    }

    setIsLoading(true);
    try {
      // Store disclaimer acceptance locally
      await AsyncStorage.setItem(DISCLAIMER_KEY, JSON.stringify({
        accepted: true,
        acceptedAt: new Date().toISOString(),
      }));

      // Disclaimer acceptance is stored locally above
      // The user profile doesn't have disclaimer fields, so we skip the API update

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

  const handleExitApp = () => {
    alert.confirm(
      'Exit Application',
      'You must accept the Terms of Use and Privacy Policy to use FitNEase. Are you sure you want to exit?',
      () => {
        BackHandler.exitApp();
      },
      undefined,
      'Exit',
      'Cancel'
    );
  };

  const handleContactSupport = () => {
    Linking.openURL(`mailto:${SUPPORT_EMAIL}`);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconCircle}>
            <Ionicons name="document-text" size={40} color={COLORS.PRIMARY[600]} />
          </View>
          <Text style={styles.title}>Terms of Use & Privacy Policy</Text>
          <Text style={styles.subtitle}>FitNEase - Last Updated: January 20, 2026</Text>
        </View>

        {/* Section Tabs */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeSection === 'terms' && styles.tabActive]}
            onPress={() => setActiveSection('terms')}
          >
            <Ionicons
              name="document"
              size={18}
              color={activeSection === 'terms' ? COLORS.PRIMARY[600] : COLORS.NEUTRAL[500]}
            />
            <Text style={[styles.tabText, activeSection === 'terms' && styles.tabTextActive]}>
              Terms of Use
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeSection === 'privacy' && styles.tabActive]}
            onPress={() => setActiveSection('privacy')}
          >
            <Ionicons
              name="shield-checkmark"
              size={18}
              color={activeSection === 'privacy' ? COLORS.PRIMARY[600] : COLORS.NEUTRAL[500]}
            />
            <Text style={[styles.tabText, activeSection === 'privacy' && styles.tabTextActive]}>
              Privacy Policy
            </Text>
          </TouchableOpacity>
        </View>

        {/* Terms of Use Section */}
        {activeSection === 'terms' && (
          <View style={styles.contentCard}>
            {/* Acceptance */}
            <View style={styles.section}>
              <Text style={styles.sectionNumber}>1</Text>
              <View style={styles.sectionContent}>
                <Text style={styles.sectionTitle}>Acceptance of Terms</Text>
                <Text style={styles.sectionText}>
                  By downloading, installing, or using the FitNEase application, you agree to be
                  bound by these Terms of Use and Privacy Policy. If you do not agree to these
                  terms, you must discontinue use and uninstall the App immediately.
                </Text>
              </View>
            </View>

            {/* Medical Disclaimer */}
            <View style={styles.section}>
              <Text style={styles.sectionNumber}>2</Text>
              <View style={styles.sectionContent}>
                <Text style={styles.sectionTitle}>Medical Disclaimer & User Responsibility</Text>

                <View style={styles.subsection}>
                  <Text style={styles.subsectionTitle}>2.1 Research-Based Content</Text>
                  <Text style={styles.sectionText}>
                    The fitness programs, exercises, and health information provided within FitNEase
                    are developed based on research data and advice from professionals. However, this
                    content is for educational and informational purposes only and is{' '}
                    <Text style={styles.bold}>not a substitute for professional medical advice</Text>.
                  </Text>
                </View>

                <View style={styles.subsection}>
                  <Text style={styles.subsectionTitle}>2.2 Target Audience & User Representation</Text>
                  <Text style={styles.sectionText}>
                    By continuing to use this App, you represent and warrant that you are a{' '}
                    <Text style={styles.bold}>fitness enthusiast aged 18-54</Text> with sufficient
                    prior knowledge of physical exercise. You acknowledge that you possess the
                    experience to execute workouts safely and monitor your physical limits.
                  </Text>
                </View>

                <View style={styles.subsection}>
                  <Text style={styles.subsectionTitle}>2.3 Voluntary Assumption of Risk</Text>
                  <Text style={styles.sectionText}>
                    You understand that exercises (including HIIT and Tabata) carry inherent risks
                    of physical injury. You agree that:
                  </Text>
                  <View style={styles.bulletPoints}>
                    <View style={styles.bulletItem}>
                      <Ionicons name="alert-circle" size={16} color={COLORS.WARNING[500]} />
                      <Text style={styles.bulletText}>
                        You are participating entirely at your own risk
                      </Text>
                    </View>
                    <View style={styles.bulletItem}>
                      <Ionicons name="alert-circle" size={16} color={COLORS.WARNING[500]} />
                      <Text style={styles.bulletText}>
                        You may discontinue use at any moment if you feel discomfort
                      </Text>
                    </View>
                    <View style={styles.bulletItem}>
                      <Ionicons name="alert-circle" size={16} color={COLORS.WARNING[500]} />
                      <Text style={styles.bulletText}>
                        FitNEase assumes no responsibility for injuries sustained while using the App
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.subsection}>
                  <Text style={styles.subsectionTitle}>2.4 Waiver of Liability</Text>
                  <Text style={styles.sectionText}>
                    You hereby release, waive, and discharge FitNEase, its owners, and developers
                    from any and all liability arising out of your use of the App. Your health
                    risks are your sole responsibility.
                  </Text>
                </View>
              </View>
            </View>

            {/* Intellectual Property */}
            <View style={styles.section}>
              <Text style={styles.sectionNumber}>3</Text>
              <View style={styles.sectionContent}>
                <Text style={styles.sectionTitle}>Intellectual Property</Text>
                <Text style={styles.sectionText}>
                  All content within FitNEase, including text, graphics, logos, code, and exercise
                  compilations, is the intellectual property of the FitNEase development team.
                  You are granted a limited license for personal use only. You may not copy,
                  distribute, or reverse-engineer the App.
                </Text>
              </View>
            </View>

            {/* Contact */}
            <View style={[styles.section, styles.lastSection]}>
              <Text style={styles.sectionNumber}>4</Text>
              <View style={styles.sectionContent}>
                <Text style={styles.sectionTitle}>Contact Us</Text>
                <Text style={styles.sectionText}>
                  If you have questions about these Terms, please contact our Data Protection
                  Officer at:
                </Text>
                <TouchableOpacity style={styles.emailButton} onPress={handleContactSupport}>
                  <Ionicons name="mail" size={18} color={COLORS.PRIMARY[600]} />
                  <Text style={styles.emailText}>{SUPPORT_EMAIL}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Privacy Policy Section */}
        {activeSection === 'privacy' && (
          <View style={styles.contentCard}>
            {/* Intro */}
            <View style={styles.privacyIntro}>
              <Ionicons name="shield-checkmark" size={24} color={COLORS.SUCCESS[500]} />
              <Text style={styles.privacyIntroText}>
                We are committed to protecting your personal data in compliance with the{' '}
                <Text style={styles.bold}>Data Privacy Act of 2012 (RA 10173)</Text>.
              </Text>
            </View>

            {/* Collection of Data */}
            <View style={styles.section}>
              <Text style={styles.sectionNumber}>1</Text>
              <View style={styles.sectionContent}>
                <Text style={styles.sectionTitle}>Collection of Data</Text>
                <Text style={styles.sectionText}>
                  We collect only information necessary to provide App functions:
                </Text>
                <View style={styles.dataList}>
                  <View style={styles.dataItem}>
                    <View style={styles.dataIcon}>
                      <Ionicons name="person" size={16} color={COLORS.PRIMARY[600]} />
                    </View>
                    <View style={styles.dataInfo}>
                      <Text style={styles.dataLabel}>Personal Information</Text>
                      <Text style={styles.dataDesc}>Name, age, gender (for profile creation)</Text>
                    </View>
                  </View>
                  <View style={styles.dataItem}>
                    <View style={styles.dataIcon}>
                      <Ionicons name="fitness" size={16} color={COLORS.PRIMARY[600]} />
                    </View>
                    <View style={styles.dataInfo}>
                      <Text style={styles.dataLabel}>Health Information</Text>
                      <Text style={styles.dataDesc}>Height, weight, fitness metrics (for workout data)</Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>

            {/* Use of Data */}
            <View style={styles.section}>
              <Text style={styles.sectionNumber}>2</Text>
              <View style={styles.sectionContent}>
                <Text style={styles.sectionTitle}>Use of Data</Text>
                <Text style={styles.sectionText}>Your data is processed solely for:</Text>
                <View style={styles.bulletPoints}>
                  <View style={styles.bulletItem}>
                    <Ionicons name="checkmark-circle" size={16} color={COLORS.SUCCESS[500]} />
                    <Text style={styles.bulletText}>Calculating fitness metrics (BMI, calorie burn)</Text>
                  </View>
                  <View style={styles.bulletItem}>
                    <Ionicons name="checkmark-circle" size={16} color={COLORS.SUCCESS[500]} />
                    <Text style={styles.bulletText}>Tracking your workout progress</Text>
                  </View>
                  <View style={styles.bulletItem}>
                    <Ionicons name="checkmark-circle" size={16} color={COLORS.SUCCESS[500]} />
                    <Text style={styles.bulletText}>Improving functionality and user experience</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Data Protection */}
            <View style={styles.section}>
              <Text style={styles.sectionNumber}>3</Text>
              <View style={styles.sectionContent}>
                <Text style={styles.sectionTitle}>Data Protection & Security</Text>
                <Text style={styles.sectionText}>
                  We implement strict security measures:
                </Text>
                <View style={styles.securityList}>
                  <View style={styles.securityItem}>
                    <View style={styles.securityIconContainer}>
                      <Ionicons name="lock-closed" size={20} color={COLORS.SUCCESS[600]} />
                    </View>
                    <View style={styles.securityInfo}>
                      <Text style={styles.securityTitle}>Data Encryption</Text>
                      <Text style={styles.securityDesc}>
                        All sensitive data encrypted in transit and at rest (AES-256, SSL/TLS)
                      </Text>
                    </View>
                  </View>
                  <View style={styles.securityItem}>
                    <View style={styles.securityIconContainer}>
                      <Ionicons name="eye-off" size={20} color={COLORS.SUCCESS[600]} />
                    </View>
                    <View style={styles.securityInfo}>
                      <Text style={styles.securityTitle}>Data Anonymization</Text>
                      <Text style={styles.securityDesc}>
                        Research data stripped of personally identifiable information
                      </Text>
                    </View>
                  </View>
                  <View style={styles.securityItem}>
                    <View style={styles.securityIconContainer}>
                      <Ionicons name="key" size={20} color={COLORS.SUCCESS[600]} />
                    </View>
                    <View style={styles.securityInfo}>
                      <Text style={styles.securityTitle}>Access Control</Text>
                      <Text style={styles.securityDesc}>
                        Access limited to authorized personnel only
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>

            {/* Data Retention */}
            <View style={styles.section}>
              <Text style={styles.sectionNumber}>4</Text>
              <View style={styles.sectionContent}>
                <Text style={styles.sectionTitle}>Data Retention & Disposal</Text>
                <View style={styles.bulletPoints}>
                  <View style={styles.bulletItem}>
                    <Ionicons name="time" size={16} color={COLORS.PRIMARY[600]} />
                    <Text style={styles.bulletText}>
                      Data retained only while your account is active
                    </Text>
                  </View>
                  <View style={styles.bulletItem}>
                    <Ionicons name="warning" size={16} color={COLORS.WARNING[500]} />
                    <Text style={styles.bulletText}>
                      Inactive accounts may be deleted after 1 year
                    </Text>
                  </View>
                  <View style={styles.bulletItem}>
                    <Ionicons name="trash" size={16} color={COLORS.ERROR[500]} />
                    <Text style={styles.bulletText}>
                      Upon deletion, all personal data permanently removed
                    </Text>
                  </View>
                  <View style={styles.bulletItem}>
                    <Ionicons name="school" size={16} color={COLORS.NEUTRAL[600]} />
                    <Text style={styles.bulletText}>
                      Research exception: Anonymized data may be retained for academic purposes
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Rights */}
            <View style={[styles.section, styles.lastSection]}>
              <Text style={styles.sectionNumber}>5</Text>
              <View style={styles.sectionContent}>
                <Text style={styles.sectionTitle}>Your Rights (Data Privacy Act 2012)</Text>
                <View style={styles.rightsGrid}>
                  <View style={styles.rightItem}>
                    <Ionicons name="eye" size={24} color={COLORS.PRIMARY[600]} />
                    <Text style={styles.rightTitle}>Access</Text>
                    <Text style={styles.rightDesc}>View your personal data in your profile</Text>
                  </View>
                  <View style={styles.rightItem}>
                    <Ionicons name="create" size={24} color={COLORS.PRIMARY[600]} />
                    <Text style={styles.rightTitle}>Rectification</Text>
                    <Text style={styles.rightDesc}>Correct or update inaccurate information</Text>
                  </View>
                  <View style={styles.rightItem}>
                    <Ionicons name="trash-bin" size={24} color={COLORS.PRIMARY[600]} />
                    <Text style={styles.rightTitle}>Erasure</Text>
                    <Text style={styles.rightDesc}>Request deletion of your account and data</Text>
                  </View>
                  <View style={styles.rightItem}>
                    <Ionicons name="information-circle" size={24} color={COLORS.PRIMARY[600]} />
                    <Text style={styles.rightTitle}>Be Informed</Text>
                    <Text style={styles.rightDesc}>Know how your data is processed</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        )}

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
            I have read, understood, and accepted the{' '}
            <Text style={styles.bold}>Terms of Use and Privacy Policy</Text>. I confirm that
            I am a fitness enthusiast in good health and voluntarily assume all risks associated
            with using this application.
          </Text>
        </TouchableOpacity>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
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
                <Ionicons name="checkmark-circle" size={22} color={COLORS.NEUTRAL.WHITE} />
                <Text style={styles.continueButtonText}>I Agree & Continue</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.exitButton}
            onPress={handleExitApp}
            activeOpacity={0.8}
          >
            <Ionicons name="exit-outline" size={20} color={COLORS.ERROR[600]} />
            <Text style={styles.exitButtonText}>Exit App</Text>
          </TouchableOpacity>
        </View>

        {/* Footer Note */}
        <Text style={styles.footerNote}>
          If you experience any discomfort during exercise, stop immediately and seek medical attention.
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
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.PRIMARY[50],
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.PRIMARY[200],
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontFamily: FONTS.BOLD,
    color: COLORS.NEUTRAL[900],
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    fontFamily: FONTS.REGULAR,
    color: COLORS.NEUTRAL[500],
    textAlign: 'center',
    marginTop: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.NEUTRAL[100],
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  tabActive: {
    backgroundColor: COLORS.NEUTRAL.WHITE,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.NEUTRAL[500],
  },
  tabTextActive: {
    color: COLORS.PRIMARY[600],
    fontFamily: FONTS.SEMIBOLD,
  },
  contentCard: {
    backgroundColor: COLORS.NEUTRAL.WHITE,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  section: {
    flexDirection: 'row',
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.NEUTRAL[100],
  },
  lastSection: {
    marginBottom: 0,
    paddingBottom: 0,
    borderBottomWidth: 0,
  },
  sectionNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.PRIMARY[100],
    color: COLORS.PRIMARY[700],
    fontSize: 14,
    fontFamily: FONTS.BOLD,
    textAlign: 'center',
    lineHeight: 28,
    marginRight: 12,
  },
  sectionContent: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.NEUTRAL[800],
    marginBottom: 8,
  },
  sectionText: {
    fontSize: 14,
    fontFamily: FONTS.REGULAR,
    color: COLORS.NEUTRAL[600],
    lineHeight: 22,
  },
  bold: {
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.NEUTRAL[800],
  },
  subsection: {
    marginTop: 14,
  },
  subsectionTitle: {
    fontSize: 14,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.NEUTRAL[700],
    marginBottom: 6,
  },
  bulletPoints: {
    marginTop: 10,
    gap: 8,
  },
  bulletItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bulletText: {
    fontSize: 13,
    fontFamily: FONTS.REGULAR,
    color: COLORS.NEUTRAL[600],
    flex: 1,
    lineHeight: 20,
  },
  emailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    backgroundColor: COLORS.PRIMARY[50],
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  emailText: {
    fontSize: 14,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.PRIMARY[600],
  },
  privacyIntro: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.SUCCESS[50],
    padding: 14,
    borderRadius: 12,
    marginBottom: 20,
    gap: 12,
  },
  privacyIntroText: {
    flex: 1,
    fontSize: 14,
    fontFamily: FONTS.REGULAR,
    color: COLORS.NEUTRAL[700],
    lineHeight: 20,
  },
  dataList: {
    marginTop: 12,
    gap: 12,
  },
  dataItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.NEUTRAL[50],
    padding: 12,
    borderRadius: 10,
    gap: 12,
  },
  dataIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.PRIMARY[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  dataInfo: {
    flex: 1,
  },
  dataLabel: {
    fontSize: 14,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.NEUTRAL[800],
  },
  dataDesc: {
    fontSize: 12,
    fontFamily: FONTS.REGULAR,
    color: COLORS.NEUTRAL[500],
    marginTop: 2,
  },
  securityList: {
    marginTop: 12,
    gap: 12,
  },
  securityItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  securityIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.SUCCESS[50],
    justifyContent: 'center',
    alignItems: 'center',
  },
  securityInfo: {
    flex: 1,
  },
  securityTitle: {
    fontSize: 14,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.NEUTRAL[800],
  },
  securityDesc: {
    fontSize: 13,
    fontFamily: FONTS.REGULAR,
    color: COLORS.NEUTRAL[600],
    marginTop: 2,
    lineHeight: 18,
  },
  rightsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    gap: 12,
  },
  rightItem: {
    width: '47%',
    backgroundColor: COLORS.PRIMARY[50],
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  rightTitle: {
    fontSize: 14,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.NEUTRAL[800],
    marginTop: 8,
    textAlign: 'center',
  },
  rightDesc: {
    fontSize: 12,
    fontFamily: FONTS.REGULAR,
    color: COLORS.NEUTRAL[600],
    marginTop: 4,
    textAlign: 'center',
    lineHeight: 16,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.PRIMARY[50],
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
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
  buttonContainer: {
    gap: 12,
  },
  continueButton: {
    backgroundColor: COLORS.PRIMARY[600],
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
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
  exitButton: {
    backgroundColor: COLORS.NEUTRAL.WHITE,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.ERROR[200],
  },
  exitButtonText: {
    fontSize: 15,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.ERROR[600],
  },
  footerNote: {
    fontSize: 12,
    fontFamily: FONTS.REGULAR,
    color: COLORS.NEUTRAL[500],
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 18,
    paddingHorizontal: 16,
  },
});
