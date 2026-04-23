/**
 * Settings — app configuration screen
 * Design: "Neon Ledger" — dark glass cards, toggle controls
 * Features: undo toggle, stock thresholds, rep name, device info
 */

import { useState } from 'react';
import { toast } from 'sonner';
import { Smartphone, User, RotateCcw, BarChart3, Info } from 'lucide-react';
import { useMerchPad } from '../contexts/MerchPadContext';
import { setSetting } from '../lib/db';
import { Switch } from '../components/ui/switch';
import { Slider } from '../components/ui/slider';

export default function Settings() {
  const { state, dispatch } = useMerchPad();
  const { settings, deviceId, repName } = state;

  const [localRepName, setLocalRepName] = useState(repName);

  async function saveRepName() {
    await setSetting('repName', localRepName);
    dispatch({ type: 'SET_REP_NAME', payload: localRepName });
    toast.success('Name saved');
  }

  async function toggleUndo(val: boolean) {
    await setSetting('undoEnabled', val);
    dispatch({ type: 'SET_SETTINGS', payload: { undoEnabled: val } });
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
                <span className="text-sm font-bold text-[#FBBF24] mp-mono">
                  {Math.round(settings.stockThresholdYellow * 100)}%
                </span>
              </div>
              <Slider
                value={[settings.stockThresholdYellow * 100]}
                onValueChange={([v]) => dispatch({ type: 'SET_SETTINGS', payload: { stockThresholdYellow: v / 100 } })}
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
                <span className="text-sm font-bold text-[#F87171] mp-mono">
                  {Math.round(settings.stockThresholdRed * 100)}%
                </span>
              </div>
              <Slider
                value={[settings.stockThresholdRed * 100]}
                onValueChange={([v]) => dispatch({ type: 'SET_SETTINGS', payload: { stockThresholdRed: v / 100 } })}
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
              <span className="text-xs text-[#A4A7B5] mp-mono">{deviceId.slice(0, 8)}…</span>
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
          <p className="text-xs text-[#7B7F93] mt-2">Version 0.1.0 — MVP</p>
        </div>
      </div>
    </div>
  );
}
