import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught Error Boundary caught an exception:", error, errorInfo);
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[400px] flex items-center justify-center p-6 bg-bg-mist font-sans">
          <div className="w-full max-w-md space-y-4 rounded-2xl border border-clay-alert/30 bg-surface-card p-6 text-center shadow-md">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-clay-alert/10 text-clay-alert">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h2 className="font-display text-lg font-semibold text-ink">
                {this.props.fallbackTitle || "Something went wrong in this view"}
              </h2>
              <p className="text-xs text-stone font-mono leading-relaxed">
                {this.state.error?.message || "An unexpected error occurred during rendering."}
              </p>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-ink py-2.5 text-xs font-mono font-bold text-bg-mist hover:opacity-90 transition-opacity"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Reload Page & Try Again</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
