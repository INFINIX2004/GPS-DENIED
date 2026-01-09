import React, { Component, ReactNode, ErrorInfo } from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  componentName?: string;
  onError?: (error: Error, errorInfo: ErrorInfo, errorId: string) => void;
  showErrorDetails?: boolean;
}

/**
 * React Error Boundary for component crash prevention
 * Provides graceful fallback UI when components throw errors
 * Implements proper error logging and user feedback
 * 
 * Requirements: 6.1, 6.2, 6.3 - Graceful error handling and fallback states
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryCount = 0;
  private maxRetries = 3;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Generate unique error ID for tracking
    const errorId = `ERR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      hasError: true,
      error,
      errorId
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { onError, componentName } = this.props;
    const { errorId } = this.state;

    // Update state with error info
    this.setState({ errorInfo });

    // Log error details
    this.logError(error, errorInfo, errorId!, componentName);

    // Call custom error handler if provided
    if (onError && errorId) {
      onError(error, errorInfo, errorId);
    }
  }

  private logError(error: Error, errorInfo: ErrorInfo, errorId: string, componentName?: string) {
    const errorDetails = {
      errorId,
      componentName: componentName || 'Unknown Component',
      timestamp: new Date().toISOString(),
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      componentStack: errorInfo.componentStack,
      retryCount: this.retryCount,
      userAgent: navigator.userAgent,
      url: window.location.href
    };

    // Log to console for development
    console.error('ErrorBoundary caught an error:', errorDetails);

    // In production, this would send to error tracking service
    // Example: Sentry, LogRocket, or custom error API
    if (process.env.NODE_ENV === 'production') {
      // TODO: Send to error tracking service
      // errorTrackingService.captureError(errorDetails);
    }

    // Store in localStorage for debugging (limited storage)
    try {
      const existingErrors = JSON.parse(localStorage.getItem('aerovision_errors') || '[]');
      const recentErrors = existingErrors.slice(-9); // Keep last 10 errors
      recentErrors.push(errorDetails);
      localStorage.setItem('aerovision_errors', JSON.stringify(recentErrors));
    } catch (storageError) {
      console.warn('Failed to store error in localStorage:', storageError);
    }
  }

  private handleRetry = () => {
    if (this.retryCount < this.maxRetries) {
      this.retryCount++;
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        errorId: null
      });
    }
  };

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    const { hasError, error, errorInfo, errorId } = this.state;
    const { children, fallback, componentName, showErrorDetails = false } = this.props;

    if (hasError) {
      // Use custom fallback if provided
      if (fallback) {
        return fallback;
      }

      // Default error UI
      return (
        <div className="bg-white rounded-lg shadow-sm border border-red-200 p-6 m-4">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
            </div>
            
            <div className="flex-1">
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Component Error
              </h3>
              
              <p className="text-gray-600 mb-4">
                {componentName ? `The ${componentName} component` : 'A component'} encountered an error and couldn't render properly. 
                This is likely a temporary issue.
              </p>

              <div className="flex gap-3 mb-4">
                {this.retryCount < this.maxRetries && (
                  <button
                    onClick={this.handleRetry}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
                  >
                    Try Again ({this.maxRetries - this.retryCount} attempts left)
                  </button>
                )}
                
                <button
                  onClick={this.handleReload}
                  className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm"
                >
                  Reload Page
                </button>
              </div>

              {errorId && (
                <div className="text-xs text-gray-500 mb-3">
                  Error ID: <code className="bg-gray-100 px-1 py-0.5 rounded">{errorId}</code>
                </div>
              )}

              {showErrorDetails && error && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800">
                    Show Technical Details
                  </summary>
                  <div className="mt-3 p-3 bg-gray-50 rounded-md text-xs font-mono">
                    <div className="mb-2">
                      <strong>Error:</strong> {error.message}
                    </div>
                    {error.stack && (
                      <div className="mb-2">
                        <strong>Stack Trace:</strong>
                        <pre className="mt-1 whitespace-pre-wrap text-xs">{error.stack}</pre>
                      </div>
                    )}
                    {errorInfo?.componentStack && (
                      <div>
                        <strong>Component Stack:</strong>
                        <pre className="mt-1 whitespace-pre-wrap text-xs">{errorInfo.componentStack}</pre>
                      </div>
                    )}
                  </div>
                </details>
              )}
            </div>
          </div>
        </div>
      );
    }

    return children;
  }
}

/**
 * Higher-order component to wrap components with error boundary
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  const WithErrorBoundaryComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  );

  WithErrorBoundaryComponent.displayName = `withErrorBoundary(${WrappedComponent.displayName || WrappedComponent.name})`;
  
  return WithErrorBoundaryComponent;
}

/**
 * Hook for error reporting from functional components
 */
export function useErrorHandler() {
  const reportError = React.useCallback((error: Error, context?: string) => {
    const errorId = `ERR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const errorDetails = {
      errorId,
      context: context || 'Manual Error Report',
      timestamp: new Date().toISOString(),
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      userAgent: navigator.userAgent,
      url: window.location.href
    };

    console.error('Manual error report:', errorDetails);

    // Store in localStorage for debugging
    try {
      const existingErrors = JSON.parse(localStorage.getItem('aerovision_errors') || '[]');
      const recentErrors = existingErrors.slice(-9);
      recentErrors.push(errorDetails);
      localStorage.setItem('aerovision_errors', JSON.stringify(recentErrors));
    } catch (storageError) {
      console.warn('Failed to store error in localStorage:', storageError);
    }

    return errorId;
  }, []);

  return { reportError };
}