// libs/api.ts
import axios, { AxiosInstance, AxiosError, isAxiosError } from "axios";
import { useUserStore } from "@/stores/user-store"; // if you use zustand

//import env var from next

interface ExtendedAxiosInstance extends AxiosInstance {
  isAxiosError: typeof isAxiosError;
  AxiosError: typeof AxiosError;
}
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  withCredentials: true,
}) as ExtendedAxiosInstance;

api.interceptors.response.use(
  (response) => {
    // if backend sends a refreshed token in headers
    const newToken = response.headers["authorization"];
    if (newToken) {
      useUserStore.getState().setToken(newToken);
    }

    // if backend sends user info in response body
    if (response.data?.user) {
      useUserStore.getState().setUser(response.data.user);
    }

    return response;
  },
  async (error) => {
    // Example: if token expired (401), clear store
    if (error.response?.status === 401) {
      useUserStore.getState().clear();
      // Optionally redirect to login
      // window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);
api.interceptors.request.use(
  (config) => {
    const token = useUserStore.getState().token; // from zustand
    if (token) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);
api.isAxiosError = isAxiosError;
api.AxiosError = AxiosError;

export default api;
