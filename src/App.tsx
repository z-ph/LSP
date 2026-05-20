import React, { useState, useEffect } from 'react';
import { useSimNetwork } from './simulation/useSimNetwork';
import { NetworkGraph } from './components/NetworkGraph';
import { Play, Pause, Save, Upload, Activity, Clock, Server, Settings2, Link2, Plus, Route, HelpCircle, Globe, Eraser } from 'lucide-react';
import { PhysicalNode, PhysicalLink } from './simulation/types';
import { useLanguage } from './i18n/LanguageContext';
import { HelpModal } from './components/HelpModal';
import { ContextMenu, buildNodeMenu, buildBackgroundMenu, buildLinkMenu, MenuItemType } from './components/ContextMenu';

const INITIAL_NODES: PhysicalNode[] = [
  { id: '1', label: 'R1', x: 200, y: 300 },
  { id: '2', label: 'R2', x: 400, y: 150 },
  { id: '3', label: 'R3', x: 400, y: 450 },
  { id: '4', label: 'R4', x: 600, y: 300 },
  { id: '5', label: 'R5', x: 800, y: 300 },
];

const INITIAL_LINKS: PhysicalLink[] = [
  { id: 'l1', source: '1', target: '2', cost: 10, up: true },
  { id: 'l2', source: '1', target: '3', cost: 10, up: true },
  { id: 'l3', source: '2', target: '4', cost: 5, up: true },
  { id: 'l4', source: '3', target: '4', cost: 5, up: true }, // R1->...->R4 has ECMP
  { id: 'l5', source: '4', target: '5', cost: 20, up: true },
  { id: 'l6', source: '2', target: '5', cost: 30, up: true },
];

export default function App() {
  const sim = useSimNetwork();
  const { t, language, setLanguage } = useLanguage();
  
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedLinkId, setSelectedLinkId] = useState<string>('');
  
  const [newLinkMode, setNewLinkMode] = useState<{ active: boolean, source?: string }>({ active: false });
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [dataDestId, setDataDestId] = useState<string>('');
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    type: 'node' | 'background' | 'link';
    targetId?: string;
    graphX?: number;
    graphY?: number;
  }>({ visible: false, x: 0, y: 0, type: 'background' });

  // Init default
  useEffect(() => {
    const saved = localStorage.getItem('ospf_network_topology');
    if (saved) {
      try {
        const { nodes, links } = JSON.parse(saved);
        if (nodes && nodes.length > 0) {
          sim.initTopology(nodes, links);
          return;
        }
      } catch (e) {
        console.error("Failed to parse saved topology", e);
      }
    }
    sim.initTopology(INITIAL_NODES, INITIAL_LINKS);
  }, []); // Run once

  useEffect(() => {
    if (sim.nodes.length > 0) {
       localStorage.setItem('ospf_network_topology', JSON.stringify({ nodes: sim.nodes, links: sim.links }));
    }
  }, [sim.nodes, sim.links]);

  const handleNodeMove = (id: string, x: number, y: number) => {
    sim.updateNodePosition(id, x, y);
  };

  const handleNodeClick = (id: string, multi: boolean = false) => {
    if (newLinkMode.active && newLinkMode.source && newLinkMode.source !== id && id !== '') {
       sim.addLink(newLinkMode.source, id, 10);
       setNewLinkMode({ active: false });
       return;
    }
    
    if (newLinkMode.active && id !== '') {
        setNewLinkMode({ active: true, source: id });
        return;
    }
    
    if (id === '') {
       setSelectedNodeIds([]);
       return;
    }
    
    if (multi) {
        setSelectedNodeIds(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
        setSelectedLinkId('');
    } else {
        setSelectedNodeIds([id]);
        setSelectedLinkId('');
    }
  };

  const handleLinkClick = (id: string) => {
    setSelectedLinkId(id);
    if (id) setSelectedNodeIds([]);
  };

  const handleNodeContextMenu = (id: string, x: number, y: number) => {
    setContextMenu({ visible: true, x, y, type: 'node', targetId: id });
  };

  const handleBackgroundContextMenu = (screenX: number, screenY: number, graphX: number, graphY: number) => {
    setContextMenu({ visible: true, x: screenX, y: screenY, type: 'background', graphX, graphY });
  };

  const handleLinkContextMenu = (id: string, x: number, y: number) => {
    setContextMenu({ visible: true, x, y, type: 'link', targetId: id });
  };

  const handleCloseContextMenu = () => {
    setContextMenu(prev => ({ ...prev, visible: false }));
  };

  const handleMenuAction = (type: MenuItemType) => {
    const targetId = contextMenu.targetId;

    switch (type) {
      case 'triggerLSP':
        if (targetId) sim.triggerLSP(targetId);
        break;
      case 'deleteNode':
        if (targetId) {
          sim.removeNode(targetId);
          setSelectedNodeIds(prev => prev.filter(id => id !== targetId));
        }
        break;
      case 'clearRoutingTable':
        if (targetId) sim.clearRoutingTable([targetId]);
        break;
      case 'sendTestData':
        if (targetId) {
          setSelectedNodeIds([targetId]);
          if (dataDestId) {
            sim.sendDataPacket(targetId, dataDestId);
          }
        }
        break;
      case 'addLink':
        if (targetId) {
          setNewLinkMode({ active: true, source: targetId });
        }
        break;
      case 'addNode':
        const addX = contextMenu.graphX ?? Math.random() * 200 + 100;
        const addY = contextMenu.graphY ?? Math.random() * 200 + 100;
        sim.addNode({ label: `R${sim.nodes.length + 1}`, x: addX, y: addY });
        break;
      case 'triggerAllLSP':
        sim.nodes.forEach(n => sim.triggerLSP(n.id));
        break;
      case 'clearAllRoutingTables':
        sim.clearRoutingTable();
        break;
      case 'deleteLink':
        if (targetId) {
          sim.removeLink(targetId);
          setSelectedLinkId('');
        }
        break;
    }

    setContextMenu(prev => ({ ...prev, visible: false }));
  };

  const selectedNode = selectedNodeIds.length === 1 ? sim.nodes.find(n => n.id === selectedNodeIds[0]) : null;
  const selectedNodeState = selectedNode ? sim.nodeStates[selectedNode.id] : null;
  const selectedLink = sim.links.find(l => l.id === selectedLinkId);

  const handleExport = () => {
    const data = JSON.stringify({ nodes: sim.nodes, links: sim.links });
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'topology.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
       try {
           const parsed = JSON.parse(e.target?.result as string);
           if (parsed.nodes && parsed.links) {
              // map links to make sure they match new objects
              sim.initTopology(parsed.nodes, parsed.links);
              setSelectedNodeIds([]);
              setSelectedLinkId('');
           }
       } catch (err) {
           console.error("Invalid JSON configuration", err);
       }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  };

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden text-slate-800 font-sans">
      
      {/* Main Canvas Area */}
      <div className="flex-1 flex flex-col relative">
        <header className="h-14 bg-white border-b px-4 flex items-center justify-between shadow-sm z-10">
          <div className="flex items-center gap-2">
             <Activity className="text-blue-600" />
             <h1 className="font-bold text-lg">{t.title}</h1>
          </div>
          
          {/* Top Bar Controls */}
          <div className="flex items-center gap-4">
             <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-md border">
                <Clock className="w-4 h-4 text-slate-500" />
                <span className="text-sm font-medium">
                  Status: {sim.convergenceStats.isConverged ? t.statusConverged : t.statusConverging} 
                </span>
                <span className="text-xs text-slate-500 min-w-[60px] text-right">
                  {sim.convergenceStats.timeMs}ms
                </span>
             </div>
             
             <div className="flex gap-2 border-r pr-4">
                <button onClick={handleExport} className="p-2 hover:bg-slate-100 rounded-md text-slate-600 transition" title={t.exportTopology}>
                  <Save className="w-5 h-5" />
                </button>
                <label className="p-2 hover:bg-slate-100 rounded-md text-slate-600 cursor-pointer transition" title={t.importTopology}>
                  <Upload className="w-5 h-5" />
                  <input type="file" accept=".json" className="hidden" onChange={handleImport} />
                </label>
             </div>
             
             <div className="flex gap-2">
                <button 
                  onClick={() => setLanguage(language === 'en' ? 'zh' : 'en')} 
                  className="flex items-center gap-1 p-2 hover:bg-slate-100 rounded-md text-slate-600 transition" 
                  title={t.language}
                >
                  <Globe className="w-5 h-5" />
                  <span className="text-xs font-semibold">{language.toUpperCase()}</span>
                </button>
                <button 
                  onClick={() => setIsHelpOpen(true)} 
                  className="p-2 hover:bg-slate-100 rounded-md text-slate-600 transition" 
                  title={t.help}
                >
                  <HelpCircle className="w-5 h-5" />
                </button>
             </div>
          </div>
        </header>

        {/* Network Canvas */}
        <div className="flex-1 relative">
           <NetworkGraph
             nodes={sim.nodes}
             links={sim.links}
             packets={sim.packets}
             onNodeMove={handleNodeMove}
             onNodesMove={(updates) => sim.updateNodes(updates.map(u => ({ id: u.id, update: { x: u.x, y: u.y } })))}
             onNodeClick={handleNodeClick}
             onLinkClick={handleLinkClick}
             selectedNodeIds={selectedNodeIds}
             selectedLinkId={selectedLinkId}
             onSelectionBox={(ids) => {
                setSelectedNodeIds(ids);
                setSelectedLinkId('');
             }}
             onNodeContextMenu={handleNodeContextMenu}
             onBackgroundContextMenu={handleBackgroundContextMenu}
             onLinkContextMenu={handleLinkContextMenu}
           />
           
           {/* Floating Tools */}
           <div className="absolute top-4 left-4 flex flex-col gap-2 bg-white/90 backdrop-blur shadow-md rounded-lg p-2 border">
              <button 
                onClick={() => {
                   sim.addNode({ label: `R${sim.nodes.length + 1}`, x: Math.random() * 200 + 100, y: Math.random() * 200 + 100 });
                }}
                className="flex items-center gap-2 px-3 py-2 hover:bg-blue-50 text-slate-700 hover:text-blue-600 rounded transition font-medium text-sm"
              >
                 <Server className="w-4 h-4" /> {t.addNode}
              </button>
              <button 
                onClick={() => setNewLinkMode({ active: !newLinkMode.active })}
                className={`flex items-center gap-2 px-3 py-2 rounded transition font-medium text-sm
                  ${newLinkMode.active ? 'bg-blue-100 text-blue-700' : 'hover:bg-blue-50 text-slate-700 hover:text-blue-600'}`
                }
              >
                 <Link2 className="w-4 h-4" /> {newLinkMode.active ? (newLinkMode.source ? t.selectTarget : t.selectSource) : t.addLink}
              </button>
              
               <button 
                 onClick={() => {
                    sim.nodes.forEach(n => sim.triggerLSP(n.id));
                 }}
                 className="flex items-center gap-2 px-3 py-2 hover:bg-green-50 text-slate-700 hover:text-green-600 rounded transition font-medium text-sm"
               >
                  <Activity className="w-4 h-4" /> 
                  {language === 'zh' ? '全网触发 LSP' : 'Trigger All LSPs'}
               </button>

              <button 
                onClick={() => {
                   if (selectedNodeIds.length > 0) {
                      sim.clearRoutingTable(selectedNodeIds);
                   } else {
                      sim.clearRoutingTable();
                   }
                }}
                className="flex items-center gap-2 px-3 py-2 hover:bg-red-50 text-slate-700 hover:text-red-600 rounded transition font-medium text-sm border-l border-slate-200 pl-4 ml-1"
                title={t.clearRoutingTable}
              >
                 <Eraser className="w-4 h-4" /> 
                 <span className="hidden sm:inline">{t.clearRoutingTable}</span>
              </button>
           </div>
        </div>
      </div>

      {/* Right Sidebar */}
      <div className="w-80 bg-white border-l shadow-xl flex flex-col overflow-hidden z-20">
         <div className="py-1.5 px-3 border-b bg-slate-50 flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-slate-600" />
            <h2 className="font-semibold text-sm">{t.simulationSettings}</h2>
         </div>
         
          <div className="py-2 px-3 border-b space-y-1.5">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-0.5 block">{t.baseDelay}</label>
              <input 
                type="range" min="10" max="3000" step="10"
                value={sim.config.baseDelayMs || 200}
                onChange={e => sim.setConfig({ ...sim.config, baseDelayMs: Number(e.target.value) })}
                className="w-full"
              />
              <div className="text-right text-sm text-slate-600">{sim.config.baseDelayMs} ms</div>
            </div>
            
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-0.5 block">{t.packetLoss}</label>
              <input 
                type="range" min="0" max="1" step="0.01"
                value={sim.config.packetLossRatio ?? 0}
                onChange={e => sim.setConfig({ ...sim.config, packetLossRatio: Number(e.target.value) })}
                className="w-full"
              />
              <div className="text-right text-sm text-slate-600">{(sim.config.packetLossRatio * 100).toFixed(0)}%</div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
               <input 
                 type="checkbox" 
                 checked={sim.config.autoTriggerLspOnLinkChange ?? false}
                 onChange={(e) => sim.setConfig({...sim.config, autoTriggerLspOnLinkChange: e.target.checked})}
               />
               <span>{language === 'zh' ? '链路状态改变时自动发送LSP' : 'Auto-trigger LSP on link change'}</span>
            </label>
         </div>

         <div className="flex-1 overflow-y-auto bg-slate-50">
             {selectedNodeIds.length > 1 ? (
                <div key="multiple-nodes" className="py-2 px-3 animate-in fade-in slide-in-from-right-4">
                   <h3 className="font-bold text-base flex items-center gap-2 mb-1">
                     <Server className="w-5 h-5 text-blue-500" />
                     {language === 'zh' ? `已选择 ${selectedNodeIds.length} 个节点` : `${selectedNodeIds.length} Nodes Selected`}
                   </h3>
                   
                   <button 
                      onClick={() => selectedNodeIds.forEach(id => sim.triggerLSP(id))}
                      className="w-full mb-1 px-2 py-1.5 bg-blue-50 text-blue-600 rounded-md font-medium text-sm hover:bg-blue-100 transition"
                   >
                     {language === 'zh' ? '为选中节点触发LSP' : 'Trigger LSP for Selected'}
                  </button>

                   <button 
                      onClick={() => sim.clearRoutingTable(selectedNodeIds)}
                      className="w-full mb-1 px-2 py-1.5 bg-slate-100 text-slate-700 hover:text-slate-900 rounded-md font-medium text-sm hover:bg-slate-200 transition flex items-center justify-center gap-2"
                   >
                      <Eraser className="w-4 h-4" />
                      {language === 'zh' ? '清空选中节点路由表' : 'Clear Routing Table for Selected'}
                   </button>

                   <button 
                      onClick={() => {
                          selectedNodeIds.forEach(id => sim.removeNode(id));
                          setSelectedNodeIds([]);
                      }}
                      className="w-full mb-1 px-2 py-1.5 bg-red-100 text-red-700 rounded-md font-medium text-sm hover:bg-red-200 transition flex items-center justify-center gap-2"
                   >
                      <Eraser className="w-4 h-4" />
                      {language === 'zh' ? '删除所选节点' : 'Delete Selected Nodes'}
                   </button>
                   
                   <div className="mt-1 p-1.5 bg-white rounded border">
                      <h4 className="text-xs font-bold text-slate-500 uppercase mb-1">{language === 'zh' ? '定时触发 LSP' : 'Timer Trigger LSP'}</h4>
                      <label className="flex items-center gap-2 cursor-pointer text-sm mb-1">
                        <input 
                          type="checkbox"
                          onChange={e => {
                             const checked = e.target.checked;
                             selectedNodeIds.forEach(id => {
                                const n = sim.nodes.find(node => node.id === id);
                                sim.updateNode(id, { 
                                  autoLspEnabled: checked,
                                  autoLspInterval: n?.autoLspInterval || 5000 
                                });
                             });
                          }}
                          ref={(el) => {
                             if (el) {
                               const firstNode = sim.nodes.find(n => n.id === selectedNodeIds[0]);
                               const allMatch = selectedNodeIds.every(id => {
                                   const n = sim.nodes.find(node => node.id === id);
                                   return n?.autoLspEnabled === firstNode?.autoLspEnabled;
                               });
                               el.checked = !!(allMatch && firstNode?.autoLspEnabled);
                               el.indeterminate = !allMatch;
                             }
                          }}
                        />
                        {language === 'zh' ? '开启定时触发' : 'Enable auto-timer'}
                     </label>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-slate-500">{language === 'zh' ? '间隔 (ms):' : 'Interval (ms):'}</span>
                        <input 
                          type="number" min="100" step="100"
                          defaultValue=""
                          title="Press Enter to apply to all"
                          placeholder="e.g. 5000"
                          onKeyDown={e => {
                             if (e.key === 'Enter') {
                               const val = parseInt((e.target as HTMLInputElement).value);
                               if (val >= 100) {
                                   selectedNodeIds.forEach(id => {
                                      sim.updateNode(id, { autoLspInterval: val });
                                   });
                               }
                             }
                          }}
                          className="w-full p-1 border rounded text-sm"
                        />
                     </div>
                  </div>
               </div>
             ) : selectedNode && selectedNodeState ? (
                <div key={`node-${selectedNode.id}`} className="py-2 px-3 animate-in fade-in slide-in-from-right-4">
                   <div className="flex items-center justify-between mb-1">
                      <h3 className="font-bold text-base flex items-center gap-2">
                        <Server className="w-5 h-5 text-blue-500" />
                        {t.node} {selectedNode.label}
                      </h3>
                      <span className="text-xs px-2 py-1 bg-slate-200 text-slate-600 rounded">{t.seq}: {selectedNodeState.seqCounter}</span>
                   </div>
                   
                   <button 
                      onClick={() => sim.triggerLSP(selectedNode.id)}
                      className="w-full mb-1 px-2 py-1.5 bg-blue-50 text-blue-600 rounded-md font-medium text-sm hover:bg-blue-100 transition"
                   >
                      {t.triggerLSP}
                   </button>

                   <button 
                      onClick={() => sim.clearRoutingTable([selectedNode.id])}
                      className="w-full mb-1 px-2 py-1.5 bg-slate-100 text-slate-700 hover:text-slate-900 rounded-md font-medium text-sm hover:bg-slate-200 transition flex items-center justify-center gap-2"
                   >
                      <Eraser className="w-4 h-4" />
                      {t.clearRoutingTable}
                   </button>

                   <button 
                      onClick={() => {
                         sim.removeNode(selectedNode.id);
                         setSelectedNodeIds([]);
                      }}
                      className="w-full mb-1 px-2 py-1.5 bg-red-100 text-red-700 rounded-md font-medium text-sm hover:bg-red-200 transition flex items-center justify-center gap-2"
                   >
                      <Eraser className="w-4 h-4" />
                      {language === 'zh' ? '删除节点' : 'Delete Node'}
                   </button>

                   <div className="mb-1 p-1.5 bg-white rounded border shadow-sm">
                      <h4 className="text-xs font-bold text-slate-500 uppercase mb-1">{language === 'zh' ? '定时触发 LSP' : 'Timer Trigger LSP'}</h4>
                      <label className="flex items-center gap-2 cursor-pointer text-sm mb-1">
                        <input 
                          type="checkbox" 
                          checked={selectedNode.autoLspEnabled ?? false}
                          onChange={e => sim.updateNode(selectedNode.id, { 
                            autoLspEnabled: e.target.checked,
                            autoLspInterval: selectedNode.autoLspInterval || 5000
                          })}
                        />
                        {language === 'zh' ? '开启' : 'Enable'}
                     </label>
                     <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 border-none">{language === 'zh' ? '间隔 (ms):' : 'Interval:'}</span>
                        <input 
                          type="number" min="100" step="100"
                          value={selectedNode.autoLspInterval || ''}
                          onChange={e => {
                            const val = parseInt(e.target.value);
                            sim.updateNode(selectedNode.id, { autoLspInterval: isNaN(val) ? undefined : val });
                          }}
                          className="w-full p-1 border rounded text-sm bg-slate-50"
                        />
                     </div>
                  </div>

                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1 mt-1">
                    <Play className="w-4 h-4" /> {language === 'zh' ? '发送测试数据' : 'Send Test Data'}
                  </h4>
                  <div className="flex items-center gap-2 mb-1">
                     <select 
                        className="flex-1 p-2 border rounded text-sm bg-slate-50"
                        value={dataDestId || ''}
                        onChange={e => setDataDestId(e.target.value)}
                     >
                        <option value="">{language === 'zh' ? '选择目标节点...' : 'Select Target...'}</option>
                        {sim.nodes.filter(n => n.id !== selectedNode.id).map(n => (
                           <option key={n.id} value={n.id}>{n.label}</option>
                        ))}
                     </select>
                     <button
                        onClick={() => {
                           if (dataDestId) sim.sendDataPacket(selectedNode.id, dataDestId);
                        }}
                        disabled={!dataDestId}
                        className="px-3 py-2 bg-purple-600 text-white font-medium text-sm rounded hover:bg-purple-700 disabled:opacity-50 transition"
                     >
                        {language === 'zh' ? '发送' : 'Send'}
                     </button>
                  </div>

                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Route className="w-4 h-4" /> {t.routingTable}
                  </h4>
                  
                  <div className="bg-white rounded border overflow-hidden text-sm shadow-sm">
                     <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b">
                           <tr>
                              <th className="p-2 font-semibold">{t.dest}</th>
                              <th className="p-2 font-semibold">{t.cost}</th>
                              <th className="p-2 font-semibold">{t.nextHop}</th>
                           </tr>
                        </thead>
                        <tbody>
                           {selectedNodeState.routingTable.length === 0 ? (
                               <tr><td colSpan={3} className="p-4 text-center text-slate-500">{t.noRoutes}</td></tr>
                           ) : (
                               selectedNodeState.routingTable.map((route, i) => {
                                   const destNode = sim.nodes.find(n => n.id === route.destination);
                                   const hopNames = route.nextHops.map(id => sim.nodes.find(n => n.id === id)?.label || id).join(', ');
                                   return (
                                       <tr key={i} className="border-b last:border-0 hover:bg-slate-50">
                                          <td className="p-2 font-medium">{destNode?.label || route.destination}</td>
                                          <td className="p-2 text-blue-600 font-mono">{route.cost}</td>
                                          <td className="p-2 text-slate-600">{hopNames}</td>
                                       </tr>
                                   )
                               })
                           )}
                        </tbody>
                     </table>
                  </div>
               </div>
             ) : selectedLink ? (
                <div key={`link-${selectedLink.id}`} className="py-2 px-3 animate-in fade-in slide-in-from-right-4">
                   <h3 className="font-bold text-base flex items-center gap-2 mb-1">
                      <Link2 className="w-5 h-5 text-blue-500" />
                      {t.linkInterface}
                   </h3>
                   
                   <div className="space-y-2">
                      <div>
                         <label className="text-xs font-bold text-slate-500 uppercase block mb-0.5">{t.status}</label>
                        <button 
                           onClick={() => sim.toggleLink(selectedLink.id)}
                           className={`w-full py-2 rounded-md font-medium text-sm transition ${selectedLink.up ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100' : 'bg-green-50 text-green-600 border border-green-200 hover:bg-green-100'}`}
                        >
                           {selectedLink.up ? t.disconnectLink : t.connectLink}
                        </button>
                     </div>
                     
                     {selectedLink.up && (
                         <div>
                            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">{t.costMetric}</label>
                            <input 
                              type="number" min="1" max="100"
                              value={selectedLink.cost || ''}
                              onChange={e => {
                                const val = parseInt(e.target.value);
                                sim.updateLinkCost(selectedLink.id, isNaN(val) ? 1 : val);
                              }}
                              className="w-full p-2 border rounded-md"
                            />
                            <p className="mt-1 text-xs text-slate-500">{t.costHelp}</p>
                         </div>
                     )}

                      <div className="pt-1.5 border-t border-slate-200 mt-2">
                        <button 
                           onClick={() => {
                               sim.removeLink(selectedLink.id);
                               setSelectedLinkId('');
                           }}
                           className="w-full py-2 bg-red-100 text-red-700 hover:bg-red-200 rounded-md font-medium text-sm transition flex justify-center items-center gap-2"
                        >
                           <Eraser className="w-4 h-4" /> 
                           {language === 'zh' ? '删除链路' : 'Delete Link'}
                        </button>
                     </div>
                  </div>
               </div>
            ) : (
               <div key="empty-state" className="p-8 text-center text-slate-400 flex flex-col items-center justify-center h-full">
                  <Activity className="w-12 h-12 mb-4 opacity-50" />
                  <p>{t.selectHint}</p>
               </div>
            )}
         </div>
      </div>
      
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
      <ContextMenu
        visible={contextMenu.visible}
        x={contextMenu.x}
        y={contextMenu.y}
        items={
          contextMenu.type === 'node'
            ? buildNodeMenu(t, language)
            : contextMenu.type === 'link'
            ? buildLinkMenu(t, language)
            : buildBackgroundMenu(t, language)
        }
        onClose={handleCloseContextMenu}
        onAction={handleMenuAction}
      />
    </div>
  );
}

