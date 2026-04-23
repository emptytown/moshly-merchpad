/**
 * Settings — app configuration screen
 * Design: "Neon Ledger" — dark glass cards, toggle controls
 * Features: Projects picker, undo toggle, stock thresholds, rep name, device info
 */

import { useState } from 'react';
import { toast } from 'sonner';
import { Smartphone, User, RotateCcw, BarChart3, Info, Layers, ChevronRight, BookOpen, Package } from 'lucide-react';
import { useMerchPad } from '../contexts/MerchPadContext';
import { useProjects } from '../contexts/ProjectContext';
import { setSetting } from '../lib/db';
import { Switch } from '../components/ui/switch';
import { Slider } from '../components/ui/slider';
import ProjectsSettings from './ProjectsSettings';
import MasterCatalogue from './MasterCatalogue';
import DangerZone from '../components/DangerZone';

type SettingsView = 'main' | 'projects' | 'catalogue';

export default function Settings() {
  const { state, dispatch } = useMerchPad();
  const { settings, deviceId, repName } = state;
  const { activeProject, localProjects } = useProjects();

  const [localRepName, setLocalRepName] = useState(repName);
  const [view, setView] = useState<SettingsView>('main');

  async function saveRepName() {
    await setSetting('repName', localRepName);
    dispatch({ type: 'SET_REP_NAME', payload: localRepName });
    toast.success('Name saved');
  }

  async function toggleUndo(val: boolean) {
    await setSetting('undoEnabled', val);
    dispatch({ type: 'SET_SETTINGS', payload: { undoEnabled: val } });
  }

  if (view === 'projects') {
    return (
      <div className="min-h-full animate-fade-in">
        <div className="px-4 pt-4">
          <button onClick={() => setView('main')}
            className="flex items-center gap-1 text-xs font-semibold text-[#7C6DFF] hover:text-[#9B8FFF] mb-5 transition-colors">
            ← Back to Settings
          </button>
        </div>
        <ProjectsSettings />
      </div>
    );
  }

  if (view === 'catalogue') {
    return <MasterCatalogue onBack={() => setView('main')} />;
  }

  return (
    <div className="min-h-full animate-fade-in">
      {/* Header */}
      <div className="px-4 pt-4 pb-4">
        <p className="text-xs font-semibold text-[#7C6DFF] uppercase tracking-widest mb-1">Settings</p>
        <h1 className="text-2xl font-black text-[#E6E7EB] leading-tight" style={{ letterSpacing: '-0.03em' }}>
          Configuration
        </h1>
      </div>

      <div className="px-4 space-y-4 pb-8">

        {/* Item Template Creator entry point */}
        <button onClick={() => setView('catalogue')}
          className="w-full mp-card p-4 flex items-center gap-3 text-left hover:border-[#6B5CFF] transition-colors">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(0,229,255,0.1)' }}>
            <BookOpen size={18} style={{ color: '#00E5FF' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-[#E6E7EB]">Item Template Creator</p>
            <p className="text-xs text-[#7B7F93]">Global product templates for all projects</p>
          </div>
          <ChevronRight size={16} className="text-[#7B7F93] flex-shrink-0" />
        </button>

        {/* Projects — prominent entry point */}
        <button onClick={() => setView('projects')}
          className="w-full mp-card p-4 flex items-center gap-3 text-left hover:border-[#6B5CFF] transition-colors">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: activeProject ? `${activeProject.color}15` : 'rgba(107,92,255,0.12)' }}>
            <Layers size={18} style={{ color: activeProject?.color ?? '#6B5CFF' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-[#E6E7EB]">Projects</p>
            <p className="text-xs text-[#7B7F93]">
              {activeProject
                ? <><span style={{ color: activeProject.color }}>{activeProject.name}</span> · {localProjects.length}/3 slots used</>
                : 'No project selected'}
            </p>
          </div>
          <ChevronRight size={16} className="text-[#7B7F93] flex-shrink-0" />
        </button>

        {/* Rep name */}
        <div className="mp-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <User size={15} className="text-[#7C6DFF]" />
            <p className="text-sm font-bold text-[#E6E7EB]">Sales Rep Name</p>
          </div>
          <div className="flex gap-2">
            <input
              value={localRepName}
              onChange={e => setLocalRepName(e.target.value)}
              placeholder="Your name"
              className="flex-1 px-3 py-2 rounded-lg text-sm text-[#E6E7EB] bg-[#0E0F14] border border-[#2D3048] focus:border-[#6B5CFF] focus:outline-none"
            />
            <button onClick={saveRepName}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white mp-btn-primary">
              Save
            </button>
          </div>
          <p className="text-xs text-[#7B7F93] mt-2">Shown on the tally screen and attached to all audit entries.</p>
        </div>

        {/* Tally settings */}
        <div className="mp-card p-4 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <RotateCcw size={15} className="text-[#7C6DFF]" />
            <p className="text-sm font-bold text-[#E6E7EB]">Tally Options</p>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[#A4A7B5]">Undo Last</p>
              <p className="text-xs text-[#7B7F93]">Show [UNDO LAST] button on tally screen</p>
            </div>
            <Switch
              checked={settings.undoEnabled}
              onCheckedChange={toggleUndo}
            />
          </div>

          <div className="border-t border-[#24273A] pt-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: 'rgba(74,222,128,0.12)' }}>
                <span className="text-[10px] font-black text-[#4ADE80]">CM</span>
              </div>
              <p className="text-sm font-bold text-[#E6E7EB]">Client Mode</p>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#A4A7B5]">Require money input</p>
                <p className="text-xs text-[#7B7F93]">Shade "Complete Sale" until cash amount is entered</p>
              </div>
              <Switch
                checked={settings.requireMoneyInput}
                onCheckedChange={async (val) => {
                  await setSetting('requireMoneyInput', val);
                  dispatch({ type: 'SET_SETTINGS', payload: { requireMoneyInput: val } });
                }}
              />
            </div>
          </div>

          <div className="border-t border-[#24273A] pt-4 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: 'rgba(124,109,255,0.15)' }}>
                <span className="text-[10px] font-black text-[#7C6DFF]">SB</span>
              </div>
              <p className="text-sm font-bold text-[#E6E7EB]">Sticky Bottom Bar</p>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#A4A7B5]">Sticky in Tally mode</p>
                <p className="text-xs text-[#7B7F93]">Keep Sold / Total bar always visible in Tally mode</p>
              </div>
              <Switch
                checked={settings.stickyBarTally}
                onCheckedChange={async (val) => {
                  await setSetting('stickyBarTally', val);
                  dispatch({ type: 'SET_SETTINGS', payload: { stickyBarTally: val } });
                }}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#A4A7B5]">Sticky in Register mode</p>
                <p className="text-xs text-[#7B7F93]">Keep Sold / Total bar always visible in Register mode</p>
              </div>
              <Switch
                checked={settings.stickyBarRegister}
                onCheckedChange={async (val) => {
                  await setSetting('stickyBarRegister', val);
                  dispatch({ type: 'SET_SETTINGS', payload: { stickyBarRegister: val } });
                }}
              />
            </div>
          </div>
        </div>

        {/* Stock thresholds */}
        <div className="mp-card p-4 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 size={15} className="text-[#7C6DFF]" />
            <p className="text-sm font-bold text-[#E6E7EB]">Stock Stroke Thresholds</p>
          </div>
          <p className="text-xs text-[#7B7F93]">
            Card border color changes based on remaining stock percentage relative to the snapshot taken at session start.
          </p>

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#FBBF24]" />
                  <span className="text-sm text-[#A4A7B5]">Yellow threshold</span>
                </div>
                <span className="text-sm font-bold text-[#FBBF24]">
                  {Math.round(settings.stockThresholdYellow * 100)}%
                </span>
              </div>
              <Slider
                value={[settings.stockThresholdYellow * 100]}
                onValueChange={async ([v]) => { dispatch({ type: 'SET_SETTINGS', payload: { stockThresholdYellow: v / 100 } }); await setSetting('stockThresholdYellow', v / 100); }}
                min={10} max={60} step={5}
                className="w-full"
              />
              <p className="text-xs text-[#7B7F93] mt-1">Below this % → yellow border</p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#F87171]" />
                  <span className="text-sm text-[#A4A7B5]">Red threshold</span>
                </div>
                <span className="text-sm font-bold text-[#F87171]">
                  {Math.round(settings.stockThresholdRed * 100)}%
                </span>
              </div>
              <Slider
                value={[settings.stockThresholdRed * 100]}
                onValueChange={async ([v]) => { dispatch({ type: 'SET_SETTINGS', payload: { stockThresholdRed: v / 100 } }); await setSetting('stockThresholdRed', v / 100); }}
                min={1} max={20} step={1}
                className="w-full"
              />
              <p className="text-xs text-[#7B7F93] mt-1">Below this % → red border + pulse</p>
            </div>
          </div>

          {/* Preview */}
          <div className="flex gap-2 pt-2">
            {[
              { label: 'High', cls: 'mp-card-stock-high', color: '#4ADE80' },
              { label: 'Medium', cls: 'mp-card-stock-medium', color: '#FBBF24' },
              { label: 'Low', cls: 'mp-card-stock-low', color: '#F87171' },
            ].map(({ label, cls, color }) => (
              <div key={label} className={`flex-1 mp-card ${cls} py-2 text-center`}>
                <p className="text-xs font-bold" style={{ color }}>{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Device info */}
        <div className="mp-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Smartphone size={15} className="text-[#7C6DFF]" />
            <p className="text-sm font-bold text-[#E6E7EB]">Device</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#7B7F93]">Device ID</span>
              <span className="text-xs text-[#A4A7B5] font-mono">{deviceId.slice(0, 8)}…</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#7B7F93]">Auth</span>
              <span className="text-xs text-[#FBBF24]">Auth-free (MVP)</span>
            </div>
          </div>
        </div>

        {/* About */}
        <div className="mp-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Info size={15} className="text-[#7C6DFF]" />
            <p className="text-sm font-bold text-[#E6E7EB]">About MerchPad</p>
          </div>
          <p className="text-xs text-[#7B7F93] leading-relaxed">
            MerchPad is an offline-first merchandise sales tool for live shows. Part of the Moshly ecosystem.
            All data is stored locally on this device and syncs to the backend when online.
          </p>
          <p className="text-xs text-[#7B7F93] mt-2">Version 0.3.0 — MVP</p>
        </div>

        {/* Danger Zone */}
        <DangerZone />

      </div>
    </div>
  );
}
