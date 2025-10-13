import React, { createContext, useContext, useState, ReactNode } from 'react';

interface Member {
  user_id: number;
  name: string;
  status: 'waiting' | 'ready';
}

interface ChatMessage {
  id: string;
  userId: number;
  userName: string;
  message: string;
  timestamp: number;
  isOwnMessage: boolean;
  isSystemMessage?: boolean;
}

interface LobbyState {
  sessionId: string;
  groupId: string;
  workoutData: any;
  initiatorId: string;
  isCreatingLobby: string;
  isMinimized: boolean;
  members?: Member[];
  chatMessages?: ChatMessage[];
}

interface LobbyContextType {
  lobbyState: LobbyState | null;
  isInLobby: boolean;
  lobbyNotificationCount: number;
  incrementLobbyNotifications: () => void;
  clearLobbyNotifications: () => void;
  minimizeLobby: () => void;
  restoreLobby: () => void;
  joinLobby: (params: Omit<LobbyState, 'isMinimized'>) => void;
  leaveLobby: () => void;
  updateLobbyMembers: (members: Member[]) => void;
  updateLobbyChatMessages: (messages: ChatMessage[]) => void;
}

const LobbyContext = createContext<LobbyContextType | undefined>(undefined);

export function LobbyProvider({ children }: { children: ReactNode }) {
  const [lobbyState, setLobbyState] = useState<LobbyState | null>(null);
  const [lobbyNotificationCount, setLobbyNotificationCount] = useState(0);

  const joinLobby = (params: Omit<LobbyState, 'isMinimized'>) => {
    console.log('🏋️ Joining lobby:', params);
    setLobbyState({
      ...params,
      isMinimized: false,
    });
  };

  const minimizeLobby = () => {
    console.log('📉 Minimizing lobby, current state:', lobbyState);
    if (lobbyState) {
      const newState = {
        ...lobbyState,
        isMinimized: true,
      };
      console.log('📉 Setting new minimized state:', newState);
      setLobbyState(newState);
    } else {
      console.log('⚠️ Cannot minimize - no lobby state exists');
    }
  };

  const restoreLobby = () => {
    console.log('📈 Restoring lobby');
    if (lobbyState) {
      setLobbyState({
        ...lobbyState,
        isMinimized: false,
      });
      // Clear notifications when restoring
      setLobbyNotificationCount(0);
    }
  };

  const leaveLobby = () => {
    console.log('🚪 Leaving lobby');
    setLobbyState(null);
    setLobbyNotificationCount(0);
  };

  const incrementLobbyNotifications = () => {
    setLobbyNotificationCount((prev) => prev + 1);
  };

  const clearLobbyNotifications = () => {
    setLobbyNotificationCount(0);
  };

  const updateLobbyMembers = (members: Member[]) => {
    if (lobbyState) {
      setLobbyState({
        ...lobbyState,
        members,
      });
    }
  };

  const updateLobbyChatMessages = (messages: ChatMessage[]) => {
    if (lobbyState) {
      setLobbyState({
        ...lobbyState,
        chatMessages: messages,
      });
    }
  };

  const isInLobby = lobbyState !== null;

  return (
    <LobbyContext.Provider
      value={{
        lobbyState,
        isInLobby,
        lobbyNotificationCount,
        incrementLobbyNotifications,
        clearLobbyNotifications,
        minimizeLobby,
        restoreLobby,
        joinLobby,
        leaveLobby,
        updateLobbyMembers,
        updateLobbyChatMessages,
      }}
    >
      {children}
    </LobbyContext.Provider>
  );
}

export const useLobby = () => {
  const context = useContext(LobbyContext);
  if (!context) {
    throw new Error('useLobby must be used within LobbyProvider');
  }
  return context;
};
