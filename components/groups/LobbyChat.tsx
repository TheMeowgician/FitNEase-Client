import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, FONT_SIZES } from '../../constants/colors';
import { useLobbyStore, selectChatMessages, type ChatMessage } from '../../stores/lobbyStore';
import { socialService } from '../../services/microservices/socialService';

interface LobbyChatProps {
  sessionId: string;
  currentUserId: number;
}

/**
 * LobbyChat Component
 *
 * Features:
 * - Real-time chat messages (synced via WebSocket)
 * - System vs user message styling
 * - Auto-scroll to newest messages
 * - Pagination ("Load More")
 * - Message deduplication (handled in store)
 * - Send message with enter key
 */
export default function LobbyChat({ sessionId, currentUserId }: LobbyChatProps) {
  const chatMessages = useLobbyStore(selectChatMessages);
  const addChatMessages = useLobbyStore((state) => state.addChatMessages);
  const removeTempMessage = useLobbyStore((state) => state.removeTempMessage);

  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [currentTempId, setCurrentTempId] = useState<string | null>(null);

  const flatListRef = useRef<FlatList>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (chatMessages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [chatMessages.length]);

  // Remove temp message when real message arrives
  useEffect(() => {
    if (currentTempId) {
      // Check if a real message from current user exists (not temp)
      const hasRealMessage = chatMessages.some(
        (m) =>
          m.user_id === currentUserId &&
          !m.message_id.startsWith('temp-') &&
          m.timestamp > Math.floor(Date.now() / 1000) - 5 // Within last 5 seconds
      );

      if (hasRealMessage) {
        removeTempMessage(currentTempId);
        setCurrentTempId(null);
      }
    }
  }, [chatMessages, currentTempId, currentUserId, removeTempMessage]);

  /**
   * Send message to lobby with optimistic UI update
   */
  const handleSendMessage = async () => {
    if (!messageText.trim() || isSending) return;

    const textToSend = messageText.trim();
    const tempMessageId = `temp-${Date.now()}-${Math.random()}`;

    // Optimistic UI update - add message immediately
    const optimisticMessage: ChatMessage = {
      message_id: tempMessageId,
      user_id: currentUserId,
      user_name: 'You',
      message: textToSend,
      timestamp: Math.floor(Date.now() / 1000),
      is_system_message: false,
    };

    addChatMessages([optimisticMessage]);
    setMessageText('');
    setIsSending(true);
    setCurrentTempId(tempMessageId); // Track temp message ID

    try {
      const response = await socialService.sendLobbyMessageV2(sessionId, textToSend);

      if (response.status === 'success') {
        // Temp message will be automatically removed when real message arrives via WebSocket
        console.log('✅ Message sent successfully');
      } else {
        throw new Error('Failed to send message');
      }
    } catch (error) {
      console.error('❌ Error sending message:', error);
      // Remove optimistic message on failure
      removeTempMessage(tempMessageId);
      setCurrentTempId(null);
      // Restore message text
      setMessageText(textToSend);
      alert('Failed to send message. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  /**
   * Load older messages (pagination)
   */
  const handleLoadMore = async () => {
    if (isLoadingMore || !hasMoreMessages) return;

    setIsLoadingMore(true);

    try {
      // Get oldest message timestamp for pagination
      const oldestMessage = chatMessages[0];
      const beforeTimestamp = oldestMessage?.timestamp;

      const response = await socialService.getChatMessagesV2(sessionId, {
        limit: 20,
        before: beforeTimestamp?.toString(),
      });

      if (response.status === 'success' && response.data) {
        const messages = response.data.messages || [];

        if (messages.length === 0 || !response.data.has_more) {
          setHasMoreMessages(false);
        }

        if (messages.length > 0) {
          // Map messages to ensure user_name is always a string
          const mappedMessages: ChatMessage[] = messages.map((msg) => ({
            ...msg,
            user_name: msg.user_name || 'Unknown',
          }));
          // Add to store (deduplication handled there)
          addChatMessages(mappedMessages);
        }
      }
    } catch (error) {
      console.error('❌ Error loading more messages:', error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  /**
   * Get initials from user name for avatar
   */
  const getInitials = (name: string) => {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  /**
   * Render individual chat message
   */
  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isSystemMessage = item.is_system_message;
    const isOwnMessage = item.user_id === currentUserId;

    if (isSystemMessage) {
      return (
        <View style={styles.systemMessageContainer}>
          <View style={styles.systemMessageBubble}>
            <Ionicons name="information-circle" size={14} color={COLORS.SECONDARY[600]} />
            <Text style={styles.systemMessageText}>{item.message}</Text>
          </View>
        </View>
      );
    }

    return (
      <View style={[styles.messageContainer, isOwnMessage && styles.ownMessageContainer]}>
        {/* Avatar for other users (left side) */}
        {!isOwnMessage && (
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>{getInitials(item.user_name)}</Text>
          </View>
        )}

        <View style={[styles.messageBubble, isOwnMessage && styles.ownMessageBubble]}>
          {!isOwnMessage && (
            <Text style={styles.messageSender}>{item.user_name}</Text>
          )}
          <Text style={[styles.messageText, isOwnMessage && styles.ownMessageText]}>
            {item.message}
          </Text>
          <Text style={[styles.messageTime, isOwnMessage && styles.ownMessageTime]}>
            {formatMessageTime(item.timestamp)}
          </Text>
        </View>
      </View>
    );
  };

  /**
   * Format timestamp to readable time
   */
  const formatMessageTime = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Messages List */}
      <FlatList
        ref={flatListRef}
        data={chatMessages}
        keyExtractor={(item) => item.message_id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messagesList}
        showsVerticalScrollIndicator={false}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={
          hasMoreMessages ? (
            <TouchableOpacity
              style={styles.loadMoreButton}
              onPress={handleLoadMore}
              disabled={isLoadingMore}
            >
              {isLoadingMore ? (
                <ActivityIndicator size="small" color={COLORS.PRIMARY[600]} />
              ) : (
                <>
                  <Ionicons name="arrow-up-circle-outline" size={20} color={COLORS.PRIMARY[600]} />
                  <Text style={styles.loadMoreText}>Load Earlier Messages</Text>
                </>
              )}
            </TouchableOpacity>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubbles-outline" size={48} color={COLORS.SECONDARY[300]} />
            <Text style={styles.emptyText}>No messages yet</Text>
            <Text style={styles.emptySubtext}>Start the conversation!</Text>
          </View>
        }
      />

      {/* Message Input */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Type a message..."
          placeholderTextColor={COLORS.SECONDARY[400]}
          value={messageText}
          onChangeText={setMessageText}
          multiline
          maxLength={500}
          editable={!isSending}
          onSubmitEditing={handleSendMessage}
          blurOnSubmit={false}
        />
        <TouchableOpacity
          style={[styles.sendButton, !messageText.trim() && styles.sendButtonDisabled]}
          onPress={handleSendMessage}
          disabled={!messageText.trim() || isSending}
        >
          {isSending ? (
            <ActivityIndicator size="small" color={COLORS.NEUTRAL.WHITE} />
          ) : (
            <Ionicons
              name="send"
              size={20}
              color={messageText.trim() ? COLORS.NEUTRAL.WHITE : COLORS.SECONDARY[400]}
            />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.NEUTRAL.WHITE,
  },
  messagesList: {
    padding: 16,
    flexGrow: 1,
  },
  loadMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginBottom: 8,
    backgroundColor: COLORS.PRIMARY[50],
    borderRadius: 8,
    gap: 8,
  },
  loadMoreText: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.PRIMARY[600],
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: FONT_SIZES.LG,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[600],
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[400],
    marginTop: 4,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-end',
    paddingHorizontal: 4,
  },
  ownMessageContainer: {
    flexDirection: 'row-reverse',
    alignSelf: 'flex-end',
  },
  avatarContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.PRIMARY[500],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginBottom: 2,
  },
  avatarText: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.NEUTRAL.WHITE,
  },
  messageBubble: {
    backgroundColor: COLORS.SECONDARY[100],
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    padding: 12,
    maxWidth: '70%',
  },
  ownMessageBubble: {
    backgroundColor: COLORS.PRIMARY[600],
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 4,
  },
  messageSender: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.PRIMARY[600],
    marginBottom: 4,
  },
  messageText: {
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[900],
    lineHeight: 20,
  },
  ownMessageText: {
    color: COLORS.NEUTRAL.WHITE,
  },
  messageTime: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[500],
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  ownMessageTime: {
    color: COLORS.PRIMARY[100],
  },
  systemMessageContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  systemMessageBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.WARNING[50],
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  systemMessageText: {
    fontSize: FONT_SIZES.XS,
    fontFamily: FONTS.SEMIBOLD,
    color: COLORS.SECONDARY[600],
    fontStyle: 'italic',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.SECONDARY[200],
    backgroundColor: COLORS.NEUTRAL.WHITE,
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.SECONDARY[50],
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: FONT_SIZES.SM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SECONDARY[900],
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.PRIMARY[600],
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: COLORS.SECONDARY[200],
  },
});
