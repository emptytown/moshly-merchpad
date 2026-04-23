/**
 * ProjectsSettings — project picker and manager
 * Design: "Neon Ledger" — 3 local slots + Hub Projects placeholder
 * Accessible from Settings tab
 */

import { useState } from 'react';
import { Plus, Pencil, Trash2, Check, X, ExternalLink, Lock, Layers } from 'lucide-react';
import { toast } from 'sonner';
import { useProjects } from '../contexts/ProjectContext';
import { MerchPadProject, PROJECT_COLORS, MAX_LOCAL_PROJECTS } from '../lib/projects';
import { cn } from '../lib/utils';

// ── Project Editor ─────────────────────────────────────────────────────────

interface ProjectEditorProps {
  project?: MerchPadProject;
  onSave: (name: string, description: string, color: string) => void;
  onClose: () => void;
}

function ProjectEditor({ project, onSave, onClose }: ProjectEditorProps) {
  const [name, setName] = useState(project?.name ?? '');
  const [description, setDescription] = useState(project?.description ?? '');
  const [color, setColor] = useState(project?.color ?? PROJECT_COLORS[0]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(14,15,20,0.9)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl animate-slide-up"
        style={{ background: '#141624', border: '1px solid #2D3048' }}>
        <div className="flex items-center justify-between p-4 border-b border-[#24273A]">
          <h2 className="text-base font-bold text-[#E6E7EB]">{project ? 'Edit Project' : 'New Project'}</h2>
          <button onClick={onClose} className="text-[#7B7F93] hover:text-[#E6E7EB] p-1"><X size={16} /></button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#7B7F93] uppercase tracking-wider mb-1.5">Project Name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Summer Tour 2026"
              className="w-full px-3 py-2 rounded-lg text-sm text-[#E6E7EB] bg-[#1B1E2E] border border-[#2D3048] focus:border-[#6B5CFF] focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#7B7F93] uppercase tracking-wider mb-1.5">Description (optional)</label>
            <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Main tour merch stand"
              className="w-full px-3 py-2 rounded-lg text-sm text-[#E6E7EB] bg-[#1B1E2E] border border-[#2D3048] focus:border-[#6B5CFF] focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#7B7F93] uppercase tracking-wider mb-2">Accent Colour</label>
            <div className="flex gap-2">
              {PROJECT_COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)}
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-transform hover:scale-110"
                  style={{ background: c, border: color === c ? '2px solid white' : '2px solid transparent' }}>
                  {color === c && <Check size={12} className="text-white" />}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-2 p-4 border-t border-[#24273A]">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-[#A4A7B5]"
            style={{ border: '1px solid #2D3048' }}>Cancel</button>
          <button onClick={() => { if (!name.trim()) { toast.error('Name required'); return; } onSave(name.trim(), description.trim(), color); }}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white mp-btn-primary">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Project Slot Card ──────────────────────────────────────────────────────

interface SlotCardProps {
  project?: MerchPadProject;
  isActive: boolean;
  slotIndex: number;
  onActivate: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onCreate: () => void;
}

function SlotCard({ project, isActive, slotIndex, onActivate, onEdit, onDelete, onCreate }: SlotCardProps) {
  if (!project) {
    return (
      <button onClick={onCreate}
        className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-dashed transition-all hover:border-[#6B5CFF] group"
        style={{ borderColor: '#2D3048' }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: '#1B1E2E' }}>
          <Plus size={18} className="text-[#7B7F93] group-hover:text-[#7C6DFF]" />
        </div>
        <div className="text-left">
          <p className="text-sm font-semibold text-[#7B7F93] group-hover:text-[#A4A7B5]">Slot {slotIndex + 1} — Empty</p>
          <p className="text-xs text-[#7B7F93]">Tap to create a new project</p>
        </div>
      </button>
    );
  }

  return (
    <div className={cn('rounded-xl p-4 transition-all', isActive ? 'ring-2' : '')}
      style={{
        background: isActive ? `${project.color}12` : '#1B1E2E',
        border: `1px solid ${isActive ? project.color + '50' : '#2D3048'}`,
        ...(isActive ? { ringColor: project.color } : {}),
      }}>
      <div className="flex items-center gap-3">
        {/* Color dot / active indicator */}
        <div className="relative flex-shrink-0">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: `${project.color}20` }}>
            <Layers size={18} style={{ color: project.color }} />
          </div>
          {isActive && (
            <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
              style={{ background: project.color }}>
              <Check size={9} className="text-white" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-[#E6E7EB] truncate">{project.name}</p>
            {isActive && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                style={{ background: `${project.color}20`, color: project.color }}>
                ACTIVE
              </span>
            )}
          </div>
          {project.description && (
            <p className="text-xs text-[#7B7F93] truncate">{project.description}</p>
          )}
          <p className="text-xs text-[#7B7F93] mt-0.5">
            Slot {slotIndex + 1} · Local
          </p>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {!isActive && (
            <button onClick={onActivate}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
              style={{ background: `${project.color}15`, color: project.color, border: `1px solid ${project.color}30` }}>
              Switch
            </button>
          )}
          <button onClick={onEdit}
            className="p-1.5 rounded-lg text-[#7B7F93] hover:text-[#E6E7EB] transition-colors"
            style={{ border: '1px solid #2D3048' }}>
            <Pencil size={12} />
          </button>
          <button onClick={onDelete}
            className="p-1.5 rounded-lg text-[#7B7F93] hover:text-[#F87171] transition-colors"
            style={{ border: '1px solid #2D3048' }}>
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Hub Project Card ───────────────────────────────────────────────────────

function HubProjectCard() {
  return (
    <div className="rounded-xl p-4"
      style={{ background: '#1B1E2E', border: '1px solid #2D3048' }}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(123,127,147,0.1)' }}>
          <Lock size={16} className="text-[#7B7F93]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-[#7B7F93]">Moshly Hub Projects</p>
          <p className="text-xs text-[#7B7F93]">Requires Moshly account connection</p>
        </div>
        <button
          onClick={() => toast.info('Hub integration coming soon — requires Moshly OAuth')}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#7B7F93] transition-colors"
          style={{ border: '1px solid #2D3048' }}>
          <ExternalLink size={11} /> Connect
        </button>
      </div>
      <div className="mt-3 px-3 py-2 rounded-lg"
        style={{ background: 'rgba(107,92,255,0.06)', border: '1px solid rgba(107,92,255,0.15)' }}>
        <p className="text-xs text-[#7C6DFF] font-semibold mb-0.5">Coming Soon</p>
        <p className="text-xs text-[#7B7F93] leading-relaxed">
          Connect your Moshly Hub account to pull projects directly from your dashboard.
          Hub projects are read-only here and sync automatically.
        </p>
      </div>
    </div>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────

export default function ProjectsSettings() {
  const { localProjects, activeProject, setActiveProject, createLocalProject, updateLocalProject, deleteLocalProject, canCreateMore } = useProjects();

  const [editingProject, setEditingProject] = useState<MerchPadProject | null>(null);
  const [creatingAtSlot, setCreatingAtSlot] = useState<number | null>(null);

  // Fill 3 slots (empty slots = undefined)
  const slots: (MerchPadProject | undefined)[] = Array.from({ length: MAX_LOCAL_PROJECTS }, (_, i) => localProjects[i]);

  function handleCreate(name: string, description: string, color: string) {
    const project = createLocalProject(name, description, color);
    if (!project) { toast.error('Maximum 3 local projects reached'); return; }
    setCreatingAtSlot(null);
    toast.success(`Project "${name}" created`);
  }

  function handleUpdate(name: string, description: string, color: string) {
    if (!editingProject) return;
    updateLocalProject({ ...editingProject, name, description, color });
    setEditingProject(null);
    toast.success('Project updated');
  }

  function handleDelete(project: MerchPadProject) {
    if (localProjects.filter(p => p.source === 'local').length <= 1) {
      toast.error('Cannot delete the last project');
      return;
    }
    if (!confirm(`Delete "${project.name}"? All data in this project will be lost.`)) return;
    deleteLocalProject(project.id);
    toast.success('Project deleted');
  }

  function handleSwitch(project: MerchPadProject) {
    setActiveProject(project);
    toast.success(`Switched to "${project.name}"`, { description: 'Reload the app to apply the project context.' });
  }

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="px-4 pt-4 pb-4">
        <p className="text-xs font-semibold text-[#7C6DFF] uppercase tracking-widest mb-1">Projects</p>
        <h1 className="text-2xl font-black text-[#E6E7EB] leading-tight" style={{ letterSpacing: '-0.03em' }}>
          Project Picker
        </h1>
        <p className="text-sm text-[#7B7F93] mt-1">
          Each project is a fully isolated workspace — its own products, shows, sessions, and stock.
        </p>
      </div>

      <div className="px-4 space-y-3 pb-8">
        {/* Local slots */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-[#7B7F93] uppercase tracking-wider">
              Local Slots ({localProjects.length}/{MAX_LOCAL_PROJECTS})
            </p>
          </div>
          <div className="space-y-2">
            {slots.map((project, i) => (
              <SlotCard
                key={project?.id ?? `empty-${i}`}
                project={project}
                isActive={project?.id === activeProject?.id}
                slotIndex={i}
                onActivate={() => project && handleSwitch(project)}
                onEdit={() => project && setEditingProject(project)}
                onDelete={() => project && handleDelete(project)}
                onCreate={() => setCreatingAtSlot(i)}
              />
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 py-1">
          <div className="flex-1 h-px bg-[#24273A]" />
          <span className="text-xs text-[#7B7F93] uppercase tracking-wider">Hub</span>
          <div className="flex-1 h-px bg-[#24273A]" />
        </div>

        {/* Hub projects */}
        <HubProjectCard />

        {/* Info note */}
        <div className="rounded-xl px-3 py-2.5"
          style={{ background: 'rgba(14,15,20,0.6)', border: '1px solid #24273A' }}>
          <p className="text-xs text-[#7B7F93] leading-relaxed">
            <span className="text-[#A4A7B5] font-semibold">Note:</span> Switching projects takes effect on the next app reload.
            The active project is shown in the top bar throughout the app.
          </p>
        </div>
      </div>

      {/* Modals */}
      {creatingAtSlot !== null && (
        <ProjectEditor
          onSave={handleCreate}
          onClose={() => setCreatingAtSlot(null)}
        />
      )}
      {editingProject && (
        <ProjectEditor
          project={editingProject}
          onSave={handleUpdate}
          onClose={() => setEditingProject(null)}
        />
      )}
    </div>
  );
}
