import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { AuthProvider } from '@/store/AuthContext';
import { ThemeProvider } from '@/store/ThemeContext';
import { ToastProvider, useToast } from '@/store/ToastContext';
import { setGlobalToast } from '@/api/client';
import { AppRouter } from '@/router';
import './index.css';

/**
 * Registers the ToastContext helpers into the Axios interceptor bridge.
 * Must be rendered inside <ToastProvider>.
 */
function GlobalErrorSetup() {
  const toast = useToast();
  useEffect(() => {
    setGlobalToast(
      (title, message) => toast.error(title, message),
      (title, message) => toast.warning(title, message),
    );
  }, [toast]);
  return null;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 min
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <GlobalErrorSetup />
            <AppRouter />
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </StrictMode>,
);
