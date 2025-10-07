import React, { useState } from 'react';
import { View, TextInput, Text, TouchableOpacity, ViewStyle, TextStyle } from 'react-native';
import { COLORS, FONTS, FONT_SIZES } from '../../constants/colors';

interface InputProps {
  label?: string;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  editable?: boolean;
  multiline?: boolean;
  numberOfLines?: number;
  maxLength?: number;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onRightIconPress?: () => void;
  style?: ViewStyle;
  inputStyle?: TextStyle;
}

export const Input: React.FC<InputProps> = ({
  label,
  placeholder,
  value,
  onChangeText,
  error,
  secureTextEntry = false,
  keyboardType = 'default',
  autoCapitalize = 'none',
  editable = true,
  multiline = false,
  numberOfLines = 1,
  maxLength,
  leftIcon,
  rightIcon,
  onRightIconPress,
  style,
  inputStyle,
}) => {
  const [isFocused, setIsFocused] = useState(false);

  const containerStyle: ViewStyle = {
    marginBottom: 16,
    ...style,
  };

  const labelStyle: TextStyle = {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[700],
    marginBottom: 4,
  };

  const inputContainerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: multiline ? 'flex-start' : 'center',
    borderWidth: 1,
    borderColor: error ? COLORS.ERROR[500] : isFocused ? COLORS.PRIMARY[500] : COLORS.SECONDARY[300],
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: multiline ? 12 : 14,
    backgroundColor: editable ? COLORS.NEUTRAL.WHITE : COLORS.SECONDARY[50],
    minHeight: 48,
  };

  const textInputStyle: TextStyle = {
    flex: 1,
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[900],
    paddingHorizontal: leftIcon ? 8 : 0,
    textAlignVertical: multiline ? 'top' : 'center',
    paddingVertical: 0, // Remove default padding to control height precisely
    ...inputStyle,
  };

  const errorStyle: TextStyle = {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.REGULAR,
    color: COLORS.ERROR[500],
    marginTop: 4,
  };

  return (
    <View style={containerStyle}>
      {label && <Text style={labelStyle}>{label}</Text>}
      <View style={inputContainerStyle}>
        {leftIcon && leftIcon}
        <TextInput
          style={textInputStyle}
          placeholder={placeholder}
          placeholderTextColor={COLORS.SECONDARY[400]}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          editable={editable}
          multiline={multiline}
          numberOfLines={numberOfLines}
          maxLength={maxLength}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />
        {rightIcon && (
          <TouchableOpacity onPress={onRightIconPress} disabled={!onRightIconPress}>
            {rightIcon}
          </TouchableOpacity>
        )}
      </View>
      {error && <Text style={errorStyle}>{error}</Text>}
    </View>
  );
};