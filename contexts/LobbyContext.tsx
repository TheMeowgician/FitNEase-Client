import React, { createContext, useContext, useState, ReactNode } from 'react';

interface LobbyState {
  sessionId: string;
  groupId: string;
  workoutData: any;
  initiatorId: string;
  isCreatingLobby: string;
  isMinimized: boolean;
}

interface LobbyContextType {
  lobbyState: LobbyState | null;
  isInLobby: boolean;
  minimizeLobby: () => void;
  restoreLobby: () => void;
  joinLobby: (params: Omit<LobbyState, 'isMinimized'>) => void;
  leaveLobby: () => void;
}

const LobbyContext = createContext<LobbyContextType | undefined>(undefined);

export function LobbyProvider({ children }: { children: ReactNode }) {
  const [lobbyState, setLobbyState] = useState<LobbyState | null>(null);

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
    }
  };

  const leaveLobby = () => {
    console.log('🚪 Leaving lobby');
    setLobbyState(null);
  };

  const isInLobby = lobbyState !== null;

  return (
    <LobbyContext.Provider
      value={{
        lobbyState,
        isInLobby,
        minimizeLobby,
        restoreLobby,
        joinLobby,
        leaveLobby,
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
