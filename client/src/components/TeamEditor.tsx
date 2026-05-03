/**
 * TeamEditor — manage team members in Settings
 * Design: "Neon Ledger" — dark glass cards, right-drawer form
 */
import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Users, Plus, Pencil, Trash2, Phone, Mail, UserCheck, UserX } from 'lucide-react';
import { toast } from 'sonner';
import { useMerchPad } from '../contexts/MerchPadContext';
import { TeamMember } from '../lib/db';
import { RightDrawer } from './RightDrawer';
import { Switch } from './ui/switch';

const EMPTY: Omit<TeamMember, 'id' | 'createdAt' | 'updatedAt'> = {
  name: '',
  phone: '',
  email: '',
  active: true,
};

export default function TeamEditor() {
  const { state, saveTeamMember, deleteTeamMember } = useMerchPad();
  const { teamMembers } = state;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  function openNew() {
    setEditing(null);
    setForm(EMPTY);
    setDrawerOpen(true);
  }

  function openEdit(m: TeamMember) {
    setEditing(m);
    setForm({ name: m.name, phone: m.phone ?? '', email: m.email ?? '', active: m.active });
    setDrawerOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    const now = new Date().toISOString();
    const member: TeamMember = editing
      ? { ...editing, ...form, phone: form.phone || undefined, email: form.email || undefined, updatedAt: now }
      : { id: uuidv4(), ...form, phone: form.phone || undefined, email: form.email || undefined, createdAt: now, updatedAt: now };
    await saveTeamMember(member);
    toast.success(editing ? `${member.name} updated` : `${member.name} added to team`);
    setDrawerOpen(false);
  }

  async function handleDelete(id: string) {
    await deleteTeamMember(id);
    toast.success('Team member removed');
    setConfirmDelete(null);
  }

  const active = teamMembers.filter(m => m.active);
  const inactive = teamMembers.filter(m => !m.active);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users size={15} className="text-[#7C6DFF]" />
          <p className="text-sm font-bold text-[#E6E7EB]">Team</p>
          <span className="text-xs text-[#7B7F93]">{active.length} active</span>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white mp-btn-primary"
        >
          <Plus size={12} /> Add Member
        </button>
      </div>

      {/* Active members */}
      {active.length > 0 && (
        <div className="space-y-1.5">
          {active.map(m => (
            <MemberRow key={m.id} member={m} onEdit={openEdit} onDelete={setConfirmDelete} />
          ))}
        </div>
      )}

      {/* Inactive members */}
      {inactive.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold text-[#7B7F93] uppercase tracking-wider mt-2">Inactive</p>
          {inactive.map(m => (
            <MemberRow key={m.id} member={m} onEdit={openEdit} onDelete={setConfirmDelete} />
          ))}
        </div>
      )}

      {teamMembers.length === 0 && (
        <div className="mp-card p-4 text-center">
          <Users size={20} className="text-[#7B7F93] mx-auto mb-2" />
          <p className="text-sm text-[#7B7F93]">No team members yet</p>
          <p className="text-xs text-[#7B7F93] mt-1">Add members to track personal sales stats</p>
        </div>
      )}

      {/* Edit / Create Drawer */}
      <RightDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editing ? 'Edit Member' : 'New Team Member'}
        subtitle={editing ? editing.name : 'Fill in the details below'}
      >
        <div className="min-h-0 p-3 space-y-3 overflow-y-auto">
          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-[#7B7F93] uppercase tracking-wider mb-1.5">Name *</label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Full name"
              className="w-full px-3 py-2.5 rounded-xl text-sm text-[#E6E7EB] placeholder-[#7B7F93] outline-none focus:ring-1 focus:ring-[#7C6DFF]"
              style={{ background: 'rgba(14,15,20,0.6)', border: '1px solid #2D3048' }}
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-xs font-semibold text-[#7B7F93] uppercase tracking-wider mb-1.5">
              <Phone size={10} className="inline mr-1" />Phone
            </label>
            <input
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              placeholder="+1 555 000 0000"
              type="tel"
              className="w-full px-3 py-2.5 rounded-xl text-sm text-[#E6E7EB] placeholder-[#7B7F93] outline-none focus:ring-1 focus:ring-[#7C6DFF]"
              style={{ background: 'rgba(14,15,20,0.6)', border: '1px solid #2D3048' }}
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-semibold text-[#7B7F93] uppercase tracking-wider mb-1.5">
              <Mail size={10} className="inline mr-1" />Email
            </label>
            <input
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="name@example.com"
              type="email"
              className="w-full px-3 py-2.5 rounded-xl text-sm text-[#E6E7EB] placeholder-[#7B7F93] outline-none focus:ring-1 focus:ring-[#7C6DFF]"
              style={{ background: 'rgba(14,15,20,0.6)', border: '1px solid #2D3048' }}
            />
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between py-2 px-3 rounded-xl" style={{ background: 'rgba(14,15,20,0.4)', border: '1px solid #2D3048' }}>
            <div className="flex items-center gap-2">
              {form.active ? <UserCheck size={14} className="text-[#4ADE80]" /> : <UserX size={14} className="text-[#7B7F93]" />}
              <span className="text-sm text-[#E6E7EB]">Active</span>
              <span className="text-xs text-[#7B7F93]">{form.active ? 'Appears in Office team section' : 'Hidden from active roster'}</span>
            </div>
            <Switch
              checked={form.active}
              onCheckedChange={val => setForm(f => ({ ...f, active: val }))}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 p-3 border-t border-[#24273A] flex-shrink-0">
          <button
            onClick={() => setDrawerOpen(false)}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-[#A4A7B5] hover:text-[#E6E7EB] transition-colors"
            style={{ border: '1px solid #2D3048' }}
          >
            Cancel
          </button>
          <button onClick={handleSave} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white mp-btn-primary">
            {editing ? 'Save Changes' : 'Add Member'}
          </button>
        </div>
      </RightDrawer>

      {/* Confirm delete dialog */}
      {confirmDelete && (() => {
        const m = teamMembers.find(x => x.id === confirmDelete);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
            <div className="mp-card p-5 max-w-xs w-full space-y-3">
              <p className="text-sm font-bold text-[#E6E7EB]">Remove {m?.name}?</p>
              <p className="text-xs text-[#7B7F93]">This only removes the team member record. Historical sales data is preserved.</p>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setConfirmDelete(null)} className="flex-1 py-2 rounded-lg text-sm text-[#A4A7B5]" style={{ border: '1px solid #2D3048' }}>Cancel</button>
                <button onClick={() => handleDelete(confirmDelete)} className="flex-1 py-2 rounded-lg text-sm font-bold text-white bg-[#F87171]/20 hover:bg-[#F87171]/30 border border-[#F87171]/40 transition-colors">Remove</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function MemberRow({ member, onEdit, onDelete }: {
  member: TeamMember;
  onEdit: (m: TeamMember) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="mp-card px-3 py-2.5 flex items-center gap-3">
      {/* Avatar */}
      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold"
        style={{ background: member.active ? 'rgba(124,109,255,0.2)' : 'rgba(255,255,255,0.05)', color: member.active ? '#7C6DFF' : '#7B7F93' }}>
        {member.name.charAt(0).toUpperCase()}
      </div>
      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#E6E7EB] truncate">{member.name}</p>
        <p className="text-xs text-[#7B7F93] truncate">
          {[member.phone, member.email].filter(Boolean).join(' · ') || 'No contact info'}
        </p>
      </div>
      {/* Status badge */}
      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${member.active ? 'text-[#4ADE80] bg-[#4ADE80]/10' : 'text-[#7B7F93] bg-white/5'}`}>
        {member.active ? 'Active' : 'Off'}
      </span>
      {/* Actions */}
      <div className="flex items-center gap-1">
        <button onClick={() => onEdit(member)} className="w-7 h-7 flex items-center justify-center rounded-lg text-[#7B7F93] hover:text-[#7C6DFF] hover:bg-[rgba(124,109,255,0.1)] transition-colors">
          <Pencil size={12} />
        </button>
        <button onClick={() => onDelete(member.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-[#7B7F93] hover:text-[#F87171] hover:bg-[rgba(248,113,113,0.1)] transition-colors">
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}
