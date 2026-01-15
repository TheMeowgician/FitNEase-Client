import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, FONT_SIZES } from '../../constants/colors';
import { socialService } from '../../services/microservices/socialService';

interface JoinRequest {
  request_id: number;
  user_id: number;
  username: string;
  user_role: string;
  message?: string;
  requested_at: string;
}

interface JoinRequestsModalProps {
  visible: boolean;
  onClose: () => void;
  groupId: string;
  groupName: string;
  onRequestHandled?: () => void;
}

export const JoinRequestsModal: React.FC<JoinRequestsModalProps> = ({
  visible,
  onClose,
  groupId,
  groupName,
  onRequestHandled,
}) => {
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);

  useEffect(() => {
    if (visible) {
      loadRequests();
    }
  }, [visible, groupId]);

  const loadRequests = async () => {
    try {
      setIsLoading(true);
      const response = await socialService.getJoinRequests(groupId);
      setRequests(response.data?.requests || []);
    } catch (error) {
      console.error('Failed to load join requests:', error);
      Alert.alert('Error', 'Failed to load join requests');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (requestId: number, username: string) => {
    try {
      setProcessingId(requestId);
      await socialService.approveJoinRequest(groupId, requestId);
      Alert.alert('Success', `${username} has been added to the group`);
      setRequests(requests.filter(r => r.request_id !== requestId));
      onRequestHandled?.();
    } catch (error) {
      console.error('Failed to approve request:', error);
      Alert.alert('Error', 'Failed to approve request');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (requestId: number, username: string) => {
    Alert.alert(
      'Decline Request',
      `Are you sure you want to decline ${username}'s request?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            try {
              setProcessingId(requestId);
              await socialService.rejectJoinRequest(groupId, requestId);
              Alert.alert('Done', `${username}'s request has been declined`);
              setRequests(requests.filter(r => r.request_id !== requestId));
              onRequestHandled?.();
            } catch (error) {
              console.error('Failed to reject request:', error);
              Alert.alert('Error', 'Failed to decline request');
            } finally {
              setProcessingId(null);
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Join Requests</Text>
              <Text style={styles.subtitle}>{groupName}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={COLORS.SECONDARY[600]} />
            </TouchableOpacity>
          </View>

          {/* Content */}
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.PRIMARY[600]} />
              <Text style={styles.loadingText}>Loading requests...</Text>
            </View>
          ) : requests.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="checkmark-circle" size={64} color={COLORS.SUCCESS[400]} />
              <Text style={styles.emptyTitle}>No pending requests</Text>
              <Text style={styles.emptySubtitle}>
                All join requests have been processed
              </Text>
            </View>
          ) : (
            <ScrollView style={styles.requestsList}>
              {requests.map((request) => (
                <View key={request.request_id} style={styles.requestCard}>
                  <View style={styles.requestHeader}>
                    <View style={styles.userInfo}>
                      <View style={styles.avatar}>
                        <Ionicons name="person" size={24} color={COLORS.PRIMARY[600]} />
                      </View>
                      <View>
                        <View style={styles.nameRow}>
                          <Text style={styles.username}>{request.username}</Text>
                          {request.user_role === 'mentor' && (
                            <View style={styles.mentorBadge}>
                              <Ionicons name="school" size={10} color="#FFFFFF" />
                              <Text style={styles.mentorBadgeText}>Mentor</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.requestTime}>
                          {formatDate(request.requested_at)}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {request.message && (
                    <View style={styles.messageContainer}>
                      <Text style={styles.messageLabel}>Message:</Text>
                      <Text style={styles.messageText}>{request.message}</Text>
                    </View>
                  )}

                  <View style={styles.actions}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.rejectButton]}
                      onPress={() => handleReject(request.request_id, request.username)}
                      disabled={processingId === request.request_id}
                    >
                      {processingId === request.request_id ? (
                        <ActivityIndicator size="small" color={COLORS.ERROR[600]} />
                      ) : (
                        <>
                          <Ionicons name="close" size={18} color={COLORS.ERROR[600]} />
                          <Text style={styles.rejectButtonText}>Decline</Text>
                        </>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.actionButton, styles.approveButton]}
                      onPress={() => handleApprove(request.request_id, request.username)}
                      disabled={processingId === request.request_id}
                    >
                      {processingId === request.request_id ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                          <Text style={styles.approveButtonText}>Approve</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: COLORS.NEUTRAL.WHITE,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingBottom: 34,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.SECONDARY[100],
  },
  title: {
    fontSize: FONT_SIZES.LG,
    fontFamily: FONTS.BOLD,
    color: COLORS.SECONDARY[900],
  },
  subtitle: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
    marginTop: 2,
  },
  closeButton: {
    padding: 4,
  },
  loadingContainer: {
    padding: 60,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
  },
  emptyContainer: {
    padding: 60,
    alignItems: 'center',
  },
  emptyTitle: {
    marginTop: 16,
    fontSize: FONT_SIZES.LG,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[900],
  },
  emptySubtitle: {
    marginTop: 4,
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[600],
  },
  requestsList: {
    padding: 16,
  },
  requestCard: {
    backgroundColor: COLORS.SECONDARY[50],
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.PRIMARY[100],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  username: {
    fontSize: FONT_SIZES.BASE,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[900],
  },
  mentorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.SUCCESS[600],
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 3,
  },
  mentorBadgeText: {
    fontSize: 9,
    fontFamily: FONTS.SEMIBOLD,
    color: '#FFFFFF',
  },
  requestTime: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[500],
    marginTop: 2,
  },
  messageContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: COLORS.NEUTRAL.WHITE,
    borderRadius: 8,
  },
  messageLabel: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[600],
    marginBottom: 4,
  },
  messageText: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[800],
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  rejectButton: {
    backgroundColor: COLORS.ERROR[50],
    borderWidth: 1,
    borderColor: COLORS.ERROR[200],
  },
  rejectButtonText: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.ERROR[600],
  },
  approveButton: {
    backgroundColor: COLORS.SUCCESS[600],
  },
  approveButtonText: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.SEMIBOLD,
    color: '#FFFFFF',
  },
});

export default JoinRequestsModal;
