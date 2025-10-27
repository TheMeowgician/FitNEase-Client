// ==========================================
// 🌐 NETWORK CONFIGURATION - FitNEase Team
// ==========================================
// Team Members: Gab, Wimari, Nhiko, Chrystian
// ==========================================

// 🔧 STEP 1: CHOOSE ENVIRONMENT
// - 'development': Local WiFi network (for Expo Go development)
// - 'testing': ngrok tunnels (for APK testing with groupmates)
// - 'production': AWS EC2 server (live deployment)
type Environment = 'development' | 'testing' | 'production';
const ENVIRONMENT = 'development' as Environment;  // ⚠️ DEVELOPMENT MODE - Testing Weekly Plans Feature #4

// 🔧 STEP 2: SET ACTIVE MEMBER (for development mode)
const ACTIVE_MEMBER = 'Gab'; // Options: 'Gab', 'Wimari', 'Nhiko', 'Chrystian'

// 🔧 STEP 3: UPDATE YOUR IP ADDRESS (for development mode)
const TEAM_IPS = {
  Gab: '192.168.1.3',
  Wimari: 'CHANGE_THIS_TO_YOUR_IP',
  Nhiko: 'CHANGE_THIS_TO_YOUR_IP',
  Chrystian: 'CHANGE_THIS_TO_YOUR_IP',
};

// 🔧 STEP 4: UPDATE NGROK URL (for testing mode)
const NGROK_URLS = {
  GATEWAY: 'https://malaysia-overextreme-noneffusively.ngrok-free.dev',
};

// 🔧 STEP 5: AWS PRODUCTION SERVER (NEW!)
const PRODUCTION_CONFIG = {
  SERVER_IP: '18.136.99.170',
  GATEWAY_PORT: '8090',
  WS_PORT: '8091',
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
  const gatewayHost = NGROK_URLS.GATEWAY.replace('https://', '');
  return {
    BASE_URL: NGROK_URLS.GATEWAY,
    AUTH_SERVICE_URL: `${NGROK_URLS.GATEWAY}/auth`,
    CONTENT_SERVICE_URL: `${NGROK_URLS.GATEWAY}/content`,
    TRACKING_SERVICE_URL: `${NGROK_URLS.GATEWAY}/tracking`,
    MEDIA_SERVICE_URL: `${NGROK_URLS.GATEWAY}/media`,
    PLANNING_SERVICE_URL: `${NGROK_URLS.GATEWAY}/planning`,
    SOCIAL_SERVICE_URL: `${NGROK_URLS.GATEWAY}/social`,
    ENGAGEMENT_SERVICE_URL: `${NGROK_URLS.GATEWAY}/engagement`,
    COMMS_SERVICE_URL: `${NGROK_URLS.GATEWAY}/comms`,
    OPERATIONS_SERVICE_URL: `${NGROK_URLS.GATEWAY}/ops`,
    ML_SERVICE_URL: `${NGROK_URLS.GATEWAY}/ml`,
    REVERB_WS_HOST: gatewayHost,
    REVERB_WS_PORT: 443,
  };
};

// ✅ NEW: Production configuration for AWS EC2
const getProductionConfig = () => {
  const BASE = `http://${PRODUCTION_CONFIG.SERVER_IP}:${PRODUCTION_CONFIG.GATEWAY_PORT}`;
  
  return {
    BASE_URL: BASE,
    AUTH_SERVICE_URL: `${BASE}/auth`,
    CONTENT_SERVICE_URL: `${BASE}/content`,
    TRACKING_SERVICE_URL: `${BASE}/tracking`,
    MEDIA_SERVICE_URL: `${BASE}/media`,
    PLANNING_SERVICE_URL: `${BASE}/planning`,
    SOCIAL_SERVICE_URL: `${BASE}/social`,
    ENGAGEMENT_SERVICE_URL: `${BASE}/engagement`,
    COMMS_SERVICE_URL: `${BASE}/comms`,
    OPERATIONS_SERVICE_URL: `${BASE}/ops`,
    ML_SERVICE_URL: `${BASE}/ml`,
    REVERB_WS_HOST: PRODUCTION_CONFIG.SERVER_IP,
    REVERB_WS_PORT: parseInt(PRODUCTION_CONFIG.WS_PORT),
  };
};

// Export the appropriate config based on environment
export const API_CONFIG = 
  ENVIRONMENT === 'production' ? getProductionConfig() :   // ✅ AWS EC2 production
  ENVIRONMENT === 'testing' ? getTestingConfig() :         // ngrok for testing
  getDevelopmentConfig();                                   // local development

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
// 2. Copy ngrok URLs and update NGROK_URLS
// 3. Set ENVIRONMENT = 'testing'
// 4. Build APK: eas build -p android --profile preview
//
// FOR PRODUCTION (AWS EC2):
// 1. Set ENVIRONMENT = 'production'
// 2. Your app will connect to: http://18.136.99.170:8090
// 3. All services work through the API Gateway
// 4. Available 24/7 - no need to run anything locally!