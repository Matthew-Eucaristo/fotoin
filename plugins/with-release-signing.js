// Signs Android release builds with the upload key when its properties exist
// (FOTOIN_UPLOAD_* in ~/.gradle/gradle.properties). Without them, or with
// -PfotoinDebugSign (to test a minified build over an installed debug build),
// the release build uses the debug key, so contributors can still build.
const { withAppBuildGradle } = require('expo/config-plugins');

const MARKER = '// fotoin: release signing';

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let gradle = cfg.modResults.contents;
    if (gradle.includes(MARKER)) return cfg;

    gradle = gradle.replace(
      /signingConfigs \{/,
      `signingConfigs {
        ${MARKER}
        if (project.hasProperty('FOTOIN_UPLOAD_STORE_FILE') && !project.hasProperty('fotoinDebugSign')) {
            release {
                storeFile file(FOTOIN_UPLOAD_STORE_FILE)
                storePassword FOTOIN_UPLOAD_STORE_PASSWORD
                keyAlias FOTOIN_UPLOAD_KEY_ALIAS
                keyPassword FOTOIN_UPLOAD_KEY_PASSWORD
            }
        }`,
    );
    gradle = gradle.replace(
      /(buildTypes \{[\s\S]*?release \{[\s\S]*?)signingConfig signingConfigs\.debug/,
      `$1signingConfig((project.hasProperty('FOTOIN_UPLOAD_STORE_FILE') && !project.hasProperty('fotoinDebugSign')) ? signingConfigs.release : signingConfigs.debug)`,
    );
    cfg.modResults.contents = gradle;
    return cfg;
  });
};
