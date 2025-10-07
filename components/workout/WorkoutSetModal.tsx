import React, { useRef } from 'react';
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
      animationType="slide"
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
              transform: [{ translateY: pan }],
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
                {/* Exercise Number Badge */}
                <View style={styles.exerciseNumber}>
                  <Text style={styles.exerciseNumberText}>{index + 1}</Text>
                </View>

                {/* Exercise Info */}
                <View style={styles.exerciseInfo}>
                  <Text style={styles.exerciseName}>{exercise.exercise_name}</Text>

                  <View style={styles.exerciseMeta}>
                    <View style={[styles.difficultyBadge, { backgroundColor: getDifficultyColor(exercise.difficulty_level) + '15' }]}>
                      <Text style={[styles.difficultyText, { color: getDifficultyColor(exercise.difficulty_level) }]}>
                        {getDifficultyText(exercise.difficulty_level)}
                      </Text>
                    </View>
                    <View style={styles.muscleBadge}>
                      <Ionicons name="body-outline" size={12} color="#6B7280" />
                      <Text style={styles.muscleText}>{formatMuscleGroup(exercise.target_muscle_group)}</Text>
                    </View>
                  </View>

                  <View style={styles.exerciseStats}>
                    <View style={styles.stat}>
                      <Ionicons name="time-outline" size={14} color="#6B7280" />
                      <Text style={styles.statText}>4 min</Text>
                    </View>
                    <Text style={styles.statDivider}>|</Text>
                    <View style={styles.stat}>
                      <Ionicons name="flame-outline" size={14} color="#F59E0B" />
                      <Text style={styles.statText}>~{exercise.estimated_calories_burned} cal</Text>
                    </View>
                    {exercise.equipment_needed && exercise.equipment_needed !== 'none' && (
                      <>
                        <Text style={styles.statDivider}>|</Text>
                        <View style={styles.stat}>
                          <Ionicons name="barbell-outline" size={14} color="#8B5CF6" />
                          <Text style={styles.statText}>{exercise.equipment_needed}</Text>
                        </View>
                      </>
                    )}
                  </View>
                </View>

                {/* Next Indicator */}
                {index < workoutSet.exercises.length - 1 && (
                  <View style={styles.nextIndicator}>
                    <Ionicons name="chevron-down" size={16} color="#D1D5DB" />
                  </View>
                )}
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
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  exerciseNumber: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.PRIMARY[600] + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseNumberText: {
    fontSize: 13,
    fontFamily: FONTS.BOLD,
    color: COLORS.PRIMARY[600],
  },
  exerciseInfo: {
    paddingRight: 40,
  },
  exerciseName: {
    fontSize: 16,
    fontFamily: FONTS.SEMIBOLD,
    color: '#111827',
    marginBottom: 8,
  },
  exerciseMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  difficultyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  difficultyText: {
    fontSize: 11,
    fontFamily: FONTS.SEMIBOLD,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  muscleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
  },
  muscleText: {
    fontSize: 11,
    fontFamily: FONTS.REGULAR,
    color: '#6B7280',
  },
  exerciseStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    justifyContent: 'center',
  },
  statText: {
    fontSize: 12,
    fontFamily: FONTS.REGULAR,
    color: '#6B7280',
  },
  statDivider: {
    fontSize: 12,
    fontFamily: FONTS.REGULAR,
    color: '#D1D5DB',
    marginHorizontal: 8,
  },
  nextIndicator: {
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: -8,
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
