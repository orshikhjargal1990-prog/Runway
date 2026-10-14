const appJson = require('./app.json');

const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '';

module.exports = {
  expo: {
    ...appJson.expo,
    plugins: [...(appJson.expo.plugins || []), 'expo-video'],
    ios: {
      ...appJson.expo.ios,
      config: {
        ...appJson.expo.ios?.config,
        ...(googleMapsApiKey ? { googleMapsApiKey } : {}),
        usesNonExemptEncryption: false
      }
    },
    android: {
      ...appJson.expo.android,
      config: googleMapsApiKey
        ? {
            ...appJson.expo.android?.config,
            googleMaps: { apiKey: googleMapsApiKey }
          }
        : appJson.expo.android?.config
    },
    extra: {
      ...appJson.expo.extra,
      googleMapsApiKeyConfigured: Boolean(googleMapsApiKey),
      eas: {
        ...appJson.expo.extra?.eas,
        projectId: '05b0602d-f6ce-4b5e-9e50-780f8b08cbc6'
      }
    }
  }
};
