import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { View, Text, TextInput, ViewStyle, TextStyle } from 'react-native';
import { COLORS } from '../../constants/colors';

export interface VerificationCodeInputRef {
  focus: () => void;
  clear: () => void;
  setValue: (value: string) => void;
}

interface VerificationCodeInputProps {
  value?: string;
  onChangeText?: (text: string) => void;
  onCodeChange?: (code: string) => void;
  onComplete?: (code: string) => void;
  length?: number;
  autoFocus?: boolean;
  error?: string;
  disabled?: boolean;
  style?: ViewStyle;
}

export const VerificationCodeInput = forwardRef<VerificationCodeInputRef, VerificationCodeInputProps>((props, ref) => {
  const {
    value = '',
    onChangeText,
    onCodeChange,
    onComplete,
    length = 6,
    autoFocus = true,
    error,
    disabled = false,
    style,
  } = props;
  const [internalValue, setInternalValue] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(0);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  const currentValue = value || internalValue;

  useImperativeHandle(ref, () => ({
    focus: () => {
      inputRefs.current[0]?.focus();
    },
    clear: () => {
      setInternalValue('');
      if (onChangeText) onChangeText('');
      if (onCodeChange) onCodeChange('');
      inputRefs.current[0]?.focus();
    },
    setValue: (value: string) => {
      setInternalValue(value);
      if (onChangeText) onChangeText(value);
      if (onCodeChange) onCodeChange(value);
      if (value.length === length && onComplete) {
        onComplete(value);
      }
    },
  }));

  useEffect(() => {
    if (autoFocus && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [autoFocus]);

  const handleChangeText = (text: string, index: number) => {
    if (disabled) return;

    // Only allow numeric input
    const numericText = text.replace(/[^0-9]/g, '');

    if (numericText.length <= 1) {
      const newValue = currentValue.split('');
      newValue[index] = numericText;
      const updatedValue = newValue.join('').slice(0, length);

      setInternalValue(updatedValue);
      if (onChangeText) onChangeText(updatedValue);
      if (onCodeChange) onCodeChange(updatedValue);

      // Check if complete
      if (updatedValue.length === length && onComplete) {
        onComplete(updatedValue);
      }

      // Auto-focus next input
      if (numericText && index < length - 1) {
        inputRefs.current[index + 1]?.focus();
      }
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (disabled) return;

    if (key === 'Backspace') {
      if (!currentValue[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    }
  };

  const containerStyle: ViewStyle = {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...style,
  };

  const inputStyle: TextStyle = {
    width: 50,
    height: 56,
    borderWidth: 2,
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '600',
    color: disabled ? COLORS.SECONDARY[400] : COLORS.SECONDARY[900],
    backgroundColor: disabled ? COLORS.SECONDARY[50] : COLORS.NEUTRAL.WHITE,
  };

  const getInputBorderColor = (index: number): string => {
    if (error) return COLORS.ERROR[500];
    if (disabled) return COLORS.SECONDARY[200];
    if (focusedIndex === index) return '#0091FF';
    if (currentValue[index]) return COLORS.SUCCESS[500];
    return COLORS.SECONDARY[300];
  };

  const errorStyle: TextStyle = {
    fontSize: 12,
    color: COLORS.ERROR[500],
    textAlign: 'center',
    marginTop: 8,
  };

  return (
    <View>
      <View style={containerStyle}>
        {Array.from({ length }, (_, index) => (
          <TextInput
            key={index}
            ref={(ref) => (inputRefs.current[index] = ref)}
            style={[
              inputStyle,
              { borderColor: getInputBorderColor(index) },
            ]}
            value={currentValue[index] || ''}
            onChangeText={(text) => handleChangeText(text, index)}
            onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
            onFocus={() => setFocusedIndex(index)}
            maxLength={1}
            keyboardType="numeric"
            selectTextOnFocus
            editable={!disabled}
          />
        ))}
      </View>
      {error && <Text style={errorStyle}>{error}</Text>}
    </View>
  );
});

VerificationCodeInput.displayName = 'VerificationCodeInput';