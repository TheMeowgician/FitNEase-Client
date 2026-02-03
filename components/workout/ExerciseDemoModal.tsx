import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Image,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, FONT_SIZES } from '../../constants/colors';
import { getExerciseDemo } from '../../constants/exerciseDemos';

const { width, height } = Dimensions.get('window');

interface ExerciseDemoModalProps {
  visible: boolean;
  exerciseName: string;
  targetMuscleGroup?: string;
  onClose: () => void;
}

export default function ExerciseDemoModal({
  visible,
  exerciseName,
  targetMuscleGroup,
  onClose,
}: ExerciseDemoModalProps) {
  const [isLoading, setIsLoading] = React.useState(true);
  const demoSource = getExerciseDemo(exerciseName, targetMuscleGroup);

  React.useEffect(() => {
    if (visible) {
      setIsLoading(true);
    }
  }, [visible, exerciseName]);

  if (!demoSource) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="videocam" size={20} color={COLORS.PRIMARY[500]} />
              <Text style={styles.headerTitle}>Exercise Demo</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={COLORS.SECONDARY[600]} />
            </TouchableOpacity>
          </View>

          {/* Exercise Name */}
          <Text style={styles.exerciseName}>{exerciseName}</Text>

          {/* GIF Container */}
          <View style={styles.gifContainer}>
            {isLoading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.PRIMARY[500]} />
                <Text style={styles.loadingText}>Loading demo...</Text>
              </View>
            )}
            <Image
              source={demoSource}
              style={styles.gifImage}
              resizeMode="contain"
              onLoadStart={() => setIsLoading(true)}
              onLoadEnd={() => setIsLoading(false)}
            />
          </View>

          {/* Tip */}
          <View style={styles.tipContainer}>
            <Ionicons name="information-circle" size={18} color={COLORS.PRIMARY[500]} />
            <Text style={styles.tipText}>
              Watch the form carefully. Focus on controlled movements.
            </Text>
          </View>

          {/* Close Button */}
          <TouchableOpacity style={styles.doneButton} onPress={onClose}>
            <Text style={styles.doneButtonText}>Got it!</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: width - 40,
    maxWidth: 400,
    backgroundColor: COLORS.NEUTRAL.WHITE,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
  },
  header: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[600],
  },
  closeButton: {
    padding: 4,
  },
  exerciseName: {
    fontSize: FONT_SIZES.XL,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
    textAlign: 'center',
    marginBottom: 16,
  },
  gifContainer: {
    width: '100%',
    height: 280,
    backgroundColor: COLORS.NEUTRAL[100],
    borderRadius: 16,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  loadingContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  loadingText: {
    marginTop: 8,
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[500],
  },
  gifImage: {
    width: '100%',
    height: '100%',
  },
  tipContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: COLORS.PRIMARY[50],
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    width: '100%',
  },
  tipText: {
    flex: 1,
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.PRIMARY[700],
    lineHeight: 20,
  },
  doneButton: {
    backgroundColor: COLORS.PRIMARY[500],
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
  },
  doneButtonText: {
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.BOLD,
    color: COLORS.NEUTRAL.WHITE,
    textAlign: 'center',
  },
});
