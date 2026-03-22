const { withAppBuildGradle } = require('expo/config-plugins');

/**
 * Config plugin to filter Android ABIs for RELEASE builds only.
 * Keeps only ARM architectures (arm64-v8a + armeabi-v7a).
 * Removes x86/x86_64 (emulator-only) to reduce AAB/APK size.
 *
 * Debug builds (development profile) are NOT affected,
 * so emulators continue to work normally.
 */
const withAbiFilters = (config) => {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.contents.includes('abiFilters')) {
      return config;
    }

    // Insert into buildTypes > release block (Gradle merges with existing release config)
    // This ensures only release builds are filtered — debug builds keep all ABIs
    config.modResults.contents = config.modResults.contents.replace(
      /buildTypes\s*\{/,
      `buildTypes {
        release {
            ndk {
                abiFilters "arm64-v8a", "armeabi-v7a"
            }
        }`
    );

    return config;
  });
};

module.exports = withAbiFilters;
