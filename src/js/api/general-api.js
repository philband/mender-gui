import axios, { isCancel } from 'axios';

import { getToken, logout } from '../auth';
import { TIMEOUTS } from '../constants/appConstants';

export const headerNames = {
  link: 'link',
  location: 'location',
  total: 'x-total-count'
};

export const apiRoot = '/api/management';
export const apiUrl = {
  v1: `${apiRoot}/v1`,
  v2: `${apiRoot}/v2`
};

export const MAX_PAGE_SIZE = 500;

const unauthorizedRedirect = error => {
  if (!isCancel(error) && error.response?.status === 401) {
    logout();
  }
  return Promise.reject(error);
};

export const commonRequestConfig = { timeout: TIMEOUTS.refreshDefault, headers: { 'Content-Type': 'application/json' } };

export const authenticatedRequest = axios.create(commonRequestConfig);
authenticatedRequest.interceptors.response.use(res => res, unauthorizedRedirect);
authenticatedRequest.interceptors.request.use(
  config => ({ ...config, headers: { ...config.headers, Authorization: `Bearer ${getToken()}` } }),
  error => Promise.reject(error)
);

const Api = {
  get: authenticatedRequest.get,
  delete: (url, data) => authenticatedRequest.request({ method: 'delete', url, data }),
  patch: authenticatedRequest.patch,
  post: authenticatedRequest.post,
  postUnauthorized: (url, data, config = {}) => axios.post(url, data, { ...commonRequestConfig, ...config }),
  put: authenticatedRequest.put,
  upload: (url, formData, progress, cancelSignal) =>
    authenticatedRequest.post(url, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: progress,
      timeout: 0,
      signal: cancelSignal
    }),
  uploadPut: (url, formData, progress, cancelSignal) =>
    authenticatedRequest.put(url, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: progress,
      timeout: 0,
      signal: cancelSignal
    })
};

export default Api;
