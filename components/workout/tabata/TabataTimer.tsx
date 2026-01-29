import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { COLORS, FONTS, FONT_SIZES } from '../../../constants/colors';
import { TABATA_CONFIG } from '../../../constants/tabata';

type TimerState = typeof TABATA_CONFIG.TIMER_STATES[keyof typeof TABATA_CONFIG.TIMER_STATES];

interface TabataTimerProps {
  isActive: boolean;
  onRoundComplete: (round: number) => void;
  onWorkoutComplete: () => void;
  onStateChange: (state: string, timeRemaining: number, currentRound: number) => void;
  style?: ViewStyle;
}

export const TabataTimer: React.FC<TabataTimerProps> = ({
  isActive,
  onRoundComplete,
  onWorkoutComplete,
  onStateChange,
  style,
}) => {
  const [currentState, setCurrentState] = useState<TimerState>(TABATA_CONFIG.TIMER_STATES.PREPARATION);
  const [timeRemaining, setTimeRemaining] = useState(TABATA_CONFIG.PREPARATION_TIME);
  const [currentRound, setCurrentRound] = useState(1);
  const [isWorkPhase, setIsWorkPhase] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isActive) {
      startTimer();
    } else {
      stopTimer();
    }

    return () => stopTimer();
  }, [isActive]);

  useEffect(() => {
    onStateChange(currentState, timeRemaining, currentRound);
  }, [currentState, timeRemaining, currentRound]);

  const startTimer = () => {
    intervalRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          handlePhaseTransition();
          return getNextPhaseDuration();
        }
        return prev - 1;
      });
    }, 1000);
  };

  const stopTimer = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const handlePhaseTransition = () => {
    switch (currentState) {
      case TABATA_CONFIG.TIMER_STATES.PREPARATION:
        setCurrentState(TABATA_CONFIG.TIMER_STATES.WORK);
        setIsWorkPhase(true);
        break;

      case TABATA_CONFIG.TIMER_STATES.WORK:
        setCurrentState(TABATA_CONFIG.TIMER_STATES.REST);
        setIsWorkPhase(false);
        break;

      case TABATA_CONFIG.TIMER_STATES.REST:
        if (currentRound < TABATA_CONFIG.ROUNDS) {
          setCurrentRound((prev) => prev + 1);
          setCurrentState(TABATA_CONFIG.TIMER_STATES.WORK);
          setIsWorkPhase(true);
          onRoundComplete(currentRound);
        } else {
          setCurrentState(TABATA_CONFIG.TIMER_STATES.COMPLETE);
          stopTimer();
          onWorkoutComplete();
        }
        break;
    }
  };

  const getNextPhaseDuration = (): number => {
    switch (currentState) {
      case TABATA_CONFIG.TIMER_STATES.PREPARATION:
        return TABATA_CONFIG.WORK_DURATION;
      case TABATA_CONFIG.TIMER_STATES.WORK:
        return TABATA_CONFIG.REST_DURATION;
      case TABATA_CONFIG.TIMER_STATES.REST:
        return TABATA_CONFIG.WORK_DURATION;
      default:
        return 0;
    }
  };

  const getBackgroundColor = (): string => {
    switch (currentState) {
      case TABATA_CONFIG.TIMER_STATES.PREPARATION:
        return COLORS.TABATA.PREPARATION;
      case TABATA_CONFIG.TIMER_STATES.WORK:
        return COLORS.TABATA.WORK;
      case TABATA_CONFIG.TIMER_STATES.REST:
        return COLORS.TABATA.REST;
      case TABATA_CONFIG.TIMER_STATES.COMPLETE:
        return COLORS.TABATA.COMPLETE;
      default:
        return COLORS.SECONDARY[500];
    }
  };

  const getStateText = (): string => {
    switch (currentState) {
      case TABATA_CONFIG.TIMER_STATES.PREPARATION:
        return 'GET READY';
      case TABATA_CONFIG.TIMER_STATES.WORK:
        return 'WORK';
      case TABATA_CONFIG.TIMER_STATES.REST:
        return 'REST';
      case TABATA_CONFIG.TIMER_STATES.COMPLETE:
        return 'COMPLETE';
      default:
        return '';
    }
  };

  const formatTime = (seconds: number): string => {
    return seconds.toString().padStart(2, '0');
  };

  return (
    <View style={[styles.container, { backgroundColor: getBackgroundColor() }, style]}>
      <View style={styles.content}>
        <Text style={styles.stateText}>{getStateText()}</Text>
        <Text style={styles.timeText}>{formatTime(timeRemaining)}</Text>
        {currentState !== TABATA_CONFIG.TIMER_STATES.PREPARATION &&
         currentState !== TABATA_CONFIG.TIMER_STATES.COMPLETE && (
          <Text style={styles.roundText}>
            Round {currentRound} of {TABATA_CONFIG.ROUNDS}
          </Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    margin: 16,
    elevation: 5,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  content: {
    alignItems: 'center',
    padding: 40,
  },
  stateText: {
    fontSize: FONT_SIZES.XXL,
    fontFamily: FONTS.BOLD,
    color: COLORS.NEUTRAL.WHITE,
    marginBottom: 20,
    letterSpacing: 2,
  },
  timeText: {
    fontSize: 80,
    fontFamily: FONTS.BOLD,
    color: COLORS.NEUTRAL.WHITE,
  },
  roundText: {
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.REGULAR,
    color: COLORS.NEUTRAL.WHITE,
    marginTop: 20,
    opacity: 0.9,
  },
});