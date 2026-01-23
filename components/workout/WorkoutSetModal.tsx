import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  PanResponder,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS } from '../../constants/colors';

const { width, height } = Dimensions.get('window');

interface Exercise {
  exercise_id: number;
  exercise_name: string;
  difficulty_level: number;
  target_muscle_group: string;
  default_duration_seconds: number;
  estimated_calories_burned: number;
  equipment_needed?: string;
}

interface WorkoutSet {
  exercises: Exercise[];
  total_duration: number;
  total_calories: number;
  difficulty: string;
}

interface WorkoutSetModalProps {
  visible: boolean;
  onClose: () => void;
  workoutSet: WorkoutSet | null;
  onStartWorkout: () => void;
}

export const WorkoutSetModal: React.FC<WorkoutSetModalProps> = ({
  visible,
  onClose,
  workoutSet,
  onStartWorkout,
}) => {
  const scrollViewRef = useRef<ScrollView>(null);
  const pan = useRef(new Animated.Value(0)).current;

  // Animation values for smooth fade in/out
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  // Animate in when modal becomes visible
  useEffect(() => {
    if (visible) {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.9);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only respond to vertical drags
        return Math.abs(gestureState.dy) > 5;
      },
      onPanResponderMove: (_, gestureState) => {
        // Only allow downward dragging
        if (gestureState.dy > 0) {
          pan.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        // If dragged down more than 100px, close the modal
        if (gestureState.dy > 100) {
          onClose();
        } else {
          // Otherwise, snap back
          Animated.spring(pan, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  if (!workoutSet) return null;

  const getDifficultyColor = (level: number) => {
    switch (level) {
      case 1: return '#10B981';
      case 2: return '#F59E0B';
      case 3: return '#EF4444';
      default: return '#6B7280';
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

  const formatMuscleGroup = (group: string) => {
    return group
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />

        <Animated.View
          style={[
            styles.modalContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: pan }, { scale: scaleAnim }],
            },
          ]}
        >
          {/* Handle Bar - Draggable */}
          <View {...panResponder.panHandlers} style={styles.handleContainer}>
            <View style={styles.handleBar} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={[styles.tabataIcon, { backgroundColor: COLORS.PRIMARY[600] + '15' }]}>
                <Ionicons name="flash" size={24} color={COLORS.PRIMARY[600]} />
              </View>
              <View>
                <Text style={styles.headerTitle}>Tabata Workout Set</Text>
                <Text style={styles.headerSubtitle}>{workoutSet.exercises.length} exercises • {workoutSet.total_duration} min</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close-circle" size={28} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          {/* Workout Summary Card */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Ionicons name="time-outline" size={20} color={COLORS.PRIMARY[600]} />
                <Text style={styles.summaryValue}>{workoutSet.total_duration}</Text>
                <Text style={styles.summaryLabel}>Minutes</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Ionicons name="flame-outline" size={20} color="#F59E0B" />
                <Text style={styles.summaryValue}>{workoutSet.total_calories}</Text>
                <Text style={styles.summaryLabel}>Calories</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Ionicons name="fitness-outline" size={20} color="#8B5CF6" />
                <Text style={styles.summaryValue}>{workoutSet.exercises.length}</Text>
                <Text style={styles.summaryLabel}>Exercises</Text>
              </View>
            </View>
          </View>

          {/* Protocol Info */}
          <View style={styles.protocolCard}>
            <View style={styles.protocolHeader}>
              <Ionicons name="information-circle" size={20} color="#3B82F6" />
              <Text style={styles.protocolTitle}>Tabata Protocol</Text>
            </View>
            <Text style={styles.protocolText}>
              20 seconds work • 10 seconds rest • 8 rounds per exercise
            </Text>
          </View>

          {/* Exercise List */}
          <ScrollView
            ref={scrollViewRef}
            style={styles.exerciseList}
            showsVerticalScrollIndicator={true}
            nestedScrollEnabled={true}
          >
            <Text style={styles.listHeader}>Exercise Lineup ({workoutSet.exercises.length} exercises)</Text>

            {workoutSet.exercises.map((exercise, index) => (
              <View key={exercise.exercise_id} style={styles.exerciseCard}>
                <View style={styles.exerciseCardHeader}>
                  <View style={styles.exerciseNumber}>
                    <Text style={styles.exerciseNumberText}>{index + 1}</Text>
                  </View>
                  <View style={styles.exerciseHeaderRight}>
                    <Text style={styles.exerciseName} numberOfLines={2}>
                      {exercise.exercise_name}
                    </Text>
                    {/* Difficulty Stars */}
                    <View style={styles.difficultyStars}>
                      {[...Array(3)].map((_, i) => {
                        const difficultyLevel = Number(exercise.difficulty_level || 2);
                        return (
                          <Ionicons
                            key={`diff-${i}`}
                            name={i < difficultyLevel ? "star" : "star-outline"}
                            size={12}
                            color={i < difficultyLevel ? COLORS.WARNING[500] : COLORS.SECONDARY[300]}
                          />
                        );
                      })}
                    </View>
                  </View>
                </View>
                <View style={styles.exerciseCardBody}>
                  <Text style={styles.exerciseDetailsLine}>
                    {formatMuscleGroup(exercise.target_muscle_group)}
                  </Text>
                  <View style={styles.exerciseDetailDivider} />
                  <Text style={styles.exerciseDetailsLine}>
                    20s work • 10s rest
                  </Text>
                  <View style={styles.exerciseDetailDivider} />
                  <Text style={styles.exerciseDetailsLine}>
                    8 rounds
                  </Text>
                </View>
              </View>
            ))}
          </ScrollView>

          {/* Start Button */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.startButton}
              onPress={onStartWorkout}
              activeOpacity={0.8}
            >
              <Ionicons name="play-circle" size={24} color="white" />
              <Text style={styles.startButtonText}>Start Workout</Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContainer: {
    backgroundColor: '#F8FAFC',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: height * 0.95,
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
    marginBottom: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  tabataIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
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
  summaryCard: {
    backgroundColor: 'white',
    marginHorizontal: 24,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#E5E7EB',
  },
  summaryValue: {
    fontSize: 24,
    fontFamily: FONTS.BOLD,
    color: '#111827',
    marginTop: 8,
    marginBottom: 2,
  },
  summaryLabel: {
    fontSize: 12,
    fontFamily: FONTS.REGULAR,
    color: '#6B7280',
  },
  protocolCard: {
    backgroundColor: '#3B82F6' + '10',
    marginHorizontal: 24,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#3B82F6' + '20',
  },
  protocolHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  protocolTitle: {
    fontSize: 14,
    fontFamily: FONTS.SEMIBOLD,
    color: '#3B82F6',
    marginLeft: 8,
  },
  protocolText: {
    fontSize: 13,
    fontFamily: FONTS.REGULAR,
    color: '#6B7280',
    lineHeight: 20,
  },
  exerciseList: {
    flex: 1,
    paddingHorizontal: 24,
  },
  listHeader: {
    fontSize: 16,
    fontFamily: FONTS.SEMIBOLD,
    color: '#111827',
    marginBottom: 16,
  },
  exerciseCard: {
    backgroundColor: COLORS.NEUTRAL.WHITE,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.SECONDARY[200],
    shadowColor: COLORS.SECONDARY[900],
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  exerciseCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 10,
  },
  exerciseNumber: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: COLORS.PRIMARY[600],
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseNumberText: {
    fontSize: 14,
    fontFamily: FONTS.BOLD,
    color: COLORS.NEUTRAL.WHITE,
  },
  exerciseHeaderRight: {
    flex: 1,
    gap: 6,
  },
  exerciseName: {
    fontSize: 16,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
    lineHeight: 20,
  },
  difficultyStars: {
    flexDirection: 'row',
    gap: 3,
  },
  exerciseCardBody: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
  },
  exerciseDetailsLine: {
    fontSize: 14,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    textTransform: 'capitalize',
    flex: 1,
    textAlign: 'center',
  },
  exerciseDetailDivider: {
    width: 1,
    height: 16,
    backgroundColor: COLORS.SECONDARY[300],
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 30,
    backgroundColor: '#F8FAFC',
  },
  startButton: {
    backgroundColor: COLORS.PRIMARY[600],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 8,
    shadowColor: COLORS.PRIMARY[600],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  startButtonText: {
    fontSize: 17,
    fontFamily: FONTS.SEMIBOLD,
    color: 'white',
  },
});
