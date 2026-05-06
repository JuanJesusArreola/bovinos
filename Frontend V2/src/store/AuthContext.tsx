import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { User, LoginRequest, RegisterRequest, AuthState } from '@/types';
import { authApi } from '@/api/auth.api';
import { TOKEN_KEY, REFRESH_TOKEN_KEY, USER_KEY } from '@/utils/constants';

const ACTIVE_RANCH_KEY = 'bovino_active_ranch';

interface AuthContextType extends AuthState {
  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (user: User) => void;
  activeRanchId: string | null;
  activeRanchName: string | null;
  /** Set the active ranch. Pass `null` to clear (e.g. SUPER_ADMIN viewing globally). */
  setActiveRanch: (ranchId: string | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function loadInitialState(): AuthState {
  const token = localStorage.getItem(TOKEN_KEY);
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  const userStr = localStorage.getItem(USER_KEY);
  const user = userStr ? JSON.parse(userStr) as User : null;

  return {
    user,
    token,
    refreshToken,
    isAuthenticated: !!token && !!user,
    isLoading: !!token,
  };
}

function getInitialRanchId(user: User | null): string | null {
  const saved = localStorage.getItem(ACTIVE_RANCH_KEY);
  if (saved && user?.ranchAccess?.some((r) => r.ranchId === saved)) return saved;
  return user?.ranchAccess?.[0]?.ranchId || null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(loadInitialState);
  const [activeRanchId, setActiveRanchIdState] = useState<string | null>(() => getInitialRanchId(state.user));

  // Verify token on mount
  useEffect(() => {
    if (!state.token) return;

    authApi.getProfile()
      .then(({ data }) => {
        const user = data.data;
        localStorage.setItem(USER_KEY, JSON.stringify(user));
        setState((s) => ({ ...s, user, isAuthenticated: true, isLoading: false }));
        // Set default ranch if none selected
        if (!activeRanchId && user.ranchAccess?.[0]) {
          const rid = user.ranchAccess[0].ranchId;
          setActiveRanchIdState(rid);
          localStorage.setItem(ACTIVE_RANCH_KEY, rid);
        }
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        localStorage.removeItem(ACTIVE_RANCH_KEY);
        setState({ user: null, token: null, refreshToken: null, isAuthenticated: false, isLoading: false });
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const login = useCallback(async (data: LoginRequest) => {
    const res = await authApi.login(data);
    const { token, refreshToken, user } = res.data.data;

    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(user));

    // Auto-select first ranch
    const firstRanch = user.ranchAccess?.[0]?.ranchId || null;
    if (firstRanch) localStorage.setItem(ACTIVE_RANCH_KEY, firstRanch);
    setActiveRanchIdState(firstRanch);

    setState({ user, token, refreshToken, isAuthenticated: true, isLoading: false });
  }, []);

  const register = useCallback(async (data: RegisterRequest) => {
    await authApi.register(data);
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore
    } finally {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(ACTIVE_RANCH_KEY);
      setActiveRanchIdState(null);
      setState({ user: null, token: null, refreshToken: null, isAuthenticated: false, isLoading: false });
    }
  }, []);

  const updateUser = useCallback((user: User) => {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    setState((s) => ({ ...s, user }));
  }, []);

  const setActiveRanch = useCallback((ranchId: string | null) => {
    if (ranchId == null) {
      localStorage.removeItem(ACTIVE_RANCH_KEY);
      setActiveRanchIdState(null);
    } else {
      localStorage.setItem(ACTIVE_RANCH_KEY, ranchId);
      setActiveRanchIdState(ranchId);
    }
  }, []);

  const activeRanchName = state.user?.ranchAccess?.find((r) => r.ranchId === activeRanchId)?.ranchName || null;

  return (
    <AuthContext.Provider value={{
      ...state,
      login, register, logout, updateUser,
      activeRanchId, activeRanchName, setActiveRanch,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
