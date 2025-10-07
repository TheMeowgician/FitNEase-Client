import React, { createContext, useContext, useState, ReactNode } from 'react';

interface UserContextType {
  userData: any;
  updateUserData: (data: any) => void;
  clearUserData: () => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

interface UserProviderProps {
  children: ReactNode;
}

export const UserProvider: React.FC<UserProviderProps> = ({ children }) => {
  const [userData, setUserData] = useState(null);

  const updateUserData = (data: any) => {
    setUserData(data);
  };

  const clearUserData = () => {
    setUserData(null);
  };

  const value: UserContextType = {
    userData,
    updateUserData,
    clearUserData,
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = (): UserContextType => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};