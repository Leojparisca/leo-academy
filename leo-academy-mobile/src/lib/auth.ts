import * as SecureStore from "expo-secure-store";
const TOKEN_KEY = "mobile_session_token";
export const getSessionToken = () => SecureStore.getItemAsync(TOKEN_KEY);
export const setSessionToken = (token: string) => SecureStore.setItemAsync(TOKEN_KEY, token);
export const clearSessionToken = () => SecureStore.deleteItemAsync(TOKEN_KEY);
