// ==========================================
// 🌐 NETWORK CONFIGURATION - FitNEase Team
// ==========================================
// Team Members: Gab, Wimari, Nhiko, Chrystian
// ==========================================

// 🔧 STEP 1: SET ACTIVE MEMBER (Change this to switch between team members)
const ACTIVE_MEMBER = 'Gab'; // Options: 'Gab', 'Wimari', 'Nhiko', 'Chrystian'

// 🔧 STEP 2: UPDATE YOUR IP ADDRESS
// To find your computer's IP address:
// - Windows: Run "ipconfig" in Command Prompt, look for "IPv4 Address"
// - Mac: Run "ifconfig | grep 'inet '" in Terminal
// - It usually looks like: 192.168.x.x or 172.20.x.x

// Team Member IP Addresses (update your own IP here)
const TEAM_IPS = {
  Gab: '192.168.1.5',        // Gab: Update with your IP
  Wimari: 'CHANGE_THIS_TO_YOUR_IP',     // Wimari: Update with your IP
  Nhiko: 'CHANGE_THIS_TO_YOUR_IP',      // Nhiko: Update with your IP
  Chrystian: 'CHANGE_THIS_TO_YOUR_IP',  // Chrystian: Update with your IP
};

// Auto-select IP based on active member
const YOUR_COMPUTER_IP = TEAM_IPS[ACTIVE_MEMBER];

// 💡 HOW TO USE:
// 1. Each team member updates their IP in TEAM_IPS object above
// 2. Change ACTIVE_MEMBER to your name when testing
// 3. Make sure your phone and laptop are on the SAME WiFi network
// 4. If connection fails, verify your IP hasn't changed

export const API_CONFIG = {
  BASE_URL: `http://${YOUR_COMPUTER_IP}:8000`,
  AUTH_SERVICE_URL: `http://${YOUR_COMPUTER_IP}:8000`,
  CONTENT_SERVICE_URL: `http://${YOUR_COMPUTER_IP}:8002`,
  TRACKING_SERVICE_URL: `http://${YOUR_COMPUTER_IP}:8007`,
  PLANNING_SERVICE_URL: `http://${YOUR_COMPUTER_IP}:8005`,
  SOCIAL_SERVICE_URL: `http://${YOUR_COMPUTER_IP}:8006`,
  ML_SERVICE_URL: `http://${YOUR_COMPUTER_IP}:8009`,
  ENGAGEMENT_SERVICE_URL: `http://${YOUR_COMPUTER_IP}:8003`,
  COMMS_SERVICE_URL: `http://${YOUR_COMPUTER_IP}:8001`,
  MEDIA_SERVICE_URL: `http://${YOUR_COMPUTER_IP}:8004`,
  OPS_SERVICE_URL: `http://${YOUR_COMPUTER_IP}:8010`,
};
