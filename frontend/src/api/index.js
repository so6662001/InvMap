import axios from 'axios';

const baseURL = import.meta.env.VITE_API_BASE || '';
const apiKey = import.meta.env.VITE_API_KEY || '';
const http = axios.create({ baseURL, timeout: 10000, headers: apiKey ? { 'X-Api-Key': apiKey } : {} });

async function unwrap(promise) {
  const res = await promise;
  const body = res.data;
  if (!body || typeof body.code === 'undefined') return body;
  if (body.code !== 0) { const err = new Error(body.message || '请求失败'); err.code = body.code; throw err; }
  return body.data;
}

export const fetchOrders = (phone) => unwrap(http.get('/api/pickup/orders', { params: { phone } }));
export const getSettlement = (code) => unwrap(http.get('/api/settlement', { params: { code } }));
export const getConfig = () => unwrap(http.get('/api/config'));
export const saveConfig = (cfg) => unwrap(http.post('/api/config', cfg));
export const resetConfig = () => unwrap(http.post('/api/config/reset'));
export const getVehicles = () => unwrap(http.get('/api/vehicles'));

export default http;
