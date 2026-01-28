import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, FONT_SIZES } from '../../constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ALERT_WIDTH = Math.min(SCREEN_WIDTH - 48, 320);

export type AlertType = 'success' | 'error' | 'warning' | 'info' | 'confirm';

export interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

export interface CustomAlertProps {
  visible: boolean;
  type?: AlertType;
  title: string;
  message?: string;
  buttons?: AlertButton[];
  onDismiss?: () => void;
  dismissable?: boolean;
}

const alertConfig = {
  success: {
    icon: 'checkmark-circle' as const,
    iconColor: COLORS.SUCCESS[500],
    backgroundColor: COLORS.SUCCESS[50],
  },
  error: {
    icon: 'close-circle' as const,
    iconColor: COLORS.ERROR[500],
    backgroundColor: COLORS.ERROR[50],
  },
  warning: {
    icon: 'warning' as const,
    iconColor: COLORS.WARNING[500],
    backgroundColor: COLORS.WARNING[50],
  },
  info: {
    icon: 'information-circle' as const,
    iconColor: COLORS.PRIMARY[500],
    backgroundColor: COLORS.PRIMARY[50],
  },
  confirm: {
    icon: 'help-circle' as const,
    iconColor: COLORS.PRIMARY[500],
    backgroundColor: COLORS.PRIMARY[50],
  },
};

export const CustomAlert: React.FC<CustomAlertProps> = ({
  visible,
  type = 'info',
  title,
  message,
  buttons = [{ text: 'OK', style: 'default' }],
  onDismiss,
  dismissable = false,
}) => {
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0.9);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  const config = alertConfig[type];

  const handleBackdropPress = () => {
    if (dismissable && onDismiss) {
      onDismiss();
    }
  };

  const handleButtonPress = (button: AlertButton) => {
    // First dismiss the alert, then call the callback
    // This prevents issues when the callback shows another alert
    if (onDismiss) {
      onDismiss();
    }
    // Use setTimeout to ensure the dismiss happens before the callback
    // This allows chained alerts to work properly
    if (button.onPress) {
      setTimeout(() => {
        button.onPress!();
      }, 100);
    }
  };

  const getButtonStyle = (style?: 'default' | 'cancel' | 'destructive', index?: number, total?: number) => {
    const isFirst = index === 0;
    const isLast = index === (total ?? 1) - 1;
    const isSingle = total === 1;

    const baseStyle: any = {
      flex: total === 2 ? 1 : undefined,
      paddingVertical: 14,
      paddingHorizontal: 20,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 50,
    };

    // Add borders for multiple buttons
    if (total === 2 && !isLast) {
      baseStyle.borderRightWidth = StyleSheet.hairlineWidth;
      baseStyle.borderRightColor = COLORS.SECONDARY[200];
    }

    return baseStyle;
  };

  const getButtonTextStyle = (style?: 'default' | 'cancel' | 'destructive') => {
    switch (style) {
      case 'destructive':
        return { color: COLORS.ERROR[500], fontFamily: FONTS.SEMIBOLD };
      case 'cancel':
        return { color: COLORS.SECONDARY[500], fontFamily: FONTS.REGULAR };
      default:
        return { color: COLORS.PRIMARY[600], fontFamily: FONTS.SEMIBOLD };
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <TouchableWithoutFeedback onPress={handleBackdropPress}>
        <View style={styles.overlay}>
          <Animated.View style={[styles.backdropOverlay, { opacity: opacityAnim }]} />

          <TouchableWithoutFeedback>
            <Animated.View
              style={[
                styles.alertContainer,
                {
                  transform: [{ scale: scaleAnim }],
                  opacity: opacityAnim,
                },
              ]}
            >
              {/* Icon Section */}
              <View style={[styles.iconContainer, { backgroundColor: config.backgroundColor }]}>
                <Ionicons name={config.icon} size={32} color={config.iconColor} />
              </View>

              {/* Content Section */}
              <View style={styles.contentContainer}>
                <Text style={styles.title}>{title}</Text>
                {message && <Text style={styles.message}>{message}</Text>}
              </View>

              {/* Buttons Section */}
              <View style={[styles.buttonContainer, buttons.length > 2 && styles.buttonContainerVertical]}>
                {buttons.map((button, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      getButtonStyle(button.style, index, buttons.length),
                      buttons.length > 2 && styles.buttonVertical,
                      buttons.length > 2 && index < buttons.length - 1 && styles.buttonBorderBottom,
                    ]}
                    onPress={() => handleButtonPress(button)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.buttonText, getButtonTextStyle(button.style)]}>
                      {button.text}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdropOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  alertContainer: {
    width: ALERT_WIDTH,
    backgroundColor: COLORS.NEUTRAL.WHITE,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: COLORS.NEUTRAL.BLACK,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 20,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 24,
    paddingBottom: 12,
  },
  contentContainer: {
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  title: {
    fontFamily: FONTS.SEMIBOLD,
    fontSize: FONT_SIZES.LG,
    color: COLORS.SECONDARY[900],
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontFamily: FONTS.REGULAR,
    fontSize: FONT_SIZES.SM,
    color: COLORS.SECONDARY[600],
    textAlign: 'center',
    lineHeight: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.SECONDARY[200],
  },
  buttonContainerVertical: {
    flexDirection: 'column',
  },
  buttonVertical: {
    flex: undefined,
    width: '100%',
  },
  buttonBorderBottom: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.SECONDARY[200],
  },
  buttonText: {
    fontSize: FONT_SIZES.BASE,
  },
});

export default CustomAlert;
