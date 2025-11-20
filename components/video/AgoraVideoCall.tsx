import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Platform } from 'react-native';
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
}

export default function AgoraVideoCall({
  sessionId,
  userId,
  channelName,
  token,
  appId,
  onLeave,
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

  const setupVideoSDKEngine = async () => {
    try {
      // Create RTC engine
      const engine = createAgoraRtcEngine();
      engine.initialize({ appId });

      agoraEngineRef.current = engine;

      // Enable video
      engine.enableVideo();

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
});
