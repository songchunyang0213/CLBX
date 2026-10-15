import React from 'react';
import {
  Maximize2,
  X,
  FileText,
  Sliders,
  Briefcase,
  Navigation,
  MapPin,
  Users,
  ShieldCheck,
  FolderOpen,
  Receipt,
  Menu,
  Tag,
  Sun,
  Moon,
} from 'lucide-react';

export interface WorkspaceTab {
  id: string;
  title: string;
  type: string;
  formNo?: string;
  closable?: boolean;
}

interface TopHeaderProps {
  openTabs: WorkspaceTab[];
  activeTabId: string;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  toggleFullscreen: () => void;
  onToggleSidebar?: () => void;
  themeMode?: 'dark' | 'light';
  onToggleTheme?: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  openTabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  toggleFullscreen,
  onToggleSidebar,
  themeMode = 'dark',
  onToggleTheme,
}) => {
  const getTabIcon = (type: string) => {
    const iconClass = "w-4 h-4 shrink-0";
    switch (type) {
      case '首页':
      case 'home':
        return <FileText className={`${iconClass} text-cyan-400`} />;
      case '差旅报销':
      case 'form':
        return <Receipt className={`${iconClass} text-emerald-400`} />;
      case '费用档案':
        return <Sliders className={`${iconClass} text-cyan-400`} />;
      case '项目档案':
        return <Briefcase className={`${iconClass} text-indigo-400`} />;
      case '交通档案':
        return <Navigation className={`${iconClass} text-sky-400`} />;
      case '地点档案':
        return <MapPin className={`${iconClass} text-amber-400`} />;
      case '人员档案':
        return <Users className={`${iconClass} text-teal-400`} />;
      case '状态档案':
        return <ShieldCheck className={`${iconClass} text-violet-400`} />;
      case '消费类型':
      case '消费类型档案':
        return <Tag className={`${iconClass} text-indigo-400`} />;
      case '发票账单':
        return <FolderOpen className={`${iconClass} text-amber-400`} />;
      default:
        return <FileText className={`${iconClass} text-slate-500`} />;
    }
  };

  return (
    <header className="h-14 bg-[#0a0f1c] border-b border-slate-800/50 text-slate-200 flex items-center justify-between px-4 select-none">
      {/* Mobile Menu Toggle */}
      {onToggleSidebar && (
        <button
          onClick={onToggleSidebar}
          className="md:hidden p-2 mr-2 text-slate-400 hover:text-white hover:bg-white/[0.05] rounded-lg transition-colors cursor-pointer"
          title="切换侧边栏"
        >
          <Menu className="w-5 h-5" />
        </button>
      )}

      {/* Workspace Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto flex-1 h-full py-2 no-scrollbar">
        {openTabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const isClosable = tab.closable !== false && openTabs.length > 1;

          return (
            <div
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`group flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium cursor-pointer transition-all duration-200 max-w-[220px] shrink-0 ${
                isActive
                  ? 'bg-gradient-to-r from-cyan-500/20 to-blue-600/20 text-white border border-cyan-500/30 shadow-lg shadow-cyan-500/10'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.05] border border-transparent'
              }`}
              title={tab.title}
            >
              {getTabIcon(tab.type)}
              <span className="truncate max-w-[140px]">{tab.title}</span>

              {isClosable && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(tab.id);
                  }}
                  className="p-1 rounded-full hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition-colors ml-1"
                  title="关闭页签"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0 pl-4">
        {onToggleTheme && (
          <button
            onClick={onToggleTheme}
            className="p-2 text-slate-400 hover:text-cyan-400 hover:bg-white/[0.05] rounded-lg transition-colors cursor-pointer"
            title={themeMode === 'dark' ? '切换到浅色主题' : '切换到深色主题'}
          >
            {themeMode === 'dark' ? (
              <Sun className="w-4 h-4" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </button>
        )}
        <button
          onClick={toggleFullscreen}
          className="p-2 text-slate-400 hover:text-cyan-400 hover:bg-white/[0.05] rounded-lg transition-colors cursor-pointer"
          title="全屏切换"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
