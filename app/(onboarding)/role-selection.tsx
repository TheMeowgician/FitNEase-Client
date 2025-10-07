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

import { RoleCard, RoleData } from '../../components/auth/RoleCard';
import { Button } from '../../components/ui/Button';
import { rolesData } from '../../constants/rolesData';
import { COLORS } from '../../constants/colors';
import { FONTS } from '../../constants/fonts';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.85;

export default function RoleSelection() {
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(rolesData[0].id);
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);

  const selectedRole = rolesData.find(role => role.id === selectedRoleId);

  // Auto-select the first role on mount
  useEffect(() => {
    if (rolesData.length > 0 && !selectedRoleId) {
      setSelectedRoleId(rolesData[0].id);
    }
  }, [selectedRoleId]);

  const handleCardPress = (role: RoleData, index: number) => {
    setSelectedRoleId(role.id);
    setCurrentIndex(index);
    // Scroll to the selected card
    scrollViewRef.current?.scrollTo({
      x: index * width,
      animated: true,
    });
  };

  const handleContinue = () => {
    if (!selectedRole) return;

    console.log('Selected role:', selectedRole);

    // Navigate to the appropriate registration page based on role
    if (selectedRole.id === 'mentor') {
      router.push('/(auth)/register-mentor');
    } else {
      // Members go to regular registration (always set to beginner)
      router.push({
        pathname: '/(auth)/register',
        params: { selectedRole: selectedRole.id }
      });
    }
  };

  const handleBackPress = () => {
    router.push('/(auth)/login');
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
        backgroundColor={COLORS.NEUTRAL.WHITE}
        translucent={false}
      />

      {/* Header */}
      <View style={[
        styles.header,
        { paddingTop: Platform.OS === 'android' ? getStatusBarHeight() + 8 : 8 }
      ]}>
        <View style={styles.headerContent}>
          <Button
            title=""
            onPress={handleBackPress}
            variant="ghost"
            size="small"
            icon={<Ionicons name="arrow-back" size={24} color={COLORS.SECONDARY[700]} />}
            style={styles.backButton}
          />
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Choose Your Role</Text>
            <Text style={styles.headerSubtitle}>
              Select how you'd like to use FitNEase for Tabata training
            </Text>
          </View>
        </View>
      </View>

      {/* Main Content */}
      <View style={styles.mainContent}>
        {/* Page Indicators */}
        <View style={styles.indicatorsContainer}>
          {rolesData.map((role, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.indicator,
                {
                  backgroundColor: index === currentIndex
                    ? COLORS.PRIMARY[600]
                    : COLORS.SECONDARY[300],
                },
              ]}
              onPress={() => handleCardPress(role, index)}
              activeOpacity={0.7}
            />
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
              // Auto-select the card being viewed
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
      </View>

      {/* Bottom Action */}
      <View style={styles.bottomAction}>
        <Button
          title={`Continue as ${selectedRole?.title || 'User'}`}
          onPress={handleContinue}
          disabled={!selectedRole}
          size="large"
          style={{
            ...styles.continueButton,
            backgroundColor: selectedRole ? COLORS.PRIMARY[600] : COLORS.SECONDARY[300],
            shadowColor: selectedRole ? COLORS.PRIMARY[600] : 'transparent',
          }}
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
  header: {
    paddingHorizontal: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  backButton: {
    width: 40,
    height: 40,
    marginRight: 12,
    marginTop: 4,
  },
  headerTextContainer: {
    flex: 1,
    paddingRight: 52, // Account for back button width
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    lineHeight: 24,
  },
  mainContent: {
    flex: 1,
    paddingTop: 20,
  },
  indicatorsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  cardsScrollContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  scrollView: {
    flexGrow: 0,
    height: 500, // Fixed height to center the scroll area
  },
  cardsContainer: {
    alignItems: 'center',
  },
  cardWrapper: {
    width: width,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomAction: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 16,
  },
  continueButton: {
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});