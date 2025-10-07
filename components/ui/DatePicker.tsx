import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Platform, ViewStyle, TextStyle } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { COLORS, FONTS, FONT_SIZES } from '../../constants/colors';

interface DatePickerProps {
  label?: string;
  value: Date | null;
  onDateChange: (date: Date | null) => void;
  placeholder?: string;
  error?: string;
  maximumDate?: Date;
  minimumDate?: Date;
  style?: ViewStyle;
}

export const DatePicker: React.FC<DatePickerProps> = ({
  label,
  value,
  onDateChange,
  placeholder = 'Select date',
  error,
  maximumDate,
  minimumDate,
  style,
}) => {
  const [showPicker, setShowPicker] = useState(false);

  const formatDate = (date: Date | null): string => {
    if (!date) return '';

    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    };

    return date.toLocaleDateString('en-US', options);
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    // On Android, the picker closes automatically after selection
    if (Platform.OS === 'android') {
      setShowPicker(false);
    }

    if (selectedDate) {
      onDateChange(selectedDate);
    } else if (Platform.OS === 'android') {
      // User cancelled on Android
      onDateChange(value);
    }
  };

  const handlePress = () => {
    setShowPicker(true);
  };

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
    alignItems: 'center',
    borderWidth: 1,
    borderColor: error ? COLORS.ERROR[500] : COLORS.SECONDARY[300],
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 14,
    backgroundColor: COLORS.NEUTRAL.WHITE,
    minHeight: 48,
  };

  const inputTextStyle: TextStyle = {
    flex: 1,
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.REGULAR,
    color: value ? COLORS.SECONDARY[900] : COLORS.SECONDARY[400],
  };

  const errorStyle: TextStyle = {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.ERROR[500],
    marginTop: 4,
  };

  const pickerIconStyle: TextStyle = {
    fontSize: FONT_SIZES.LG,
    color: COLORS.SECONDARY[400],
    marginLeft: 8,
  };

  return (
    <View style={containerStyle}>
      {label && <Text style={labelStyle}>{label}</Text>}

      <TouchableOpacity
        style={inputContainerStyle}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        <Text style={inputTextStyle}>
          {value ? formatDate(value) : placeholder}
        </Text>
        <Text style={pickerIconStyle}>📅</Text>
      </TouchableOpacity>

      {error && <Text style={errorStyle}>{error}</Text>}

      {showPicker && (
        <DateTimePicker
          value={value || new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleDateChange}
          maximumDate={maximumDate}
          minimumDate={minimumDate}
          textColor={COLORS.SECONDARY[900]}
        />
      )}
    </View>
  );
};