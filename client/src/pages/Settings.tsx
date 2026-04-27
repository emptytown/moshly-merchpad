/**
 * Settings — app configuration screen
 * Design: "Neon Ledger" — dark glass cards, toggle controls
 * Features: Projects picker, undo toggle, stock thresholds, rep name, device info
 */

import { useState } from 'react';
import { toast } from 'sonner';
import { Smartphone, User, RotateCcw, BarChart3, Info, Layers, ChevronRight, BookOpen, Package, Palette, Sun, Moon, DollarSign, Tag } from 'lucide-react';
import { useMerchPad } from '../contexts/MerchPadContext';
import { useProjects } from '../contexts/ProjectContext';
import { setSetting } from '../lib/db';
import { Switch } from '../components/ui/switch';
import { Slider } from '../components/ui/slider';
import ProjectsSettings from './ProjectsSettings';
import MasterCatalogue from './MasterCatalogue';
import CategoryManager from './CategoryManager';
import DangerZone from '../components/DangerZone';
import TeamEditor from '../components/TeamEditor';
import { useTheme, type Skin, type Mode } from '../contexts/ThemeContext';

type SettingsView = 'main' | 'projects' | 'catalogue' | 'categories';

export default function Settings() {
  const { skin, mode, setSkin, setMode } = useTheme();
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

  async function toggleRequireTransferNote(val: boolean) {
    if (!activeProject) return;
    await setSetting(activeProject.id, 'requireTransferNote', val);
    dispatch({ type: 'SET_SETTINGS', payload: { requireTransferNote: val } });
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

  if (view === 'categories') {
    return <CategoryManager onBack={() => setView('main')} />;
  }

  return (
    <div className="mp-settings min-h-full animate-fade-in">
      {/* Header */}
      <div className="px-4 pt-4 pb-4">
        <p className="text-xs font-semibold text-[#7C6DFF] uppercase tracking-widest mb-1">Settings</p>
        <h1 className="text-2xl font-black text-[#E6E7EB] leading-tight" style={{ letterSpacing: '-0.03em' }}>
          Configuration
        </h1>
      </div>

      <div className="px-4 space-y-4 pb-8">

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

        {/* Categories entry point */}
        <button onClick={() => setView('categories')}
          className="w-full mp-card p-4 flex items-center gap-3 text-left hover:border-[#6B5CFF] transition-colors">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(124,109,255,0.1)' }}>
            <Tag size={18} className="text-[#7C6DFF]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-[#E6E7EB]">Categories</p>
            <p className="text-xs text-[#7B7F93]">Manage product categories</p>
          </div>
          <ChevronRight size={16} className="text-[#7B7F93] flex-shrink-0" />
        </button>

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
            <DollarSign size={15} className="text-[#7C6DFF]" />
            <p className="text-sm font-bold text-[#E6E7EB]">Currency</p>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[#A4A7B5]">Display Currency</p>
              <p className="text-xs text-[#7B7F93]">Default currency for all products</p>
            </div>
            <select
              value={settings.currency || 'EUR'}
              onChange={async (e) => {
                const val = e.target.value;
                await setSetting(activeProject!.id, 'currency', val);
                dispatch({ type: 'SET_SETTINGS', payload: { currency: val } });
                toast.success(`Currency set to ${val}`);
              }}
              className="bg-[#0E0F14] text-[#E6E7EB] text-sm font-bold rounded-lg border border-[#2D3048] px-2 py-1 focus:border-[#6B5CFF] focus:outline-none"
            >
              <option value="EUR">Euro (€)</option>
              <option value="USD">Dollar ($)</option>
              <option value="GBP">Pound (£)</option>
            </select>
          </div>

          <div className="border-t border-[#24273A] pt-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-[#A4A7B5]">Default Stock Location</p>
              <p className="text-xs text-[#7B7F93]">Where new product stock is added</p>
            </div>
            <select
              value={settings.defaultStockLocation || 'road'}
              onChange={async (e) => {
                const val = e.target.value as 'road' | 'warehouse';
                await setSetting(activeProject!.id, 'defaultStockLocation', val);
                dispatch({ type: 'SET_SETTINGS', payload: { defaultStockLocation: val } });
                toast.success(`Default stock set to ${val.charAt(0).toUpperCase() + val.slice(1)}`);
              }}
              className="bg-[#0E0F14] text-[#E6E7EB] text-sm font-bold rounded-lg border border-[#2D3048] px-2 py-1 focus:border-[#6B5CFF] focus:outline-none"
            >
              <option value="road">Road Stock</option>
              <option value="warehouse">Warehouse</option>
            </select>
          </div>

          <div className="border-t border-[#24273A] pt-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-[#A4A7B5]">Require Transfer Note</p>
              <p className="text-xs text-[#7B7F93]">Make notes mandatory for stock transfers</p>
            </div>
            <Switch
              checked={settings.requireTransferNote}
              onCheckedChange={toggleRequireTransferNote}
            />
          </div>
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

        {/* Register & Cash */}
        <div className="mp-card p-4 space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: 'rgba(248,113,113,0.12)' }}>
              <span className="text-[10px] font-black text-[#F87171]">RC</span>
            </div>
            <p className="text-sm font-bold text-[#E6E7EB]">Register &amp; Cash</p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#A4A7B5]">Require reason for discounts</p>
                <p className="text-xs text-[#7B7F93]">Ask seller to state why a discount was applied</p>
              </div>
              <Switch
                checked={settings.requireDiscountReason ?? true}
                onCheckedChange={async (val) => {
                  await setSetting('requireDiscountReason', val);
                  dispatch({ type: 'SET_SETTINGS', payload: { requireDiscountReason: val } });
                }}
              />
            </div>

            <div className="flex items-center justify-between border-t border-[#24273A] pt-3">
              <div>
                <p className="text-sm text-[#A4A7B5]">Allow seller debt resolution</p>
                <p className="text-xs text-[#7B7F93]">Offer "Seller Debt" option when cash is insufficient</p>
              </div>
              <Switch
                checked={settings.allowSellerDebt ?? true}
                onCheckedChange={async (val) => {
                  await setSetting('allowSellerDebt', val);
                  dispatch({ type: 'SET_SETTINGS', payload: { allowSellerDebt: val } });
                }}
              />
            </div>

            <div className="flex items-center justify-between border-t border-[#24273A] pt-3">
              <div>
                <p className="text-sm text-[#A4A7B5]">Require reason for seller debt</p>
                <p className="text-xs text-[#7B7F93]">Ask seller to explain why they accepted the shortfall</p>
              </div>
              <Switch
                checked={settings.requireDebtReason ?? true}
                onCheckedChange={async (val) => {
                  await setSetting('requireDebtReason', val);
                  dispatch({ type: 'SET_SETTINGS', payload: { requireDebtReason: val } });
                }}
              />
            </div>
          </div>
        </div>

        {/* Appearance */}
        <div className="mp-card p-4 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Palette size={15} style={{ color: 'var(--color-mp-accent)' }} />
            <p className="text-sm font-bold" style={{ color: 'var(--color-mp-text-primary)' }}>Appearance</p>
          </div>
          {/* Skin chooser */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-mp-text-tertiary)' }}>Skin</p>
            <div className="grid grid-cols-2 gap-2">
              {(['neon', 'mono'] as Skin[]).map(s => (
                <button
                  key={s}
                  onClick={() => setSkin(s)}
                  className="relative flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all"
                  style={{
                    background: skin === s ? 'var(--color-mp-accent-muted)' : 'var(--color-mp-bg-secondary)',
                    borderColor: skin === s ? 'var(--color-mp-accent)' : 'var(--color-mp-border-strong)',
                  }}>
                  {/* Mini preview swatch */}
                  <div className="w-full h-10 rounded-lg overflow-hidden flex">
                    {s === 'neon' ? (
                      <>
                        <div className="flex-1" style={{ background: '#0E0F14' }} />
                        <div className="flex-1" style={{ background: 'linear-gradient(135deg,#6B5CFF,#C026D3)' }} />
                      </>
                    ) : (
                      <>
                        <div className="flex-1" style={{ background: mode === 'light' ? '#FFFFFF' : '#0A0A0A' }} />
                        <div className="flex-1" style={{ background: mode === 'light' ? '#888888' : '#D0D0D0' }} />
                      </>
                    )}
                  </div>
                  <span className="text-xs font-bold capitalize" style={{ color: skin === s ? 'var(--color-mp-accent)' : 'var(--color-mp-text-secondary)' }}>
                    {s === 'neon' ? 'Neon Ledger' : 'Mono'}
                  </span>
                  {skin === s && (
                    <div className="absolute top-2 right-2 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: 'var(--color-mp-accent)' }}>
                      <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1.5 4L3.5 6L6.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
          {/* Light / Dark toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {mode === 'dark'
                ? <Moon size={14} style={{ color: 'var(--color-mp-text-secondary)' }} />
                : <Sun size={14} style={{ color: 'var(--color-mp-text-secondary)' }} />}
              <span className="text-sm font-semibold" style={{ color: 'var(--color-mp-text-primary)' }}>
                {mode === 'dark' ? 'Dark Mode' : 'Light Mode'}
              </span>
            </div>
            <button
              onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')}
              className="relative w-12 h-6 rounded-full transition-all flex-shrink-0"
              style={{ background: mode === 'dark' ? 'var(--color-mp-accent)' : 'var(--color-mp-border-strong)' }}>
              <span
                className="absolute top-0.5 w-5 h-5 rounded-full transition-all"
                style={{
                  background: 'white',
                  left: mode === 'dark' ? 'calc(100% - 1.375rem)' : '0.125rem',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                }}
              />
            </button>
          </div>
        </div>

        {/* Team Editor */}
        <div className="mp-card p-4">
          <TeamEditor />
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
