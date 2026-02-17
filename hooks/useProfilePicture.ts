import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';
import { authService } from '../services/microservices/authService';
import { useAuth } from '../contexts/AuthContext';

export function useProfilePicture() {
  const { refreshUser } = useAuth();
  const [isUploading, setIsUploading] = useState(false);

  const pickAndUpload = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission Required', 'Please allow access to your photo library to upload a profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      exif: false,
    });

    if (result.canceled) return;

    const imageUri = result.assets[0].uri;
    await uploadImage(imageUri);
  };

  const takePhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission Required', 'Please allow camera access to take a profile picture.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      exif: false,
    });

    if (result.canceled) return;

    const imageUri = result.assets[0].uri;
    await uploadImage(imageUri);
  };

  const uploadImage = async (imageUri: string) => {
    setIsUploading(true);
    try {
      await authService.uploadProfilePicture(imageUri);
      await refreshUser();
    } catch (error) {
      Alert.alert('Upload Failed', 'Could not upload your profile picture. Please try again.');
      console.error('Profile picture upload error:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const removePicture = async () => {
    setIsUploading(true);
    try {
      await authService.removeProfilePicture();
      await refreshUser();
    } catch (error) {
      Alert.alert('Error', 'Could not remove your profile picture. Please try again.');
      console.error('Profile picture removal error:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const showOptions = (hasExistingPicture: boolean = false) => {
    const options: { text: string; onPress?: () => void; style?: 'destructive' | 'cancel' | 'default' }[] = [
      { text: 'Take Photo', onPress: takePhoto },
      { text: 'Choose from Gallery', onPress: pickAndUpload },
    ];

    if (hasExistingPicture) {
      options.push({ text: 'Remove Picture', onPress: removePicture, style: 'destructive' });
    }

    options.push({ text: 'Cancel', style: 'cancel' });

    Alert.alert('Profile Picture', 'Choose an option', options);
  };

  return {
    isUploading,
    pickAndUpload,
    takePhoto,
    removePicture,
    showOptions,
  };
}
