/**
 * Error Logging Service
 * Centralized error logging and reporting system
 * 
 * Requirements: 6.1, 6.2, 6.3 - Proper error logging and user feedback
 */

export interface ErrorLogEntry {
  id: string;
  timestamp: string;
  level: 'error' | 'warning' | 'info';
  component?: string;
  message: string;
  stack?: string;
  context?: Record<string, any>;
  userAgent: string;
  url: string;
  userId?: string;
  sessionId: string;
}

export interface ErrorStats {
  totalErrors: number;
  errorsByLevel: Record<string, number>;
  errorsByComponent: Record<string, number>;
  recentErrors: ErrorLogEntry[];
  errorRate: number; // errors per minute
}

class ErrorLoggingService {
  private errors: ErrorLogEntry[] = [];
  private maxStoredErrors = 100;
  private sessionId: string;
  private errorListeners: ((error: ErrorLogEntry) => void)[] = [];

  constructor() {
    this.sessionId = this.generateSessionId();
    this.setupGlobalErrorHandlers();
    this.loadStoredErrors();
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private setupGlobalErrorHandlers() {
    // Handle unhandled JavaScript errors
    window.addEventListener('error', (event) => {
      this.logError({
        component: 'Global',
        message: event.message,
        stack: event.error?.stack,
        context: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          type: 'javascript-error'
        }
      });
    });

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.logError({
        component: 'Global',
        message: `Unhandled Promise Rejection: ${event.reason}`,
        stack: event.reason?.stack,
        context: {
          type: 'unhandled-promise-rejection',
          reason: event.reason
        }
      });
    });

    // Handle React error boundary errors (these will be logged via the ErrorBoundary component)
  }

  private loadStoredErrors() {
    try {
      const stored = localStorage.getItem('aerovision_errors');
      if (stored) {
        const parsedErrors = JSON.parse(stored);
        if (Array.isArray(parsedErrors)) {
          this.errors = parsedErrors.slice(-this.maxStoredErrors);
        }
      }
    } catch (error) {
      console.warn('Failed to load stored errors:', error);
    }
  }

  private saveErrors() {
    try {
      const recentErrors = this.errors.slice(-this.maxStoredErrors);
      localStorage.setItem('aerovision_errors', JSON.stringify(recentErrors));
    } catch (error) {
      console.warn('Failed to save errors to localStorage:', error);
    }
  }

  /**
   * Log an error with context information
   */
  logError({
    component,
    message,
    stack,
    context,
    level = 'error'
  }: {
    component?: string;
    message: string;
    stack?: string;
    context?: Record<string, any>;
    level?: 'error' | 'warning' | 'info';
  }): string {
    const errorId = `${level.toUpperCase()}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const errorEntry: ErrorLogEntry = {
      id: errorId,
      timestamp: new Date().toISOString(),
      level,
      component,
      message,
      stack,
      context,
      userAgent: navigator.userAgent,
      url: window.location.href,
      sessionId: this.sessionId
    };

    // Add to internal storage
    this.errors.push(errorEntry);
    
    // Keep only recent errors in memory
    if (this.errors.length > this.maxStoredErrors) {
      this.errors = this.errors.slice(-this.maxStoredErrors);
    }

    // Save to localStorage
    this.saveErrors();

    // Log to console for development
    const consoleMethod = level === 'error' ? 'error' : level === 'warning' ? 'warn' : 'info';
    console[consoleMethod](`[${component || 'Unknown'}] ${message}`, {
      errorId,
      stack,
      context
    });

    // Notify listeners
    this.errorListeners.forEach(listener => {
      try {
        listener(errorEntry);
      } catch (listenerError) {
        console.error('Error in error listener:', listenerError);
      }
    });

    // In production, send to error tracking service
    if (process.env.NODE_ENV === 'production') {
      this.sendToErrorTrackingService(errorEntry);
    }

    return errorId;
  }

  /**
   * Log a warning
   */
  logWarning(component: string, message: string, context?: Record<string, any>): string {
    return this.logError({ component, message, context, level: 'warning' });
  }

  /**
   * Log an info message
   */
  logInfo(component: string, message: string, context?: Record<string, any>): string {
    return this.logError({ component, message, context, level: 'info' });
  }

  /**
   * Log a React component error (called from ErrorBoundary)
   */
  logComponentError(
    component: string,
    error: Error,
    errorInfo: React.ErrorInfo,
    errorId: string
  ): void {
    this.logError({
      component,
      message: error.message,
      stack: error.stack,
      context: {
        errorId,
        componentStack: errorInfo.componentStack,
        type: 'react-component-error'
      }
    });
  }

  /**
   * Log a network/API error
   */
  logNetworkError(
    endpoint: string,
    method: string,
    status: number,
    message: string,
    context?: Record<string, any>
  ): string {
    return this.logError({
      component: 'Network',
      message: `${method} ${endpoint}: ${message}`,
      context: {
        endpoint,
        method,
        status,
        type: 'network-error',
        ...context
      }
    });
  }

  /**
   * Log a data validation error
   */
  logValidationError(
    component: string,
    field: string,
    value: any,
    expectedType: string
  ): string {
    return this.logError({
      component,
      message: `Data validation failed for field '${field}'`,
      context: {
        field,
        value,
        expectedType,
        actualType: typeof value,
        type: 'validation-error'
      },
      level: 'warning'
    });
  }

  /**
   * Get error statistics
   */
  getErrorStats(): ErrorStats {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    const recentErrors = this.errors.filter(
      error => new Date(error.timestamp).getTime() > oneMinuteAgo
    );

    const errorsByLevel = this.errors.reduce((acc, error) => {
      acc[error.level] = (acc[error.level] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const errorsByComponent = this.errors.reduce((acc, error) => {
      const component = error.component || 'Unknown';
      acc[component] = (acc[component] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalErrors: this.errors.length,
      errorsByLevel,
      errorsByComponent,
      recentErrors: this.errors.slice(-10), // Last 10 errors
      errorRate: recentErrors.length // errors per minute
    };
  }

  /**
   * Get all errors with optional filtering
   */
  getErrors(filter?: {
    level?: 'error' | 'warning' | 'info';
    component?: string;
    since?: Date;
    limit?: number;
  }): ErrorLogEntry[] {
    let filtered = this.errors;

    if (filter?.level) {
      filtered = filtered.filter(error => error.level === filter.level);
    }

    if (filter?.component) {
      filtered = filtered.filter(error => error.component === filter.component);
    }

    if (filter?.since) {
      const sinceTime = filter.since.getTime();
      filtered = filtered.filter(error => new Date(error.timestamp).getTime() >= sinceTime);
    }

    if (filter?.limit) {
      filtered = filtered.slice(-filter.limit);
    }

    return filtered;
  }

  /**
   * Clear all stored errors
   */
  clearErrors(): void {
    this.errors = [];
    try {
      localStorage.removeItem('aerovision_errors');
    } catch (error) {
      console.warn('Failed to clear errors from localStorage:', error);
    }
  }

  /**
   * Add error listener for real-time error notifications
   */
  addErrorListener(listener: (error: ErrorLogEntry) => void): () => void {
    this.errorListeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      const index = this.errorListeners.indexOf(listener);
      if (index > -1) {
        this.errorListeners.splice(index, 1);
      }
    };
  }

  /**
   * Send error to external error tracking service
   */
  private async sendToErrorTrackingService(error: ErrorLogEntry): Promise<void> {
    try {
      // This would integrate with services like Sentry, LogRocket, etc.
      // For now, we'll just log that we would send it
      console.log('Would send to error tracking service:', error);
      
      // Example implementation:
      // await fetch('/api/errors', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(error)
      // });
    } catch (sendError) {
      console.error('Failed to send error to tracking service:', sendError);
    }
  }

  /**
   * Export errors for debugging or support
   */
  exportErrors(): string {
    const exportData = {
      sessionId: this.sessionId,
      exportTime: new Date().toISOString(),
      errors: this.errors,
      stats: this.getErrorStats(),
      systemInfo: {
        userAgent: navigator.userAgent,
        url: window.location.href,
        timestamp: new Date().toISOString()
      }
    };

    return JSON.stringify(exportData, null, 2);
  }
}

// Create singleton instance
export const errorLoggingService = new ErrorLoggingService();

// Export hook for React components
export function useErrorLogger() {
  const logError = React.useCallback((
    component: string,
    message: string,
    context?: Record<string, any>
  ) => {
    return errorLoggingService.logError({ component, message, context });
  }, []);

  const logWarning = React.useCallback((
    component: string,
    message: string,
    context?: Record<string, any>
  ) => {
    return errorLoggingService.logWarning(component, message, context);
  }, []);

  const logInfo = React.useCallback((
    component: string,
    message: string,
    context?: Record<string, any>
  ) => {
    return errorLoggingService.logInfo(component, message, context);
  }, []);

  return { logError, logWarning, logInfo };
}

// React import for the hook
import React from 'react';