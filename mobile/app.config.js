/**
 * Dynamic Expo config so EAS profile `env.EXPO_PUBLIC_API_URL` is visible at runtime
 * via Constants.expoConfig.extra.apiUrl (and Metro still reads EXPO_PUBLIC_* as usual).
 */
const appJson = require('./app.json');

/** @type {import('expo/config').ExpoConfig} */
const expo = {
  ...appJson.expo,
  extra: {
    ...(appJson.expo.extra ?? {}),
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? null,
    eas: {
      ...(appJson.expo.extra?.eas ?? {}),
      projectId: appJson.expo.extra?.eas?.projectId ?? '371731a7-c9e4-4569-bc23-6161696bd8f1',
    },
  },
};

module.exports = { expo };
