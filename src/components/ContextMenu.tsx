import React, { useEffect, useRef, useCallback } from 'react';
import { Activity, Eraser, Plus, Server, Link2, Send, Trash2 } from 'lucide-react';

export type MenuItemType = 
  | 'triggerLSP' 
  | 'clearRoutingTable' 
  | 'deleteNode'
  | 'deleteLink'
  | 'addNode'
  | 'triggerAllLSP'
  | 'clearAllRoutingTables'
  | 'addLink'
  | 'sendTestData';

export interface MenuItem {
  type: MenuItemType;
  label: string;
  icon?: React.ReactNode;
  divider?: boolean;
  danger?: boolean;
}

interface ContextMenuProps {
  visible: boolean;
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
  onAction: (type: MenuItemType) => void;
}

export function ContextMenu({ visible, x, y, items, onClose, onAction }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Viewport-aware positioning
  const positionStyle = React.useMemo(() => {
    if (!visible) return {};
    
    const menuWidth = 200;
    const menuHeight = items.length * 36 + 16; // approximate
    
    let posX = x;
    let posY = y;
    
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    
    // Prevent right overflow
    if (posX + menuWidth > vw) {
      posX = vw - menuWidth - 8;
    }
    
    // Prevent bottom overflow
    if (posY + menuHeight > vh) {
      posY = vh - menuHeight - 8;
    }
    
    // Prevent left/top overflow
    posX = Math.max(8, posX);
    posY = Math.max(8, posY);
    
    return {
      left: posX,
      top: posY,
    };
  }, [visible, x, y, items.length]);

  // Close on click outside or Escape
  useEffect(() => {
    if (!visible) return;
    
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    // Use capture phase to ensure we catch the event before other handlers
    document.addEventListener('mousedown', handleClickOutside, true);
    document.addEventListener('keydown', handleEscape);
    
    // Prevent native context menu while ours is open
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    document.addEventListener('contextmenu', handleContextMenu);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [visible, onClose]);

  const handleItemClick = useCallback((type: MenuItemType) => {
    onAction(type);
    onClose();
  }, [onAction, onClose]);

  if (!visible) return null;

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-white rounded-lg shadow-xl border border-slate-200 py-1.5 min-w-[180px] animate-in fade-in zoom-in-95 duration-100"
      style={positionStyle}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item, index) => (
        <React.Fragment key={`${item.type}-${index}`}>
          {item.divider && index > 0 && (
            <div className="my-1 border-t border-slate-100" />
          )}
          <button
            onClick={() => handleItemClick(item.type)}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors
              ${item.danger 
                ? 'text-red-600 hover:bg-red-50' 
                : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
              }
            `}
          >
            {item.icon && <span className="w-4 h-4 flex-shrink-0">{item.icon}</span>}
            <span className="flex-1">{item.label}</span>
          </button>
        </React.Fragment>
      ))}
    </div>
  );
}

// Helper to build menu items based on target
export function buildNodeMenu(t: Record<string, string>, language: 'en' | 'zh'): MenuItem[] {
  return [
    { type: 'triggerLSP', label: t.triggerLSP, icon: <Activity className="w-4 h-4" /> },
    { type: 'sendTestData', label: t.sendTestData || (language === 'zh' ? '发送测试数据' : 'Send Test Data'), icon: <Send className="w-4 h-4" /> },
    { type: 'clearRoutingTable', label: t.clearRoutingTable, icon: <Eraser className="w-4 h-4" /> },
    { type: 'addLink', label: t.addLink, icon: <Link2 className="w-4 h-4" /> },
    { type: 'deleteNode', label: t.deleteNode || (language === 'zh' ? '删除节点' : 'Delete Node'), icon: <Trash2 className="w-4 h-4" />, danger: true, divider: true },
  ];
}

export function buildBackgroundMenu(t: Record<string, string>, language: 'en' | 'zh'): MenuItem[] {
  return [
    { type: 'addNode', label: t.addNodeHere || (language === 'zh' ? '在此处添加节点' : 'Add Node Here'), icon: <Plus className="w-4 h-4" /> },
    { type: 'triggerAllLSP', label: t.triggerAllLSPs || (language === 'zh' ? '全网触发 LSP' : 'Trigger All LSPs'), icon: <Activity className="w-4 h-4" /> },
    { type: 'clearAllRoutingTables', label: t.clearAllRoutingTables || (language === 'zh' ? '清空所有路由表' : 'Clear All Routing Tables'), icon: <Eraser className="w-4 h-4" />, divider: true },
  ];
}

export function buildLinkMenu(t: Record<string, string>, language: 'en' | 'zh'): MenuItem[] {
  return [
    { type: 'deleteLink', label: t.deleteLink || (language === 'zh' ? '删除链路' : 'Delete Link'), icon: <Trash2 className="w-4 h-4" />, danger: true },
  ];
}
