import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Vibration,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, FONTS, FONT_SIZES } from '../../constants/colors';
import { useReadyCheckStore, selectIsReadyCheckActive, selectReadyCheckExpiresAt, selectReadyCheckResponses, selectReadyCheckGroupName } from '../../stores/readyCheckStore';
import { useLobby } from '../../contexts/LobbyContext';
import { useAuth } from '../../contexts/AuthContext';
import { socialService } from '../../services/microservices/socialService';

/**
 * Global Ready Check Modal
 *
 * This modal appears on ALL screens when a ready check is triggered.
 * Features:
 * - 25 second countdown timer with visual progress
 * - Accept/Decline buttons
 * - Shows response status of all members
 * - Vibration feedback on appearance
 * - Redirects to lobby on accept (unless already there)
 */
export function ReadyCheckModal() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { user } = useAuth();
  const { activeLobby } = useLobby();

  // Store state
  const isActive = useReadyCheckStore(selectIsReadyCheckActive);
  const expiresAt = useReadyCheckStore(selectReadyCheckExpiresAt);
  const responses = useReadyCheckStore(selectReadyCheckResponses);
  const groupName = useReadyCheckStore(selectReadyCheckGroupName);
  const sessionId = useReadyCheckStore((state) => state.sessionId);
  const result = useReadyCheckStore((state) => state.result);
  const clearReadyCheck = useReadyCheckStore((state) => state.clearReadyCheck);
  const setResult = useReadyCheckStore((state) => state.setResult);

  // Local state
  const [timeLeft, setTimeLeft] = useState(25);
  const [hasResponded, setHasResponded] = useState(false);
  const [isResponding, setIsResponding] = useState(false);
  const [myResponse, setMyResponse] = useState<'accepted' | 'declined' | null>(null);

  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Check if user is on lobby screen
  const isOnLobbyScreen = pathname?.includes('/workout/group-lobby');

  // Calculate response counts
  const responseCounts = React.useMemo(() => {
    const responseArray = Object.values(responses);
    return {
      accepted: responseArray.filter((r) => r.response === 'accepted').length,
      declined: responseArray.filter((r) => r.response === 'declined').length,
      pending: responseArray.filter((r) => r.response === 'pending').length,
      total: responseArray.length,
    };
  }, [responses]);

  // Check if current user has responded
  useEffect(() => {
    if (user && responses[parseInt(user.id)]) {
      const userResponse = responses[parseInt(user.id)].response;
      if (userResponse !== 'pending') {
        setHasResponded(true);
        setMyResponse(userResponse);
      }
    }
  }, [user, responses]);

  // Timer countdown
  useEffect(() => {
    if (!isActive || !expiresAt) {
      setTimeLeft(25);
      return;
    }

    const updateTimer = () => {
      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((expiresAt - now) / 1000));
      setTimeLeft(remaining);

      if (remaining <= 0) {
        // Time's up - clear interval
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }

        // CRITICAL: Auto-close modal when timer reaches 0
        // Only if result is still pending (backend might not have sent timeout event)
        const currentResult = useReadyCheckStore.getState().result;
        if (currentResult === 'pending') {
          console.log('⏰ [READY CHECK MODAL] Timer reached 0, auto-closing');
          setResult('timeout');
        }
      }
    };

    updateTimer();
    timerIntervalRef.current = setInterval(updateTimer, 100);

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [isActive, expiresAt, setResult]);

  // Show/hide animation
  useEffect(() => {
    if (isActive && result === 'pending') {
      // Reset state for new ready check
      setHasResponded(false);
      setMyResponse(null);
      setIsResponding(false);

      // Vibrate on appearance
      if (Platform.OS !== 'web') {
        Vibration.vibrate([0, 100, 50, 100]);
      }

      // Animate in
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

      // Start pulse animation for timer
      const pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      );
      pulseLoop.start();

      return () => {
        pulseLoop.stop();
      };
    } else if (result && result !== 'pending') {
      // Animate out when result is determined
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 0.8,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start(() => {
          clearReadyCheck();
        });
      }, 1500); // Show result for 1.5 seconds before closing
    }
  }, [isActive, result]);

  // Handle accept
  const handleAccept = useCallback(async () => {
    if (hasResponded || isResponding || !sessionId) return;

    setIsResponding(true);
    try {
      await socialService.respondToReadyCheckV2(sessionId, 'accepted');
      setHasResponded(true);
      setMyResponse('accepted');

      // Navigate to lobby if not already there
      if (!isOnLobbyScreen && activeLobby) {
        router.push({
          pathname: '/workout/group-lobby',
          params: {
            sessionId: activeLobby.sessionId,
            groupId: activeLobby.groupId,
            workoutData: '',
            initiatorId: activeLobby.userId.toString(),
            isCreatingLobby: 'false',
          },
        });
      }
    } catch (error) {
      console.error('Failed to accept ready check:', error);
    } finally {
      setIsResponding(false);
    }
  }, [hasResponded, isResponding, sessionId, isOnLobbyScreen, activeLobby]);

  // Handle decline
  const handleDecline = useCallback(async () => {
    if (hasResponded || isResponding || !sessionId) return;

    setIsResponding(true);
    try {
      await socialService.respondToReadyCheckV2(sessionId, 'declined');
      setHasResponded(true);
      setMyResponse('declined');
    } catch (error) {
      console.error('Failed to decline ready check:', error);
    } finally {
      setIsResponding(false);
    }
  }, [hasResponded, isResponding, sessionId]);

  // Don't render if not active or result is determined and animation is done
  if (!isActive) {
    return null;
  }

  // Calculate progress percentage
  const progressPercent = Math.max(0, Math.min(100, (timeLeft / 25) * 100));

  // Get result message
  const getResultMessage = () => {
    switch (result) {
      case 'success':
        return 'Everyone is ready! Starting workout...';
      case 'failed':
        return 'Ready check failed. Someone declined.';
      case 'timeout':
        return 'Time ran out. Not everyone responded.';
      default:
        return null;
    }
  };

  const resultMessage = getResultMessage();

  return (
    <Modal
      visible={true}
      transparent
      animationType="none"
      statusBarTranslucent
    >
      <Animated.View
        style={[
          styles.overlay,
          { opacity: fadeAnim }
        ]}
      >
        <Animated.View
          style={[
            styles.container,
            {
              transform: [{ scale: scaleAnim }],
              marginTop: insets.top,
              marginBottom: insets.bottom,
            }
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <Ionicons name="alert-circle" size={32} color={COLORS.WARNING[400]} />
            <Text style={styles.title}>Ready Check</Text>
            <Text style={styles.subtitle}>{groupName}</Text>
          </View>

          {/* Timer Circle */}
          <Animated.View
            style={[
              styles.timerContainer,
              { transform: [{ scale: pulseAnim }] }
            ]}
          >
            <View style={styles.timerCircle}>
              <View
                style={[
                  styles.timerProgress,
                  {
                    backgroundColor: timeLeft <= 5 ? COLORS.ERROR[500] : COLORS.PRIMARY[500],
                    width: `${progressPercent}%`,
                  }
                ]}
              />
              <Text style={[
                styles.timerText,
                timeLeft <= 5 && styles.timerTextUrgent
              ]}>
                {timeLeft}s
              </Text>
            </View>
          </Animated.View>

          {/* Response Status */}
          <View style={styles.responseStatus}>
            <View style={styles.responseRow}>
              <View style={[styles.responseIndicator, styles.acceptedIndicator]}>
                <Ionicons name="checkmark" size={16} color={COLORS.NEUTRAL.WHITE} />
              </View>
              <Text style={styles.responseLabel}>Accepted</Text>
              <Text style={styles.responseCount}>{responseCounts.accepted}/{responseCounts.total}</Text>
            </View>
            <View style={styles.responseRow}>
              <View style={[styles.responseIndicator, styles.pendingIndicator]}>
                <Ionicons name="time" size={16} color={COLORS.NEUTRAL.WHITE} />
              </View>
              <Text style={styles.responseLabel}>Waiting</Text>
              <Text style={styles.responseCount}>{responseCounts.pending}</Text>
            </View>
            {responseCounts.declined > 0 && (
              <View style={styles.responseRow}>
                <View style={[styles.responseIndicator, styles.declinedIndicator]}>
                  <Ionicons name="close" size={16} color={COLORS.NEUTRAL.WHITE} />
                </View>
                <Text style={styles.responseLabel}>Declined</Text>
                <Text style={styles.responseCount}>{responseCounts.declined}</Text>
              </View>
            )}
          </View>

          {/* Member List */}
          <View style={styles.memberList}>
            {Object.values(responses).map((response) => (
              <View key={response.userId} style={styles.memberItem}>
                <View style={[
                  styles.memberStatus,
                  response.response === 'accepted' && styles.memberStatusAccepted,
                  response.response === 'declined' && styles.memberStatusDeclined,
                  response.response === 'pending' && styles.memberStatusPending,
                ]}>
                  {response.response === 'accepted' && (
                    <Ionicons name="checkmark" size={12} color={COLORS.NEUTRAL.WHITE} />
                  )}
                  {response.response === 'declined' && (
                    <Ionicons name="close" size={12} color={COLORS.NEUTRAL.WHITE} />
                  )}
                  {response.response === 'pending' && (
                    <Ionicons name="time" size={12} color={COLORS.NEUTRAL.WHITE} />
                  )}
                </View>
                <Text style={styles.memberName} numberOfLines={1}>
                  {response.userName}
                  {user && parseInt(user.id) === response.userId && ' (You)'}
                </Text>
              </View>
            ))}
          </View>

          {/* Result Message */}
          {resultMessage && (
            <View style={[
              styles.resultContainer,
              result === 'success' && styles.resultSuccess,
              (result === 'failed' || result === 'timeout') && styles.resultFailed,
            ]}>
              <Ionicons
                name={result === 'success' ? 'checkmark-circle' : 'close-circle'}
                size={24}
                color={COLORS.NEUTRAL.WHITE}
              />
              <Text style={styles.resultText}>{resultMessage}</Text>
            </View>
          )}

          {/* Action Buttons (only show if not responded and result is pending) */}
          {!hasResponded && result === 'pending' && (
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.actionButton, styles.declineButton]}
                onPress={handleDecline}
                disabled={isResponding}
              >
                <Ionicons name="close" size={24} color={COLORS.NEUTRAL.WHITE} />
                <Text style={styles.actionButtonText}>Not Ready</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.acceptButton]}
                onPress={handleAccept}
                disabled={isResponding}
              >
                <Ionicons name="checkmark" size={24} color={COLORS.NEUTRAL.WHITE} />
                <Text style={styles.actionButtonText}>Ready!</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Already Responded Message */}
          {hasResponded && result === 'pending' && (
            <View style={styles.respondedContainer}>
              <Ionicons
                name={myResponse === 'accepted' ? 'checkmark-circle' : 'close-circle'}
                size={24}
                color={myResponse === 'accepted' ? COLORS.SUCCESS[500] : COLORS.ERROR[500]}
              />
              <Text style={styles.respondedText}>
                {myResponse === 'accepted' ? 'You accepted! Waiting for others...' : 'You declined.'}
              </Text>
            </View>
          )}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  container: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: COLORS.NEUTRAL[900],
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.WARNING[500],
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: FONT_SIZES.XL,
    fontFamily: FONTS.BOLD,
    color: COLORS.NEUTRAL.WHITE,
    marginTop: 8,
  },
  subtitle: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.NEUTRAL[400],
    marginTop: 4,
  },
  timerContainer: {
    marginBottom: 24,
  },
  timerCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.NEUTRAL[800],
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  timerProgress: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    height: '100%',
    opacity: 0.3,
  },
  timerText: {
    fontSize: 32,
    fontFamily: FONTS.BOLD,
    color: COLORS.PRIMARY[400],
  },
  timerTextUrgent: {
    color: COLORS.ERROR[400],
  },
  responseStatus: {
    width: '100%',
    marginBottom: 16,
    gap: 8,
  },
  responseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  responseIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptedIndicator: {
    backgroundColor: COLORS.SUCCESS[500],
  },
  pendingIndicator: {
    backgroundColor: COLORS.WARNING[500],
  },
  declinedIndicator: {
    backgroundColor: COLORS.ERROR[500],
  },
  responseLabel: {
    flex: 1,
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.NEUTRAL[300],
  },
  responseCount: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.BOLD,
    color: COLORS.NEUTRAL.WHITE,
  },
  memberList: {
    width: '100%',
    maxHeight: 150,
    marginBottom: 20,
    gap: 8,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  memberStatus: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberStatusAccepted: {
    backgroundColor: COLORS.SUCCESS[500],
  },
  memberStatusDeclined: {
    backgroundColor: COLORS.ERROR[500],
  },
  memberStatusPending: {
    backgroundColor: COLORS.NEUTRAL[600],
  },
  memberName: {
    flex: 1,
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.NEUTRAL[200],
  },
  resultContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 16,
    width: '100%',
  },
  resultSuccess: {
    backgroundColor: COLORS.SUCCESS[600],
  },
  resultFailed: {
    backgroundColor: COLORS.ERROR[600],
  },
  resultText: {
    flex: 1,
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.NEUTRAL.WHITE,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  acceptButton: {
    backgroundColor: COLORS.SUCCESS[500],
  },
  declineButton: {
    backgroundColor: COLORS.ERROR[500],
  },
  actionButtonText: {
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.BOLD,
    color: COLORS.NEUTRAL.WHITE,
  },
  respondedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
  },
  respondedText: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.NEUTRAL[300],
  },
});

export default ReadyCheckModal;
