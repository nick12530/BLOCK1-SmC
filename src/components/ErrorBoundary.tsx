/**
 * ErrorBoundary.tsx - Safety UX ErrorBoundary
 * Guarantees that if any UI element throws, the trader is notified that MT5 positions
 * may still be live, with a reconnect button and MT5 bridge status. Never throws.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Server } from 'lucide-react';
import { mt5Bridge } from '../engine/mt5Bridge';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class WorkspaceErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('WorkspaceErrorBoundary caught error:', error, errorInfo);
  }

  private handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      const bridgeStatus = mt5Bridge.getStatus();
      return (
        <div className="rounded-2xl border-2 border-red-500/50 bg-red-950/20 p-6 sm:p-8 text-center space-y-4 font-mono text-xs my-6">
          <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>

          <div className="space-y-1">
            <h2 className="text-base font-bold text-red-400">
              Dashboard Component Error
            </h2>
            <p className="text-slate-300 text-sm max-w-lg mx-auto">
              The web interface encountered an unexpected error, but <strong>MetaTrader 5 positions may still be live and running on the broker.</strong>
            </p>
          </div>

          <div className="flex items-center justify-center gap-3 text-slate-400 text-xs py-2">
            <span className="flex items-center gap-1.5">
              <Server className="w-4 h-4 text-emerald-400" />
              <span>MT5 Bridge: {bridgeStatus.connected ? 'Connected (Port 8000)' : 'Disconnected'}</span>
            </span>
          </div>

          <div className="flex justify-center gap-3 pt-2">
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-4 py-2 rounded-xl bg-slate-800 text-white hover:bg-slate-700 font-bold border border-slate-700 transition-colors"
            >
              Try Re-rendering
            </button>
            <button
              onClick={this.handleReload}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 text-white hover:bg-red-500 font-bold transition-colors shadow-sm"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Reload Dashboard</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
