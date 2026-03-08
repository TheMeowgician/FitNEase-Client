import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { DatePicker } from '../../components/ui/DatePicker';
import { Avatar } from '../../components/ui/Avatar';
import { COLORS, FONTS } from '../../constants/colors';
import { useAuth } from '../../contexts/AuthContext';
import { useAlert } from '../../contexts/AlertContext';
import { useProfilePicture } from '../../hooks/useProfilePicture';
import { authService } from '../../services/microservices/authService';
import { formatDateToISO, parseISODate } from '../../utils/dateUtils';
import { useSmartBack } from '../../hooks/useSmartBack';

export default function EditProfileScreen() {
  const { user, refreshUser } = useAuth();
  const { goBack } = useSmartBack();
  const alert = useAlert();
  const { isUploading, pickAndUpload, takePhoto, removePicture } = useProfilePicture();
  const [showImagePickerModal, setShowImagePickerModal] = useState(false);
  const imagePickerFade = useRef(new Animated.Value(0)).current;
  const imagePickerScale = useRef(new Animated.Value(0.9)).current;
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    username: '',
    email: '',
    phoneNumber: '',
    gender: '' as 'male' | 'female' | 'other' | '',
  });
  const [dateOfBirth, setDateOfBirth] = useState<Date | null>(null);

  const capitalizeFirstLetter = (text: string) => {
    if (!text) return text;
    return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
  };

  useEffect(() => {
    if (user) {
      setFormData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        username: user.username || '',
        email: user.email || '',
        phoneNumber: user.phoneNumber || '',
        gender: (user.gender as any) || '',
      });
      if (user.dateOfBirth) {
        setDateOfBirth(parseISODate(user.dateOfBirth));
      }
    }
  }, [user]);

  useEffect(() => {
    if (showImagePickerModal) {
      imagePickerFade.setValue(0);
      imagePickerScale.setValue(0.9);
      Animated.parallel([
        Animated.timing(imagePickerFade, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(imagePickerScale, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true }),
      ]).start();
    }
  }, [showImagePickerModal]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updateData: any = {
        first_name: capitalizeFirstLetter(formData.firstName.trim()),
        last_name: capitalizeFirstLetter(formData.lastName.trim()),
        username: formData.username.trim(),
        phone_number: formData.phoneNumber,
        gender: formData.gender,
      };

      if (dateOfBirth) {
        updateData.date_of_birth = formatDateToISO(dateOfBirth);
      }

      await authService.updateUserProfile(updateData);
      await refreshUser();
      alert.success('Success', 'Your profile has been updated!', () => goBack());
    } catch (error) {
      console.error('Error saving profile:', error);
      alert.error('Error', 'Failed to save your profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const renderGenderButton = (value: 'male' | 'female' | 'other', label: string, icon: string) => {
    const isSelected = formData.gender === value;
    return (
      <TouchableOpacity
        style={[s.genderButton, isSelected && { borderColor: COLORS.PRIMARY[500], backgroundColor: COLORS.PRIMARY[50] }]}
        onPress={() => setFormData({ ...formData, gender: value })}
        activeOpacity={0.7}
      >
        <Ionicons name={icon as any} size={20} color={isSelected ? COLORS.PRIMARY[500] : COLORS.SECONDARY[400]} />
        <Text style={[s.genderButtonText, isSelected && { color: COLORS.PRIMARY[500], fontFamily: FONTS.SEMIBOLD }]}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => goBack()} style={s.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.SECONDARY[700]} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Edit Profile</Text>
        <View style={s.placeholder} />
      </View>

      <ScrollView style={s.scrollView} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={s.avatarSection}>
          <TouchableOpacity onPress={() => setShowImagePickerModal(true)} activeOpacity={0.7} disabled={isUploading}>
            <Avatar profilePicture={user?.profilePicture} size="xl" />
            {isUploading && (
              <View style={s.avatarOverlay}>
                <ActivityIndicator color="white" />
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={s.changePhotoButton} activeOpacity={0.7} onPress={() => setShowImagePickerModal(true)} disabled={isUploading}>
            <Text style={s.changePhotoText}>{isUploading ? 'Uploading...' : 'Change Photo'}</Text>
          </TouchableOpacity>
        </View>

        <View style={s.formSection}>
          <Text style={s.sectionTitle}>Personal Information</Text>

          <Input
            label="Username"
            value={formData.username}
            onChangeText={(text) => setFormData({ ...formData, username: text })}
            placeholder="Enter your username"
            leftIcon={<Ionicons name="at-outline" size={20} color={COLORS.SECONDARY[400]} />}
          />

          <Input
            label="First Name"
            value={formData.firstName}
            onChangeText={(text) => setFormData({ ...formData, firstName: text })}
            placeholder="Enter your first name"
            leftIcon={<Ionicons name="person-outline" size={20} color={COLORS.SECONDARY[400]} />}
          />

          <Input
            label="Last Name"
            value={formData.lastName}
            onChangeText={(text) => setFormData({ ...formData, lastName: text })}
            placeholder="Enter your last name"
            leftIcon={<Ionicons name="person-outline" size={20} color={COLORS.SECONDARY[400]} />}
          />

          <Input
            label="Email"
            value={formData.email}
            onChangeText={() => {}}
            editable={false}
            placeholder="your@email.com"
            leftIcon={<Ionicons name="mail-outline" size={20} color={COLORS.SECONDARY[400]} />}
          />

          <Input
            label="Phone Number"
            value={formData.phoneNumber}
            onChangeText={(text) => setFormData({ ...formData, phoneNumber: text })}
            placeholder="Enter your phone number"
            keyboardType="phone-pad"
            leftIcon={<Ionicons name="call-outline" size={20} color={COLORS.SECONDARY[400]} />}
          />

          <View style={s.inputGroup}>
            <Text style={s.inputLabel}>Date of Birth</Text>
            <DatePicker
              value={dateOfBirth}
              onDateChange={setDateOfBirth}
              placeholder="Select your birthdate"
            />
          </View>

          <View style={s.inputGroup}>
            <Text style={s.inputLabel}>Gender</Text>
            <View style={s.genderButtons}>
              {renderGenderButton('male', 'Male', 'male')}
              {renderGenderButton('female', 'Female', 'female')}
              {renderGenderButton('other', 'Other', 'transgender')}
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={s.buttonContainer}>
        <Button
          title={isSaving ? "Saving..." : "Save Changes"}
          onPress={handleSave}
          loading={isSaving}
          disabled={isSaving}
          style={{ ...s.saveButton, backgroundColor: !isSaving ? COLORS.PRIMARY[500] : COLORS.NEUTRAL[300] }}
        />
      </View>
      {/* Image Picker Modal */}
      <Modal
        visible={showImagePickerModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowImagePickerModal(false)}
      >
        <View style={s.modalOverlay}>
          <Animated.View style={[s.pickerModalContent, { opacity: imagePickerFade, transform: [{ scale: imagePickerScale }] }]}>
            <View style={s.pickerModalHeader}>
              <Text style={s.pickerModalTitle}>Profile Picture</Text>
              <TouchableOpacity onPress={() => setShowImagePickerModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.SECONDARY[700]} />
              </TouchableOpacity>
            </View>

            <View style={{ gap: 8 }}>
              <TouchableOpacity style={s.pickerOption} onPress={() => {
                setShowImagePickerModal(false);
                takePhoto();
              }}>
                <View style={s.pickerOptionLeft}>
                  <Ionicons name="camera-outline" size={22} color={COLORS.PRIMARY[600]} />
                  <Text style={s.pickerOptionText}>Take Photo</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={COLORS.SECONDARY[400]} />
              </TouchableOpacity>

              <TouchableOpacity style={s.pickerOption} onPress={() => {
                setShowImagePickerModal(false);
                pickAndUpload();
              }}>
                <View style={s.pickerOptionLeft}>
                  <Ionicons name="images-outline" size={22} color={COLORS.PRIMARY[600]} />
                  <Text style={s.pickerOptionText}>Choose from Gallery</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={COLORS.SECONDARY[400]} />
              </TouchableOpacity>

              {user?.profilePicture && (
                <TouchableOpacity style={s.pickerOption} onPress={() => {
                  setShowImagePickerModal(false);
                  removePicture();
                }}>
                  <View style={s.pickerOptionLeft}>
                    <Ionicons name="trash-outline" size={22} color="#EF4444" />
                    <Text style={[s.pickerOptionText, { color: '#EF4444' }]}>Remove Picture</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#EF4444" />
                </TouchableOpacity>
              )}
            </View>
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.NEUTRAL.WHITE },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: COLORS.NEUTRAL[200] },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 18, fontFamily: FONTS.SEMIBOLD, color: COLORS.SECONDARY[900] },
  placeholder: { width: 40 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 20 },
  avatarSection: { alignItems: 'center', marginBottom: 32 },
  avatarOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 50, alignItems: 'center', justifyContent: 'center' },
  changePhotoButton: { paddingVertical: 8, paddingHorizontal: 16, marginTop: 16 },
  changePhotoText: { fontSize: 14, fontFamily: FONTS.SEMIBOLD, color: COLORS.PRIMARY[500] },
  formSection: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontFamily: FONTS.BOLD, color: COLORS.SECONDARY[900], marginBottom: 20 },
  inputGroup: { marginBottom: 20 },
  inputLabel: { fontSize: 14, fontFamily: FONTS.SEMIBOLD, color: COLORS.SECONDARY[700], marginBottom: 8 },
  genderButtons: { flexDirection: 'row', gap: 12 },
  genderButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, borderWidth: 2, borderColor: COLORS.NEUTRAL[200], backgroundColor: COLORS.NEUTRAL.WHITE, gap: 8 },
  genderButtonText: { fontSize: 14, fontFamily: FONTS.REGULAR, color: COLORS.SECONDARY[600] },
  buttonContainer: { paddingHorizontal: 24, paddingBottom: 24, paddingTop: 16 },
  saveButton: { shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  pickerModalContent: { backgroundColor: COLORS.NEUTRAL.WHITE, borderRadius: 20, padding: 24, width: '100%', maxWidth: 500 },
  pickerModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  pickerModalTitle: { fontSize: 20, fontFamily: FONTS.BOLD, color: COLORS.SECONDARY[900] },
  pickerOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 16, backgroundColor: COLORS.NEUTRAL[50], borderRadius: 12, marginBottom: 8 },
  pickerOptionLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pickerOptionText: { fontSize: 16, fontFamily: FONTS.SEMIBOLD, color: COLORS.SECONDARY[900] },
});
