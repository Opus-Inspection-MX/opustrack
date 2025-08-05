// libs/api.ts
import axios, { AxiosInstance, AxiosError, isAxiosError } from "axios";
//import env var from next

interface ExtendedAxiosInstance extends AxiosInstance {
  isAxiosError: typeof isAxiosError;
  AxiosError: typeof AxiosError;
}
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  withCredentials: true,
}) as ExtendedAxiosInstance;

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.isAxiosError = isAxiosError;
api.AxiosError = AxiosError;

export default api;
