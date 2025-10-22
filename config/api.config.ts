// ==========================================
// 🌐 NETWORK CONFIGURATION - FitNEase Team
// ==========================================
// Team Members: Gab, Wimari, Nhiko, Chrystian
// ==========================================

// 🔧 STEP 1: CHOOSE ENVIRONMENT
// - 'development': Local WiFi network (for Expo Go development)
// - 'testing': ngrok tunnels (for APK testing with groupmates)
type Environment = 'development' | 'testing';
const ENVIRONMENT = 'testing' as Environment;

// 🔧 STEP 2: SET ACTIVE MEMBER (for development mode)
const ACTIVE_MEMBER = 'Gab'; // Options: 'Gab', 'Wimari', 'Nhiko', 'Chrystian'

// 🔧 STEP 3: UPDATE YOUR IP ADDRESS (for development mode)
// To find your computer's IP address:
// - Windows: Run "ipconfig" in Command Prompt, look for "IPv4 Address"
// - Mac: Run "ifconfig | grep 'inet '" in Terminal
// - It usually looks like: 192.168.x.x or 172.20.x.x

// Team Member IP Addresses (update your own IP here)
const TEAM_IPS = {
  Gab: '192.168.1.3',        // Gab: Update with your IP
  Wimari: 'CHANGE_THIS_TO_YOUR_IP',     // Wimari: Update with your IP
  Nhiko: 'CHANGE_THIS_TO_YOUR_IP',      // Nhiko: Update with your IP
  Chrystian: 'CHANGE_THIS_TO_YOUR_IP',  // Chrystian: Update with your IP
};

// 🔧 STEP 4: UPDATE NGROK URL (for testing mode)
// After starting ngrok, you'll get ONLY 1 URL (Ultimate Simplicity = FREE TIER!)
// Example:
//   gateway  https://abc123.ngrok.io
const NGROK_URLS = {
  GATEWAY: 'https://malaysia-overextreme-noneffusively.ngrok-free.dev',  // ONE URL routes to EVERYTHING (including WebSocket)!
};

// Auto-select configuration based on environment
const YOUR_COMPUTER_IP = TEAM_IPS[ACTIVE_MEMBER];

const getDevelopmentConfig = () => ({
  BASE_URL: `http://${YOUR_COMPUTER_IP}:8090`,
  AUTH_SERVICE_URL: `http://${YOUR_COMPUTER_IP}:8090/auth`,
  CONTENT_SERVICE_URL: `http://${YOUR_COMPUTER_IP}:8090/content`,
  TRACKING_SERVICE_URL: `http://${YOUR_COMPUTER_IP}:8090/tracking`,
  MEDIA_SERVICE_URL: `http://${YOUR_COMPUTER_IP}:8090/media`,
  PLANNING_SERVICE_URL: `http://${YOUR_COMPUTER_IP}:8090/planning`,
  SOCIAL_SERVICE_URL: `http://${YOUR_COMPUTER_IP}:8090/social`,
  ENGAGEMENT_SERVICE_URL: `http://${YOUR_COMPUTER_IP}:8090/engagement`,
  COMMS_SERVICE_URL: `http://${YOUR_COMPUTER_IP}:8090/comms`,
  OPERATIONS_SERVICE_URL: `http://${YOUR_COMPUTER_IP}:8090/ops`,
  ML_SERVICE_URL: `http://${YOUR_COMPUTER_IP}:8090/ml`,
  REVERB_WS_HOST: YOUR_COMPUTER_IP,
  REVERB_WS_PORT: 8091,
});

const getTestingConfig = () => {
  // Extract host from gateway URL (remove https://)
  const gatewayHost = NGROK_URLS.GATEWAY.replace('https://', '');

  return {
    // API Gateway Pattern: ONE URL routes to EVERYTHING!
    BASE_URL: NGROK_URLS.GATEWAY,
    AUTH_SERVICE_URL: `${NGROK_URLS.GATEWAY}/auth`,         // Gateway routes to auth service
    CONTENT_SERVICE_URL: `${NGROK_URLS.GATEWAY}/content`,   // Gateway routes to content service
    TRACKING_SERVICE_URL: `${NGROK_URLS.GATEWAY}/tracking`, // Gateway routes to tracking service
    MEDIA_SERVICE_URL: `${NGROK_URLS.GATEWAY}/media`,
    PLANNING_SERVICE_URL: `${NGROK_URLS.GATEWAY}/planning`,
    SOCIAL_SERVICE_URL: `${NGROK_URLS.GATEWAY}/social`,
    ENGAGEMENT_SERVICE_URL: `${NGROK_URLS.GATEWAY}/engagement`,
    COMMS_SERVICE_URL: `${NGROK_URLS.GATEWAY}/comms`,
    OPERATIONS_SERVICE_URL: `${NGROK_URLS.GATEWAY}/ops`,
    ML_SERVICE_URL: `${NGROK_URLS.GATEWAY}/ml`,
    REVERB_WS_HOST: gatewayHost,  // Same URL, gateway routes WebSocket too!
    REVERB_WS_PORT: 443, // ngrok uses HTTPS port wa
  };
};

// Export the appropriate config based on environment
export const API_CONFIG = ENVIRONMENT === 'testing'
  ? getTestingConfig()       // ✅ Use ngrok URLs for testing (APK)
  : getDevelopmentConfig();  // ✅ Use local IP for development (Expo Go)

// 💡 HOW TO USE:
//
// FOR LOCAL DEVELOPMENT (Expo Go):
// 1. Set ENVIRONMENT = 'development'
// 2. Update ACTIVE_MEMBER to your name
// 3. Update your IP in TEAM_IPS
// 4. Make sure phone and laptop are on SAME WiFi
//
// FOR TESTING APK WITH GROUPMATES:
// 1. Start ngrok: ngrok start --all --config ngrok.yml
// 2. Copy all ngrok URLs from terminal
// 3. Paste URLs into NGROK_URLS object above
// 4. Set ENVIRONMENT = 'testing'
// 5. Build APK: eas build -p android --profile preview
// 6. Share APK with groupmates
//
// IMPORTANT: Keep ngrok running while groupmates are testing!
