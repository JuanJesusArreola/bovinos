export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
export const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:5000';

export const TOKEN_KEY = 'bovino_token';
export const REFRESH_TOKEN_KEY = 'bovino_refresh_token';
export const USER_KEY = 'bovino_user';

export const DEFAULT_PAGE_SIZE = 20;
export const MAP_DEFAULT_CENTER = { lat: 17.989, lng: -92.947 }; // Tabasco, México
export const MAP_DEFAULT_ZOOM = 12;
