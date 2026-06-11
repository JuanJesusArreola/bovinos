/**
 * RouteErrorBoundary — captura excepciones de render de una pagina.
 *
 * F-33 / P-05 del backlog: antes, un throw durante el render (por ejemplo
 * `value.toFixed is not a function` cuando el backend serializaba un
 * NUMERIC como string — caso que documenta H-3 y que Backend P-01 ya
 * elimino) desmontaba TODO el arbol React → pantalla blanca silenciosa.
 *
 * Ahora cada pagina lazy esta envuelta en un boundary; cuando algo
 * explota, el resto de la app (sidebar, header, navegacion) sigue
 * funcional y el usuario ve un fallback con dos salidas:
 *   - "Recargar la página": fuerza un nuevo intento de render (resetea
 *     el boundary internamente).
 *   - "Volver al inicio": navega al dashboard, util cuando la pagina
 *     actual quedo en estado irrecuperable.
 *
 * En desarrollo se muestra el mensaje + stack para debugging.
 * En produccion solo el mensaje amigable + opciones de recuperacion.
 *
 * Usa componente de clase porque React aun NO expone hooks equivalentes
 * a `componentDidCatch` / `getDerivedStateFromError` (los HOC de error
 * boundaries tipo `react-error-boundary` envuelven exactamente esta API).
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface Props {
  children: ReactNode;
  /** Nombre opcional de la ruta para mostrar en el fallback (ej: "Detalle de bovino"). */
  routeName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, errorInfo: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Guardar el stack para mostrarlo en dev.
    this.setState({ errorInfo });
    // Log para consola del navegador — util incluso en prod para que el
    // ganadero pueda compartir captura con soporte. No mandamos esto a
    // un servicio remoto desde este boundary; eso vivira en un wrapper
    // externo cuando integremos Sentry/LogRocket.
    if (typeof console !== 'undefined') {
      // eslint-disable-next-line no-console
      console.error(
        `[RouteErrorBoundary] Excepcion no capturada en "${this.props.routeName ?? 'ruta desconocida'}":`,
        error,
        errorInfo,
      );
    }
  }

  handleReload = (): void => {
    // Reset interno + reload del navegador. Hacer ambos: el reset permite
    // que si el error venia de state stale, el siguiente render no lo
    // tenga; el reload garantiza un fresh start aunque el reset no baste.
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  handleGoHome = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (typeof window !== 'undefined') {
      window.location.href = '/dashboard';
    }
  };

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    const isDev = import.meta.env.DEV;
    const err = this.state.error;
    const stack = this.state.errorInfo?.componentStack ?? err?.stack ?? null;

    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6">
        <div className="w-full max-w-2xl rounded-2xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-6 sm:p-8 space-y-5">
          <div className="flex items-start gap-4">
            <div className="shrink-0 w-12 h-12 rounded-xl bg-red-100 dark:bg-red-900/40 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold text-red-900 dark:text-red-100">
                Algo salió mal en esta página
              </h1>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                Ocurrió un error inesperado al cargar el contenido
                {this.props.routeName ? ` de "${this.props.routeName}"` : ''}.
                El resto de la aplicación sigue funcionando — puedes recargar
                esta página o volver al inicio.
              </p>
            </div>
          </div>

          {/* En dev, mostrar el mensaje del error + stack para debug. */}
          {isDev && err && (
            <div className="space-y-2 text-xs">
              <div className="font-mono p-3 rounded-lg bg-red-100 dark:bg-red-900/40 border border-red-300 dark:border-red-700 text-red-900 dark:text-red-200 break-words">
                <strong className="block mb-1 text-[10px] uppercase tracking-wider">Mensaje:</strong>
                {err.message}
              </div>
              {stack && (
                <details className="font-mono p-3 rounded-lg bg-red-100/60 dark:bg-red-900/30 border border-red-300/70 dark:border-red-700/70 text-red-800 dark:text-red-200">
                  <summary className="cursor-pointer text-[10px] uppercase tracking-wider font-bold">
                    Stack trace (solo en desarrollo)
                  </summary>
                  <pre className="mt-2 whitespace-pre-wrap text-[10px] leading-relaxed">
                    {stack}
                  </pre>
                </details>
              )}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <Button
              variant="outline"
              icon={<Home className="w-4 h-4" />}
              onClick={this.handleGoHome}
              className="flex-1 sm:flex-initial"
            >
              Volver al inicio
            </Button>
            <Button
              variant="primary"
              icon={<RefreshCw className="w-4 h-4" />}
              onClick={this.handleReload}
              className="flex-1 sm:flex-initial"
            >
              Recargar la página
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
