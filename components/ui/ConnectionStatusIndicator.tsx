import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useWebSocket } from '../../contexts/WebSocketContext';

interface ConnectionStatusIndicatorProps {
  showDetails?: boolean;
}

export const ConnectionStatusIndicator: React.FC<ConnectionStatusIndicatorProps> = ({ showDetails = false }) => {
  const { connectionState, isConnected, reconnectAttempts, maxRetriesReached, manualReconnect } = useWebSocket();

  const getStatusColor = () => {
    if (isConnected) return '#10B981'; // green
    if (maxRetriesReached) return '#EF4444'; // red
    if (connectionState === 'reconnecting') return '#F59E0B'; // yellow/orange
    return '#6B7280'; // gray
  };

  const getStatusText = () => {
    if (isConnected) return 'Connected';
    if (maxRetriesReached) return 'Disconnected';
    if (connectionState === 'reconnecting') return `Reconnecting (${reconnectAttempts}/10)`;
    if (connectionState === 'connecting') return 'Connecting...';
    return 'Offline';
  };

  const getStatusIcon = () => {
    if (isConnected) return '●';
    if (maxRetriesReached) return '●';
    if (connectionState === 'reconnecting' || connectionState === 'connecting') return '◐';
    return '○';
  };

  return (
    <View style={styles.container}>
      <View style={styles.statusRow}>
        <Text style={[styles.statusDot, { color: getStatusColor() }]}>
          {getStatusIcon()}
        </Text>
        <Text style={[styles.statusText, { color: getStatusColor() }]}>
          {getStatusText()}
        </Text>
        {(connectionState === 'reconnecting' || connectionState === 'connecting') && (
          <ActivityIndicator size="small" color={getStatusColor()} style={styles.spinner} />
        )}
      </View>

      {showDetails && maxRetriesReached && (
        <TouchableOpacity
          style={styles.reconnectButton}
          onPress={manualReconnect}
        >
          <Text style={styles.reconnectButtonText}>Tap to Reconnect</Text>
        </TouchableOpacity>
      )}

      {showDetails && !isConnected && !maxRetriesReached && connectionState !== 'reconnecting' && (
        <Text style={styles.helpText}>
          Attempting to reconnect automatically...
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    alignItems: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  spinner: {
    marginLeft: 4,
  },
  reconnectButton: {
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#3B82F6',
    borderRadius: 6,
  },
  reconnectButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  helpText: {
    marginTop: 4,
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'center',
  },
});
