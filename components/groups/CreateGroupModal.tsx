import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS } from '../../constants/colors';
import { socialService } from '../../services/microservices/socialService';

interface CreateGroupData {
  group_name: string;
  description: string;
  is_private: boolean;
  max_members?: number;
  group_image?: string;
}

interface CreateGroupModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const [formData, setFormData] = useState<CreateGroupData>({
    group_name: '',
    description: '',
    is_private: false,
    max_members: 10,
    group_image: '',
  });

  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    // Validation
    if (!formData.group_name.trim()) {
      Alert.alert('Missing Name', 'Please enter a group name.');
      return;
    }

    if (!formData.description.trim()) {
      Alert.alert('Missing Description', 'Please enter a group description.');
      return;
    }

    if (formData.max_members && (formData.max_members < 2 || formData.max_members > 50)) {
      Alert.alert('Invalid Max Members', 'Max members must be between 2 and 50.');
      return;
    }

    setIsCreating(true);
    try {
      await socialService.createGroup(formData);
      Alert.alert('Success', 'Group created successfully!', [
        {
          text: 'OK',
          onPress: () => {
            resetForm();
            onSuccess();
            onClose();
          },
        },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create group. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const resetForm = () => {
    setFormData({
      group_name: '',
      description: '',
      is_private: false,
      max_members: 10,
      group_image: '',
    });
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={handleClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Create Group</Text>
            <TouchableOpacity onPress={handleClose}>
              <Ionicons name="close" size={28} color={COLORS.SECONDARY[700]} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {/* Group Name */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>
                Group Name <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Morning Tabata Warriors"
                value={formData.group_name}
                onChangeText={(text) => setFormData({ ...formData, group_name: text })}
                maxLength={100}
                placeholderTextColor={COLORS.SECONDARY[400]}
              />
            </View>

            {/* Description */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>
                Description <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Tell people what your group is about..."
                value={formData.description}
                onChangeText={(text) => setFormData({ ...formData, description: text })}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                maxLength={500}
                placeholderTextColor={COLORS.SECONDARY[400]}
              />
              <Text style={styles.charCount}>{formData.description.length}/500</Text>
            </View>

            {/* Group Type */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Group Privacy</Text>
              <View style={styles.typeButtonsRow}>
                <TouchableOpacity
                  style={[styles.typeButton, !formData.is_private && styles.typeButtonActive]}
                  onPress={() => setFormData({ ...formData, is_private: false })}
                >
                  <Ionicons
                    name="globe"
                    size={20}
                    color={!formData.is_private ? 'white' : COLORS.PRIMARY[600]}
                  />
                  <Text
                    style={[styles.typeButtonText, !formData.is_private && styles.typeButtonTextActive]}
                  >
                    Public
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.typeButton, formData.is_private && styles.typeButtonActive]}
                  onPress={() => setFormData({ ...formData, is_private: true })}
                >
                  <Ionicons
                    name="lock-closed"
                    size={20}
                    color={formData.is_private ? 'white' : COLORS.PRIMARY[600]}
                  />
                  <Text
                    style={[styles.typeButtonText, formData.is_private && styles.typeButtonTextActive]}
                  >
                    Private
                  </Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.helperText}>
                {!formData.is_private ? 'Anyone can find and join this group' : 'Only members with group code can join'}
              </Text>
            </View>

            {/* Max Members */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Max Members (Optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., 20"
                value={formData.max_members?.toString() || ''}
                onChangeText={(text) => {
                  const num = parseInt(text);
                  setFormData({ ...formData, max_members: isNaN(num) ? 10 : num });
                }}
                keyboardType="number-pad"
                maxLength={2}
                placeholderTextColor={COLORS.SECONDARY[400]}
              />
              <Text style={styles.helperText}>Default is 10 members. Max 50 members.</Text>
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[styles.createButton, (!formData.group_name.trim() || !formData.description.trim()) && styles.createButtonDisabled]}
              onPress={handleCreate}
              disabled={!formData.group_name.trim() || !formData.description.trim() || isCreating}
            >
              {isCreating ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.createButtonText}>Create Group</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.NEUTRAL[200],
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
  },
  modalBody: {
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  formGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[900],
    marginBottom: 8,
  },
  required: {
    color: '#EF4444',
  },
  input: {
    backgroundColor: COLORS.NEUTRAL[50],
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[900],
    borderWidth: 2,
    borderColor: COLORS.NEUTRAL[200],
  },
  textArea: {
    minHeight: 100,
    paddingTop: 14,
  },
  charCount: {
    fontSize: 12,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[400],
    marginTop: 4,
    textAlign: 'right',
  },
  typeButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.PRIMARY[100],
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  typeButtonActive: {
    backgroundColor: COLORS.PRIMARY[600],
    borderColor: COLORS.PRIMARY[700],
  },
  typeButtonText: {
    fontSize: 13,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.PRIMARY[600],
  },
  typeButtonTextActive: {
    color: 'white',
  },
  helperText: {
    fontSize: 12,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[500],
    marginTop: 6,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: COLORS.NEUTRAL[100],
    borderWidth: 2,
    borderColor: 'transparent',
  },
  categoryButtonActive: {
    backgroundColor: COLORS.PRIMARY[100],
    borderColor: COLORS.PRIMARY[600],
  },
  categoryButtonText: {
    fontSize: 13,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[700],
  },
  categoryButtonTextActive: {
    color: COLORS.PRIMARY[600],
  },
  inputWithButton: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  inputFlex: {
    flex: 1,
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.PRIMARY[600],
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.PRIMARY[100],
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  tagText: {
    fontSize: 13,
    fontFamily: FONTS.REGULAR,
    color: COLORS.PRIMARY[700],
  },
  rulesList: {
    marginTop: 12,
    gap: 8,
  },
  ruleItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.NEUTRAL[50],
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  ruleNumber: {
    fontSize: 14,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.PRIMARY[600],
  },
  ruleText: {
    flex: 1,
    fontSize: 14,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[700],
    lineHeight: 20,
  },
  modalFooter: {
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: COLORS.NEUTRAL[200],
  },
  createButton: {
    backgroundColor: COLORS.PRIMARY[600],
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: COLORS.PRIMARY[600],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  createButtonDisabled: {
    backgroundColor: COLORS.SECONDARY[300],
    shadowOpacity: 0,
  },
  createButtonText: {
    fontSize: 16,
    fontFamily: FONTS.SEMIBOLD,
    color: 'white',
  },
});
