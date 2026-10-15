import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    // 仅清理运行时业务数据（单据/账单/手工行/行覆盖），保留档案配置（费用/项目/交通/地点/人员/状态/消费类型/补贴标准/个人账单与文件夹）
    // 避免一刀切的 localStorage.clear() 把用户辛苦配置的档案与个人账单全部清空
    const RUNTIME_KEYS = [
      'shuqi_reimbursement_form',
      'shuqi_forms_list',
      'shuqi_manual_rows',
      'shuqi_row_overrides',
    ];
    RUNTIME_KEYS.forEach((k) => {
      try {
        localStorage.removeItem(k);
      } catch {
        /* ignore */
      }
    });
    window.location.reload();
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full flex items-center justify-center bg-[#070b16] p-4">
          <div className="glass-card max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-rose-500/15 text-rose-300 rounded-lg shadow-[0_0_18px_rgba(225,29,72,0.25)]">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-base font-bold text-slate-100">系统运行异常检测</h1>
                <p className="text-xs text-slate-400">页面发生未捕获的错误，已激活保护界面</p>
              </div>
            </div>

            <div className="bg-white/[0.03] border border-white/5 rounded p-3 text-xs font-mono text-slate-300 overflow-auto max-h-48 whitespace-pre-wrap">
              {this.state.error?.toString()}
              {this.state.errorInfo?.componentStack}
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={this.handleReload}
                className="btn-primary flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded text-xs font-medium"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>刷新重试</span>
              </button>
              <button
                onClick={this.handleReset}
                className="btn-ghost flex-1 py-2 px-3 rounded text-xs font-medium"
                title="仅清理当前单据/账单运行时数据，保留费用/项目/交通等档案与发票账单"
              >
                清理单据数据并恢复
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
