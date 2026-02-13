import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Platform, PermissionsAndroid } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  createAgoraRtcEngine,
  IRtcEngine,
  ChannelProfileType,
  ClientRoleType,
  RtcSurfaceView,
} from 'react-native-agora';
import { agoraService } from '../../services/agoraService';

interface AgoraVideoCallProps {
  sessionId: string;
  userId: number;
  channelName: string;
  token: string;
  appId: string;
  onLeave?: () => void;
  compact?: boolean; // Compact mode for floating window
  onExpand?: () => void; // Callback when user wants to expand to full-screen
  onMinimize?: () => void; // Callback when user wants to minimize from full-screen
}

export default function AgoraVideoCall({
  sessionId,
  userId,
  channelName,
  token,
  appId,
  onLeave,
  onExpand,
  onMinimize,
  compact = false,
}: AgoraVideoCallProps) {
  const agoraEngineRef = useRef<IRtcEngine | null>(null);
  const [isJoined, setIsJoined] = useState(false);
  const [remoteUids, setRemoteUids] = useState<number[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  useEffect(() => {
    setupVideoSDKEngine();
    return () => {
      leaveChannel();
    };
  }, []);

  const getPermissions = async (): Promise<boolean> => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.CAMERA,
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        ]);
        const cameraGranted = granted['android.permission.CAMERA'] === PermissionsAndroid.RESULTS.GRANTED;
        const audioGranted = granted['android.permission.RECORD_AUDIO'] === PermissionsAndroid.RESULTS.GRANTED;
        console.log('📹 Permissions:', { cameraGranted, audioGranted });
        return cameraGranted && audioGranted;
      } catch (err) {
        console.error('❌ Permission request error:', err);
        return false;
      }
    }
    return true; // iOS permissions handled via Info.plist
  };

  const setupVideoSDKEngine = async () => {
    try {
      // Request camera and microphone permissions (required on Android)
      const hasPermissions = await getPermissions();
      if (!hasPermissions) {
        console.error('❌ Camera/microphone permissions denied');
        return;
      }

      // Create RTC engine
      const engine = createAgoraRtcEngine();
      engine.initialize({ appId });

      agoraEngineRef.current = engine;

      // Enable video and start local camera preview
      engine.enableVideo();
      engine.startPreview();

      // Register event handlers
      engine.registerEventHandler({
        onUserJoined: (_connection, uid, _elapsed) => {
          console.log('📹 User joined:', uid);
          setRemoteUids((prev) => [...prev, uid]);
        },
        onUserOffline: (_connection, uid, _reason) => {
          console.log('📹 User left:', uid);
          setRemoteUids((prev) => prev.filter((id) => id !== uid));
        },
        onJoinChannelSuccess: (_connection, _elapsed) => {
          console.log('✅ Joined channel successfully');
          setIsJoined(true);
        },
        onError: (err) => {
          console.error('❌ Agora error:', err);
        },
      });

      // Set channel profile
      engine.setChannelProfile(ChannelProfileType.ChannelProfileCommunication);
      engine.setClientRole(ClientRoleType.ClientRoleBroadcaster);

      // Join channel
      engine.joinChannel(token, channelName, userId, {});

      console.log('📹 Joining Agora channel:', channelName);
    } catch (error) {
      console.error('❌ Failed to setup Agora SDK:', error);
    }
  };

  const leaveChannel = async () => {
    try {
      if (agoraEngineRef.current) {
        agoraEngineRef.current.stopPreview();
        agoraEngineRef.current.leaveChannel();
        agoraEngineRef.current.release();
        console.log('📹 Left channel');
      }
      setIsJoined(false);
      setRemoteUids([]);

      // Notify backend
      await agoraService.revokeToken(sessionId, userId);

      onLeave?.();
    } catch (error) {
      console.error('❌ Failed to leave channel:', error);
    }
  };

  const toggleMute = async () => {
    try {
      const newMuteState = !isMuted;
      agoraEngineRef.current?.muteLocalAudioStream(newMuteState);
      setIsMuted(newMuteState);

      // Update backend
      await agoraService.updateMediaStatus(sessionId, userId, !isVideoOff, !newMuteState);

      console.log('🎤 Microphone:', newMuteState ? 'muted' : 'unmuted');
    } catch (error) {
      console.error('❌ Failed to toggle mute:', error);
    }
  };

  const toggleVideo = async () => {
    try {
      const newVideoState = !isVideoOff;
      agoraEngineRef.current?.muteLocalVideoStream(newVideoState);
      setIsVideoOff(newVideoState);

      // Update backend
      await agoraService.updateMediaStatus(sessionId, userId, !newVideoState, !isMuted);

      console.log('📹 Camera:', newVideoState ? 'off' : 'on');
    } catch (error) {
      console.error('❌ Failed to toggle video:', error);
    }
  };

  // Compact mode - small floating window
  if (compact) {
    return (
      <View style={styles.compactContainer}>
        {/* Show first remote user, or local if no remote users */}
        {remoteUids.length > 0 ? (
          <RtcSurfaceView
            canvas={{ uid: remoteUids[0] }}
            style={styles.compactVideo}
          />
        ) : isJoined && !isVideoOff ? (
          <RtcSurfaceView
            canvas={{ uid: 0 }}
            style={styles.compactVideo}
          />
        ) : (
          <View style={styles.compactPlaceholder}>
            <Ionicons name="people-outline" size={32} color="#666" />
          </View>
        )}

        {/* Expand button - top-left */}
        {onExpand && (
          <TouchableOpacity
            style={styles.expandButton}
            onPress={onExpand}
          >
            <Ionicons name="expand" size={18} color="#fff" />
          </TouchableOpacity>
        )}

        {/* Mini controls overlay */}
        <View style={styles.compactControls}>
          <TouchableOpacity
            style={styles.compactControlButton}
            onPress={toggleMute}
          >
            <Ionicons
              name={isMuted ? 'mic-off' : 'mic'}
              size={16}
              color={isMuted ? '#EF4444' : '#fff'}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.compactControlButton}
            onPress={toggleVideo}
          >
            <Ionicons
              name={isVideoOff ? 'videocam-off' : 'videocam'}
              size={16}
              color={isVideoOff ? '#EF4444' : '#fff'}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.compactControlButton, styles.compactLeaveButton]}
            onPress={leaveChannel}
          >
            <Ionicons name="close" size={16} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Participant count badge */}
        {remoteUids.length > 0 && (
          <View style={styles.participantBadge}>
            <Text style={styles.participantCount}>{remoteUids.length + 1}</Text>
          </View>
        )}
      </View>
    );
  }

  // Full mode - original layout
  return (
    <View style={styles.container}>
      {/* Local video (yourself) */}
      <View style={styles.localVideoContainer}>
        {isJoined && !isVideoOff ? (
          <RtcSurfaceView
            canvas={{ uid: 0 }}
            style={styles.localVideo}
          />
        ) : (
          <View style={styles.videoPlaceholder}>
            <Ionicons name="videocam-off" size={48} color="#fff" />
            <Text style={styles.placeholderText}>Camera Off</Text>
          </View>
        )}
      </View>

      {/* Minimize button - top-left, rendered AFTER local video so it's on top on Android */}
      {onMinimize && (
        <TouchableOpacity
          style={styles.minimizeButton}
          onPress={onMinimize}
        >
          <Ionicons name="contract" size={20} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Remote videos (other participants) */}
      <View style={styles.remoteVideosContainer}>
        {remoteUids.map((uid) => (
          <View key={uid} style={styles.remoteVideoContainer}>
            <RtcSurfaceView
              canvas={{ uid }}
              style={styles.remoteVideo}
            />
            <Text style={styles.uidLabel}>User {uid}</Text>
          </View>
        ))}
        {remoteUids.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={48} color="#666" />
            <Text style={styles.emptyStateText}>Waiting for others to join...</Text>
          </View>
        )}
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.controlButton, isMuted && styles.controlButtonActive]}
          onPress={toggleMute}
        >
          <Ionicons
            name={isMuted ? 'mic-off' : 'mic'}
            size={24}
            color={isMuted ? '#EF4444' : '#fff'}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, isVideoOff && styles.controlButtonActive]}
          onPress={toggleVideo}
        >
          <Ionicons
            name={isVideoOff ? 'videocam-off' : 'videocam'}
            size={24}
            color={isVideoOff ? '#EF4444' : '#fff'}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, styles.leaveButton]}
          onPress={leaveChannel}
        >
          <Ionicons name="call" size={24} color="#fff" />
          <Text style={styles.leaveButtonText}>Leave</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  localVideoContainer: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 120,
    height: 160,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#fff',
    zIndex: 10,
  },
  localVideo: {
    width: '100%',
    height: '100%',
  },
  videoPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#fff',
    fontSize: 12,
    marginTop: 8,
  },
  remoteVideosContainer: {
    flex: 1,
    padding: 20,
    paddingTop: 60,
  },
  remoteVideoContainer: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
    position: 'relative',
  },
  remoteVideo: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },
  uidLabel: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    color: '#fff',
    fontSize: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyStateText: {
    color: '#666',
    fontSize: 16,
    marginTop: 12,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
    gap: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  controlButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlButtonActive: {
    backgroundColor: 'rgba(239,68,68,0.3)',
  },
  leaveButton: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 20,
    flexDirection: 'row',
    gap: 8,
    width: 'auto',
  },
  leaveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Compact mode styles
  compactContainer: {
    width: 150,
    height: 200,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  compactVideo: {
    width: '100%',
    height: '100%',
  },
  compactPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  compactControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  compactControlButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  compactLeaveButton: {
    backgroundColor: '#EF4444',
  },
  participantBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(34, 197, 94, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  participantCount: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  expandButton: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  minimizeButton: {
    position: 'absolute',
    top: 20,
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
});
