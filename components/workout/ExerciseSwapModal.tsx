/**
 * ExerciseSwapModal Component
 *
 * Modal for swapping exercises during workout customization.
 * Available for Advanced and Mentor level users.
 *
 * Features:
 * - Shows current exercise to be swapped
 * - Displays list of ML-curated alternatives
 * - Allows selecting a replacement exercise
 * - Shows exercise details (muscle group, difficulty, calories)
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS } from '../../constants/colors';

const { width, height } = Dimensions.get('window');

// Exercise interface matching MLRecommendation
interface Exercise {
  exercise_id: number;
  exercise_name: string;
  difficulty_level: number;
  target_muscle_group: string;
  default_duration_seconds?: number;
  estimated_calories_burned?: number;
  equipment_needed?: string;
  exercise_category?: string;
}

interface ExerciseSwapModalProps {
  visible: boolean;
  currentExercise: Exercise | null;
  alternatives: Exercise[];
  onSwap: (newExercise: Exercise) => void;
  onClose: () => void;
}

export const ExerciseSwapModal: React.FC<ExerciseSwapModalProps> = ({
  visible,
  currentExercise,
  alternatives,
  onSwap,
  onClose,
}) => {
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);

  // Animation values
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(height)).current;

  // Reset selection when modal opens
  useEffect(() => {
    if (visible) {
      setSelectedExercise(null);
      // Reset and animate in
      backdropOpacity.setValue(0);
      slideAnim.setValue(height);

      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          damping: 20,
          stiffness: 150,
          mass: 1,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: height,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setSelectedExercise(null);
      onClose();
    });
  };

  const handleSwap = () => {
    if (selectedExercise) {
      onSwap(selectedExercise);
      handleClose();
    }
  };

  const getDifficultyText = (level: number) => {
    switch (level) {
      case 1: return 'Beginner';
      case 2: return 'Intermediate';
      case 3: return 'Advanced';
      default: return 'Beginner';
    }
  };

  const getDifficultyColor = (level: number) => {
    switch (level) {
      case 1: return '#10B981'; // green
      case 2: return '#F59E0B'; // orange
      case 3: return '#EF4444'; // red
      default: return '#6B7280';
    }
  };

  const formatMuscleGroup = (group: string) => {
    if (!group) return 'Core';
    return group
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  if (!currentExercise) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.modalOverlay}>
        {/* Animated Backdrop */}
        <Animated.View
          style={[
            styles.backdrop,
            { opacity: backdropOpacity },
          ]}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={handleClose}
          />
        </Animated.View>

        {/* Modal Content */}
        <Animated.View
          style={[
            styles.modalContainer,
            { transform: [{ translateY: slideAnim }] },
          ]}
        >
          {/* Handle Bar */}
          <View style={styles.handleContainer}>
            <View style={styles.handleBar} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.swapIcon}>
                <Ionicons name="swap-horizontal" size={24} color={COLORS.PRIMARY[600]} />
              </View>
              <View>
                <Text style={styles.headerTitle}>Swap Exercise</Text>
                <Text style={styles.headerSubtitle}>Choose an alternative exercise</Text>
              </View>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close-circle" size={28} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          {/* Current Exercise Card */}
          <View style={styles.currentExerciseSection}>
            <Text style={styles.sectionLabel}>Current Exercise</Text>
            <View style={styles.currentExerciseCard}>
              <View style={styles.exerciseInfo}>
                <Text style={styles.currentExerciseName}>{currentExercise.exercise_name}</Text>
                <View style={styles.exerciseDetails}>
                  <View style={styles.detailTag}>
                    <Ionicons name="body-outline" size={14} color={COLORS.SECONDARY[600]} />
                    <Text style={styles.detailText}>{formatMuscleGroup(currentExercise.target_muscle_group)}</Text>
                  </View>
                  <View style={[styles.detailTag, { backgroundColor: getDifficultyColor(currentExercise.difficulty_level) + '15' }]}>
                    <Text style={[styles.detailText, { color: getDifficultyColor(currentExercise.difficulty_level) }]}>
                      {getDifficultyText(currentExercise.difficulty_level)}
                    </Text>
                  </View>
                </View>
              </View>
              <View style={styles.swapArrow}>
                <Ionicons name="arrow-forward" size={20} color={COLORS.SECONDARY[400]} />
              </View>
            </View>
          </View>

          {/* Alternatives List */}
          <View style={styles.alternativesSection}>
            <Text style={styles.sectionLabel}>
              Select Alternative ({alternatives.length} available)
            </Text>
            <ScrollView
              style={styles.alternativesList}
              showsVerticalScrollIndicator={true}
            >
              {alternatives.length === 0 ? (
                <View style={styles.noAlternatives}>
                  <Ionicons name="information-circle-outline" size={48} color={COLORS.SECONDARY[400]} />
                  <Text style={styles.noAlternativesText}>No alternatives available</Text>
                  <Text style={styles.noAlternativesSubtext}>Try refreshing recommendations</Text>
                </View>
              ) : (
                alternatives.map((exercise) => {
                  const isSelected = selectedExercise?.exercise_id === exercise.exercise_id;
                  return (
                    <TouchableOpacity
                      key={exercise.exercise_id}
                      style={[
                        styles.alternativeCard,
                        isSelected && styles.alternativeCardSelected,
                      ]}
                      onPress={() => setSelectedExercise(exercise)}
                      activeOpacity={0.7}
                    >
                      {/* Selection indicator */}
                      <View style={[
                        styles.selectionIndicator,
                        isSelected && styles.selectionIndicatorSelected,
                      ]}>
                        {isSelected && (
                          <Ionicons name="checkmark" size={16} color="white" />
                        )}
                      </View>

                      {/* Exercise details */}
                      <View style={styles.alternativeInfo}>
                        <Text style={[
                          styles.alternativeName,
                          isSelected && styles.alternativeNameSelected,
                        ]}>
                          {exercise.exercise_name}
                        </Text>
                        <View style={styles.alternativeDetails}>
                          <View style={styles.detailTag}>
                            <Ionicons name="body-outline" size={12} color={COLORS.SECONDARY[500]} />
                            <Text style={styles.detailTextSmall}>
                              {formatMuscleGroup(exercise.target_muscle_group)}
                            </Text>
                          </View>
                          <View style={[
                            styles.detailTag,
                            { backgroundColor: getDifficultyColor(exercise.difficulty_level) + '15' }
                          ]}>
                            <Text style={[
                              styles.detailTextSmall,
                              { color: getDifficultyColor(exercise.difficulty_level) }
                            ]}>
                              {getDifficultyText(exercise.difficulty_level)}
                            </Text>
                          </View>
                          {exercise.estimated_calories_burned && (
                            <View style={styles.detailTag}>
                              <Ionicons name="flame-outline" size={12} color="#F59E0B" />
                              <Text style={styles.detailTextSmall}>
                                {exercise.estimated_calories_burned} cal
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>

                      {/* Chevron */}
                      <Ionicons
                        name={isSelected ? "checkmark-circle" : "chevron-forward"}
                        size={20}
                        color={isSelected ? COLORS.PRIMARY[600] : COLORS.SECONDARY[400]}
                      />
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>

          {/* Footer Buttons */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleClose}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.swapButton,
                !selectedExercise && styles.swapButtonDisabled,
              ]}
              onPress={handleSwap}
              disabled={!selectedExercise}
              activeOpacity={0.8}
            >
              <Ionicons name="swap-horizontal" size={20} color="white" />
              <Text style={styles.swapButtonText}>Swap Exercise</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  modalContainer: {
    backgroundColor: '#F8FAFC',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: height * 0.8,
    paddingBottom: 0,
  },
  handleContainer: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  handleBar: {
    width: 40,
    height: 5,
    backgroundColor: '#D1D5DB',
    borderRadius: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  swapIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.PRIMARY[600] + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: FONTS.BOLD,
    color: '#111827',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 14,
    fontFamily: FONTS.REGULAR,
    color: '#6B7280',
  },
  closeButton: {
    padding: 4,
  },
  currentExerciseSection: {
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 14,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[700],
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  currentExerciseCard: {
    backgroundColor: COLORS.PRIMARY[50],
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.PRIMARY[200],
  },
  exerciseInfo: {
    flex: 1,
  },
  currentExerciseName: {
    fontSize: 16,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
    marginBottom: 8,
  },
  exerciseDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  detailTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.SECONDARY[100],
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  detailText: {
    fontSize: 12,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[700],
  },
  detailTextSmall: {
    fontSize: 11,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
  },
  swapArrow: {
    marginLeft: 12,
  },
  alternativesSection: {
    flex: 1,
    paddingHorizontal: 24,
  },
  alternativesList: {
    flex: 1,
  },
  noAlternatives: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  noAlternativesText: {
    fontSize: 16,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[600],
    marginTop: 12,
  },
  noAlternativesSubtext: {
    fontSize: 14,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[400],
    marginTop: 4,
  },
  alternativeCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.SECONDARY[200],
  },
  alternativeCardSelected: {
    borderColor: COLORS.PRIMARY[500],
    backgroundColor: COLORS.PRIMARY[50],
  },
  selectionIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.SECONDARY[300],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  selectionIndicatorSelected: {
    borderColor: COLORS.PRIMARY[600],
    backgroundColor: COLORS.PRIMARY[600],
  },
  alternativeInfo: {
    flex: 1,
  },
  alternativeName: {
    fontSize: 15,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[900],
    marginBottom: 6,
  },
  alternativeNameSelected: {
    color: COLORS.PRIMARY[700],
  },
  alternativeDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 30,
    gap: 12,
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderTopColor: COLORS.SECONDARY[200],
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.SECONDARY[300],
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[700],
  },
  swapButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: COLORS.PRIMARY[600],
    gap: 8,
  },
  swapButtonDisabled: {
    backgroundColor: COLORS.SECONDARY[400],
  },
  swapButtonText: {
    fontSize: 16,
    fontFamily: FONTS.SEMIBOLD,
    color: 'white',
  },
});

export default ExerciseSwapModal;
