import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ScrollView,
  StatusBar,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { RoleCard, RoleData } from '../../components/auth/RoleCard';
import { Button } from '../../components/ui/Button';
import { rolesData } from '../../constants/rolesData';
import { COLORS } from '../../constants/colors';
import { FONTS } from '../../constants/fonts';

const { width, height } = Dimensions.get('window');
const CARD_WIDTH = width * 0.88;

export default function RoleSelection() {
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(rolesData[0].id);
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);

  const selectedRole = rolesData.find(role => role.id === selectedRoleId);

  useEffect(() => {
    if (rolesData.length > 0 && !selectedRoleId) {
      setSelectedRoleId(rolesData[0].id);
    }
  }, [selectedRoleId]);

  const handleCardPress = (role: RoleData, index: number) => {
    setSelectedRoleId(role.id);
    setCurrentIndex(index);
    scrollViewRef.current?.scrollTo({
      x: index * width,
      animated: true,
    });
  };

  const handleContinue = () => {
    if (!selectedRole) return;

    console.log('Selected role:', selectedRole);

    if (selectedRole.id === 'mentor') {
      router.push('/(auth)/register-mentor');
    } else {
      router.push({
        pathname: '/(auth)/register',
        params: { selectedRole: selectedRole.id }
      });
    }
  };

  const handleBackPress = () => {
    router.push('/(auth)/login');
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

      {/* Background Decoration */}
      <View style={styles.backgroundDecoration}>
        <View style={[styles.decorCircle, styles.decorCircle1]} />
        <View style={[styles.decorCircle, styles.decorCircle2]} />
      </View>

      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.SECONDARY[700]} />
          </TouchableOpacity>

          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Choose Your Role</Text>
            <Text style={styles.headerSubtitle}>
              How would you like to use FitNEase?
            </Text>
          </View>
        </View>

        {/* Page Indicators */}
        <View style={styles.indicatorsContainer}>
          {rolesData.map((role, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.indicator,
                index === currentIndex && styles.indicatorActive,
              ]}
              onPress={() => handleCardPress(role, index)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.indicatorText,
                index === currentIndex && styles.indicatorTextActive,
              ]}>
                {role.title}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Cards Container */}
        <View style={styles.cardsScrollContainer}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            snapToInterval={width}
            decelerationRate="fast"
            contentContainerStyle={styles.cardsContainer}
            style={styles.scrollView}
            onMomentumScrollEnd={(event) => {
              const newIndex = Math.round(event.nativeEvent.contentOffset.x / width);
              setCurrentIndex(newIndex);
              if (rolesData[newIndex]) {
                setSelectedRoleId(rolesData[newIndex].id);
              }
            }}
            ref={scrollViewRef}
          >
            {rolesData.map((role, index) => (
              <View key={role.id} style={styles.cardWrapper}>
                <RoleCard
                  role={role}
                  isSelected={selectedRoleId === role.id}
                  onPress={() => handleCardPress(role, index)}
                  width={CARD_WIDTH}
                />
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Bottom Action */}
        <View style={styles.bottomAction}>
          <TouchableOpacity
            style={[
              styles.continueButton,
              { backgroundColor: selectedRole?.primaryColor || COLORS.PRIMARY[600] }
            ]}
            onPress={handleContinue}
            disabled={!selectedRole}
            activeOpacity={0.9}
          >
            <Text style={styles.continueButtonText}>
              Continue as {selectedRole?.title || 'User'}
            </Text>
            <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
          </TouchableOpacity>

          <Text style={styles.helperText}>
            You can always change this later in settings
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  backgroundDecoration: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  decorCircle: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.5,
  },
  decorCircle1: {
    width: 300,
    height: 300,
    backgroundColor: COLORS.PRIMARY[100],
    top: -100,
    right: -100,
  },
  decorCircle2: {
    width: 200,
    height: 200,
    backgroundColor: '#D1FAE5',
    bottom: 100,
    left: -80,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.NEUTRAL.WHITE,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  headerTextContainer: {
    flex: 1,
    paddingTop: 2,
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 15,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[500],
  },
  indicatorsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 20,
    gap: 12,
  },
  indicator: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: COLORS.NEUTRAL.WHITE,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  indicatorActive: {
    backgroundColor: COLORS.PRIMARY[600],
  },
  indicatorText: {
    fontSize: 14,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[600],
  },
  indicatorTextActive: {
    color: COLORS.NEUTRAL.WHITE,
  },
  cardsScrollContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 16,
  },
  scrollView: {
    flexGrow: 0,
  },
  cardsContainer: {
    alignItems: 'center',
  },
  cardWrapper: {
    width: width,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  bottomAction: {
    paddingHorizontal: 24,
    paddingBottom: 20,
    paddingTop: 8,
    alignItems: 'center',
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 16,
    borderRadius: 14,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  continueButtonText: {
    fontSize: 16,
    fontFamily: FONTS.SEMIBOLD,
    color: '#FFFFFF',
  },
  helperText: {
    fontSize: 12,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[400],
    marginTop: 10,
  },
});
