import React, { useState } from 'react';
import {
  FileText,
  Sliders,
  Briefcase,
  Navigation,
  MapPin,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  Users,
  Settings,
  ShieldCheck,
  Tag,
  BarChart3,
  Lightbulb,
  RotateCcw,
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean | ((prev: boolean) => boolean)) => void;
  subsidyRate?: number;
  onOpenSubsidyModal?: () => void;
  currentUserName?: string;
  onRestoreBuiltinArchives?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  isCollapsed,
  setIsCollapsed,
  subsidyRate = 50,
  onOpenSubsidyModal,
  currentUserName = '宋春阳',
  onRestoreBuiltinArchives,
}) => {
  const [isMastersOpen, setIsMastersOpen] = useState(true);

  const isMasterArchiveActive = [
    '费用档案',
    '项目档案',
    '交通档案',
    '地点档案',
    '人员档案',
    '状态档案',
    '消费类型',
    '消费类型档案',
  ].includes(activeTab);

  const menuItemClass = (isActive: boolean) => `
    w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium 
    transition-all duration-200 group cursor-pointer
    ${isCollapsed ? 'justify-center' : 'justify-start'}
    ${isActive 
      ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/25' 
      : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
    }
  `;

  const subMenuItemClass = (isActive: boolean) => `
    w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm
    transition-all duration-200 cursor-pointer
    ${isActive 
      ? 'bg-cyan-500/20 text-cyan-300 font-medium border-l-2 border-cyan-400' 
      : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.03]'
    }
  `;

  return (
    <aside
      className={`bg-[#0a0f1c] text-slate-300 flex flex-col justify-between shrink-0 border-r border-slate-800/50 transition-all duration-300 select-none overflow-hidden h-full ${
        isCollapsed ? 'w-16' : 'w-56'
      }`}
    >
      {/* Header */}
      <div>
        <div className="h-14 border-b border-slate-800/50 flex items-center justify-between px-4 overflow-hidden">
          {!isCollapsed ? (
            <>
              <div className="flex items-center gap-3 min-w-0 overflow-hidden">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center text-white font-bold shadow-lg shadow-cyan-500/30 shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <h1 className="text-sm font-bold text-white tracking-tight truncate whitespace-nowrap">
                  差旅报销系统
                </h1>
              </div>
              <button
                onClick={() => setIsCollapsed(true)}
                title="收起侧边栏"
                className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer shrink-0"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </>
          ) : (
            <div className="w-full flex items-center justify-center">
              <button
                onClick={() => setIsCollapsed(false)}
                title="展开侧边栏"
                className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer"
              >
                <ChevronRightIcon className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        {/* Menu */}
        <div className="p-3 space-y-1.5">
          {/* 差旅报销 */}
          <button
            onClick={() => setActiveTab('差旅报销')}
            title={isCollapsed ? '差旅报销' : undefined}
            className={menuItemClass(activeTab === '差旅报销' || activeTab === '差旅报销单' || activeTab === '首页')}
          >
            <FileText className={`w-5 h-5 shrink-0 ${activeTab === '差旅报销' || activeTab === '差旅报销单' || activeTab === '首页' ? 'text-white' : 'text-slate-500 group-hover:text-white'}`} />
            {!isCollapsed && <span className="truncate">差旅报销</span>}
          </button>

          {/* 发票账单 */}
          <button
            onClick={() => setActiveTab('发票账单')}
            title={isCollapsed ? '发票账单' : undefined}
            className={menuItemClass(activeTab === '发票账单' || activeTab === '个人账单夹')}
          >
            <FolderOpen className={`w-5 h-5 shrink-0 ${activeTab === '发票账单' || activeTab === '个人账单夹' ? 'text-white' : 'text-slate-500 group-hover:text-white'}`} />
            {!isCollapsed && <span className="truncate">发票账单</span>}
          </button>

          {/* 汇总报表 */}
          <button
            onClick={() => setActiveTab('汇总报表')}
            title={isCollapsed ? '汇总报表' : undefined}
            className={menuItemClass(activeTab === '汇总报表')}
          >
            <BarChart3 className={`w-5 h-5 shrink-0 ${activeTab === '汇总报表' ? 'text-white' : 'text-slate-500 group-hover:text-white'}`} />
            {!isCollapsed && <span className="truncate">汇总报表</span>}
          </button>

          {/* 外部链接：tip.scy.pet */}
          <button
            onClick={() => window.open('https://tip.scy.pet', '_blank', 'noopener,noreferrer')}
            title={isCollapsed ? '小贴士 (https://tip.scy.pet)' : '小贴士 (https://tip.scy.pet)'}
            className={menuItemClass(false)}
          >
            <Lightbulb className="w-5 h-5 shrink-0 text-slate-500 group-hover:text-white" />
            {!isCollapsed && <span className="truncate">小贴士</span>}
          </button>

          {/* 基础档案 */}
          <div className="pt-2">
            <button
              onClick={() => {
                if (isCollapsed) {
                  setIsCollapsed(false);
                  setIsMastersOpen(true);
                  if (!isMasterArchiveActive) setActiveTab('费用档案');
                } else {
                  setIsMastersOpen(!isMastersOpen);
                }
              }}
              title={isCollapsed ? '基础档案' : undefined}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group cursor-pointer ${
                isCollapsed ? 'justify-center' : 'justify-between'
              } ${
                isMasterArchiveActive
                  ? 'text-white bg-white/[0.08]'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Sliders className={`w-5 h-5 shrink-0 ${isMasterArchiveActive ? 'text-cyan-400' : 'text-slate-500 group-hover:text-white'}`} />
                {!isCollapsed && <span>基础档案</span>}
              </div>
              {!isCollapsed && (
                <span className="text-slate-500 group-hover:text-white">
                  {isMastersOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </span>
              )}
            </button>

            {/* Sub-menu */}
            {isMastersOpen && !isCollapsed && (
              <div className="mt-1 ml-4 pl-4 border-l border-slate-800/50 space-y-0.5">
                <button onClick={() => setActiveTab('费用档案')} className={subMenuItemClass(activeTab === '费用档案')}>
                  <Sliders className="w-4 h-4 shrink-0" />
                  <span className="truncate">费用档案</span>
                </button>
                <button onClick={() => setActiveTab('项目档案')} className={subMenuItemClass(activeTab === '项目档案')}>
                  <Briefcase className="w-4 h-4 shrink-0" />
                  <span className="truncate">项目档案</span>
                </button>
                <button onClick={() => setActiveTab('交通档案')} className={subMenuItemClass(activeTab === '交通档案')}>
                  <Navigation className="w-4 h-4 shrink-0" />
                  <span className="truncate">交通档案</span>
                </button>
                <button onClick={() => setActiveTab('地点档案')} className={subMenuItemClass(activeTab === '地点档案')}>
                  <MapPin className="w-4 h-4 shrink-0" />
                  <span className="truncate">地点档案</span>
                </button>
                <button onClick={() => setActiveTab('人员档案')} className={subMenuItemClass(activeTab === '人员档案')}>
                  <Users className="w-4 h-4 shrink-0" />
                  <span className="truncate">人员档案</span>
                </button>
                <button onClick={() => setActiveTab('状态档案')} className={subMenuItemClass(activeTab === '状态档案')}>
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span className="truncate">状态档案</span>
                </button>
                <button onClick={() => setActiveTab('消费类型')} className={subMenuItemClass(activeTab === '消费类型' || activeTab === '消费类型档案')}>
                  <Tag className="w-4 h-4 shrink-0" />
                  <span className="truncate">消费类型</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom: restore built-in archives + user area */}
      <div className="shrink-0">
        {/* 一键恢复默认系统内置档案 */}
        {onRestoreBuiltinArchives && (
          <div className="px-4 pb-2">
            <button
              onClick={() => onRestoreBuiltinArchives()}
              title="一键恢复被删除的系统内置档案（不影响您新增的数据）"
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium cursor-pointer
                text-amber-300/80 hover:text-amber-200 border border-amber-500/20 hover:border-amber-500/40
                bg-amber-500/5 hover:bg-amber-500/10 transition-all
                ${isCollapsed ? 'justify-center' : 'justify-start'}`}
            >
              <RotateCcw className="w-4 h-4 shrink-0" />
              {!isCollapsed && <span className="truncate">恢复内置档案</span>}
            </button>
          </div>
        )}

        {/* User Area */}
        <div className="p-4 border-t border-slate-800/50">
        <button
          onClick={() => onOpenSubsidyModal && onOpenSubsidyModal()}
          title="点击配置差旅补贴标准"
          className={`w-full flex items-center gap-3 text-left rounded-xl p-2 hover:bg-white/[0.05] transition-colors cursor-pointer group ${
            isCollapsed ? 'justify-center' : 'justify-start'
          }`}
        >
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 text-white font-bold flex items-center justify-center text-sm shrink-0 shadow-lg shadow-cyan-500/30">
            {currentUserName ? currentUserName.slice(0, 1) : '宋'}
          </div>
          {!isCollapsed && (
            <div className="overflow-hidden flex-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-white group-hover:text-cyan-300 truncate">
                  {currentUserName || '宋春阳'}
                </span>
                <Settings className="w-4 h-4 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <p className="text-xs text-slate-500 truncate mt-0.5">
                补贴标准: <span className="text-emerald-400 font-medium">¥{subsidyRate}</span>/天
              </p>
            </div>
          )}
        </button>
        </div>
      </div>
    </aside>
  );
};
