// ==========================================
// 🌐 NETWORK CONFIGURATION
// ==========================================
// QUICK SWITCH: Change USE_EMULATOR to switch between emulator and real device
// ==========================================

// 🔧 TOGGLE THIS VALUE:
const USE_EMULATOR = false; // Set to false when using real phone

// Network IPs
const EMULATOR_IP = '10.0.2.2'; // Android Emulator (special alias for host)
const HOME_LAN_IP = '192.168.1.5'; // Your home WiFi IP
const SCHOOL_LAN_IP = '172.20.10.5'; // Your school WiFi IP

// Auto-select IP based on USE_EMULATOR flag
const BASE_IP = USE_EMULATOR ? EMULATOR_IP : HOME_LAN_IP;

// 💡 TIP: When using real phone:
// 1. Set USE_EMULATOR = false
// 2. Make sure your phone and laptop are on the same WiFi
// 3. Update HOME_LAN_IP or SCHOOL_LAN_IP if your computer's IP changed
// 4. To find your computer's IP: Run "ipconfig" in Command Prompt, look for "IPv4 Address"

export const API_CONFIG = {
  BASE_URL: `http://${BASE_IP}:8000`,
  AUTH_SERVICE_URL: `http://${BASE_IP}:8000`,
  CONTENT_SERVICE_URL: `http://${BASE_IP}:8002`,
  TRACKING_SERVICE_URL: `http://${BASE_IP}:8007`,
  PLANNING_SERVICE_URL: `http://${BASE_IP}:8005`,
  SOCIAL_SERVICE_URL: `http://${BASE_IP}:8006`,
  ML_SERVICE_URL: `http://${BASE_IP}:8009`,
  ENGAGEMENT_SERVICE_URL: `http://${BASE_IP}:8003`,
  COMMS_SERVICE_URL: `http://${BASE_IP}:8001`,
  MEDIA_SERVICE_URL: `http://${BASE_IP}:8004`,
  OPS_SERVICE_URL: `http://${BASE_IP}:8010`,
};
