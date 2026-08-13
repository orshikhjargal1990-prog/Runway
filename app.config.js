const appJson = require('./app.json');

const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '';

module.exports = {
  expo: {
    ...appJson.expo,
    plugins: [...(appJson.expo.plugins || []), 'expo-video'],
    ios: {
      ...appJson.expo.ios,
      config: googleMapsApiKey ? { googleMapsApiKey } : appJson.expo.ios?.config
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
      googleMapsApiKeyConfigured: Boolean(googleMapsApiKey)
    }
  }
};
