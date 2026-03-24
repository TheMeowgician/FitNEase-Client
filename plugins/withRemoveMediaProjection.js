const { withAndroidManifest } = require('expo/config-plugins');

/**
 * Config plugin to remove FOREGROUND_SERVICE_MEDIA_PROJECTION permission.
 *
 * This permission leaks in from react-native-agora's bundled
 * "full-screen-sharing" module, but FitNEase only uses Agora for
 * camera+mic video calling — no screen sharing/capture is used.
 *
 * Removing it prevents Google Play from requiring a media projection
 * declaration form.
 */
const withRemoveMediaProjection = (config) => {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;

    // Add tools namespace if not present
    if (!manifest.$['xmlns:tools']) {
      manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    }

    // Ensure uses-permission array exists
    if (!manifest['uses-permission']) {
      manifest['uses-permission'] = [];
    }

    // Check if already added
    const alreadyExists = manifest['uses-permission'].some(
      (perm) =>
        perm.$['android:name'] === 'android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION'
    );

    if (!alreadyExists) {
      manifest['uses-permission'].push({
        $: {
          'android:name': 'android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION',
          'tools:node': 'remove',
        },
      });
    }

    return config;
  });
};

module.exports = withRemoveMediaProjection;
