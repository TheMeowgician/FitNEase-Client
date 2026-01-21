import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { CustomAlert, AlertType, AlertButton } from '../components/ui/CustomAlert';

interface AlertOptions {
  type?: AlertType;
  title: string;
  message?: string;
  buttons?: AlertButton[];
  dismissable?: boolean;
}

interface AlertContextType {
  showAlert: (options: AlertOptions) => void;
  hideAlert: () => void;
  // Convenience methods
  success: (title: string, message?: string, onOk?: () => void) => void;
  error: (title: string, message?: string, onOk?: () => void) => void;
  warning: (title: string, message?: string, onOk?: () => void) => void;
  info: (title: string, message?: string, onOk?: () => void) => void;
  confirm: (
    title: string,
    message?: string,
    onConfirm?: () => void,
    onCancel?: () => void,
    confirmText?: string,
    cancelText?: string
  ) => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

interface AlertProviderProps {
  children: ReactNode;
}

export const AlertProvider: React.FC<AlertProviderProps> = ({ children }) => {
  const [visible, setVisible] = useState(false);
  const [alertOptions, setAlertOptions] = useState<AlertOptions>({
    title: '',
  });

  const showAlert = useCallback((options: AlertOptions) => {
    setAlertOptions(options);
    setVisible(true);
  }, []);

  const hideAlert = useCallback(() => {
    setVisible(false);
  }, []);

  // Convenience method for success alerts
  const success = useCallback(
    (title: string, message?: string, onOk?: () => void) => {
      showAlert({
        type: 'success',
        title,
        message,
        buttons: [
          {
            text: 'OK',
            style: 'default',
            onPress: onOk,
          },
        ],
      });
    },
    [showAlert]
  );

  // Convenience method for error alerts
  const error = useCallback(
    (title: string, message?: string, onOk?: () => void) => {
      showAlert({
        type: 'error',
        title,
        message,
        buttons: [
          {
            text: 'OK',
            style: 'default',
            onPress: onOk,
          },
        ],
      });
    },
    [showAlert]
  );

  // Convenience method for warning alerts
  const warning = useCallback(
    (title: string, message?: string, onOk?: () => void) => {
      showAlert({
        type: 'warning',
        title,
        message,
        buttons: [
          {
            text: 'OK',
            style: 'default',
            onPress: onOk,
          },
        ],
      });
    },
    [showAlert]
  );

  // Convenience method for info alerts
  const info = useCallback(
    (title: string, message?: string, onOk?: () => void) => {
      showAlert({
        type: 'info',
        title,
        message,
        buttons: [
          {
            text: 'OK',
            style: 'default',
            onPress: onOk,
          },
        ],
      });
    },
    [showAlert]
  );

  // Convenience method for confirmation dialogs
  const confirm = useCallback(
    (
      title: string,
      message?: string,
      onConfirm?: () => void,
      onCancel?: () => void,
      confirmText: string = 'Confirm',
      cancelText: string = 'Cancel'
    ) => {
      showAlert({
        type: 'confirm',
        title,
        message,
        buttons: [
          {
            text: cancelText,
            style: 'cancel',
            onPress: onCancel,
          },
          {
            text: confirmText,
            style: 'default',
            onPress: onConfirm,
          },
        ],
      });
    },
    [showAlert]
  );

  return (
    <AlertContext.Provider
      value={{
        showAlert,
        hideAlert,
        success,
        error,
        warning,
        info,
        confirm,
      }}
    >
      {children}
      <CustomAlert
        visible={visible}
        type={alertOptions.type}
        title={alertOptions.title}
        message={alertOptions.message}
        buttons={alertOptions.buttons}
        dismissable={alertOptions.dismissable}
        onDismiss={hideAlert}
      />
    </AlertContext.Provider>
  );
};

export const useAlert = (): AlertContextType => {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlert must be used within an AlertProvider');
  }
  return context;
};

export default AlertContext;
