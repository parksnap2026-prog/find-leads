let runtimeGoogleKey = process.env.GOOGLE_PLACES_API_KEY ?? "";

export function getGoogleApiKey() {
  return runtimeGoogleKey;
}

export function setGoogleApiKey(key: string) {
  runtimeGoogleKey = key;
}
