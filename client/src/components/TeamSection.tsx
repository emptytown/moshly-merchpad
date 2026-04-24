/**
 * TeamSection — shows active team members with personal sales stats in MerchOffice
 * Design: "Neon Ledger" — dark glass cards, stat chips
 */
import { useEffect, useState } from 'react';
import { Users, TrendingUp, Clock, ShoppingBag, DollarSign } from 'lucide-react';
import { useMerchPad } from '../contexts/MerchPadContext';
import { TeamMember } from '../lib/db';

interface MemberStats {
  shifts: number;
  hoursWorked: number;
  totalItems: number;
  totalRevenue: number;
}

export default function TeamSection() {
  const { state, getTeamMemberStats } = useMerchPad();
  const { teamMembers } = state;
  const active = teamMembers.filter(m => m.active);

  const [stats, setStats] = useState<Record<string, MemberStats>>({});

  useEffect(() => {
    if (active.length === 0) return;
    let cancelled = false;
    async function loadStats() {
      const results: Record<string, MemberStats> = {};
      await Promise.all(
        active.map(async m => {
          results[m.id] = await getTeamMemberStats(m.id);
        })
      );
      if (!cancelled) setStats(results);
    }
    loadStats();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamMembers]);

  if (active.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <p className="text-xs font-semibold text-[#7B7F93] uppercase tracking-wider">Team</p>
        <span className="text-[10px] text-[#7B7F93]">· {active.length} active</span>
      </div>
      <div className="space-y-2">
        {active.map(member => {
          const s = stats[member.id];
          return (
            <MemberCard key={member.id} member={member} stats={s} />
          );
        })}
      </div>
    </div>
  );
}

function MemberCard({ member, stats }: { member: TeamMember; stats?: MemberStats }) {
  const initials = member.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="mp-card p-3">
      <div className="flex items-center gap-3 mb-2.5">
        {/* Avatar */}
        <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold"
          style={{ background: 'rgba(124,109,255,0.2)', color: '#7C6DFF' }}>
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[#E6E7EB] truncate">{member.name}</p>
          {member.phone && <p className="text-xs text-[#7B7F93] truncate">{member.phone}</p>}
        </div>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-[#4ADE80] bg-[#4ADE80]/10">Active</span>
      </div>

      {/* Stats row */}
      {stats ? (
        <div className="grid grid-cols-4 gap-1.5">
          <StatChip
            icon={<ShoppingBag size={10} />}
            label="Shifts"
            value={String(stats.shifts)}
            color="#7C6DFF"
          />
          <StatChip
            icon={<Clock size={10} />}
            label="Hours"
            value={stats.hoursWorked > 0 ? stats.hoursWorked.toFixed(1) : '—'}
            color="#00E5FF"
          />
          <StatChip
            icon={<TrendingUp size={10} />}
            label="Items"
            value={stats.totalItems > 0 ? String(stats.totalItems) : '—'}
            color="#4ADE80"
          />
          <StatChip
            icon={<DollarSign size={10} />}
            label="Revenue"
            value={stats.totalRevenue > 0 ? `€${stats.totalRevenue % 1 === 0 ? stats.totalRevenue : stats.totalRevenue.toFixed(0)}` : '—'}
            color="#FBBF24"
          />
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-1.5">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="h-10 rounded-lg animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
          ))}
        </div>
      )}
    </div>
  );
}

function StatChip({ icon, label, value, color }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-1.5 px-1 rounded-lg gap-0.5"
      style={{ background: 'rgba(14,15,20,0.5)', border: '1px solid rgba(255,255,255,0.05)' }}>
      <span style={{ color }} className="opacity-70">{icon}</span>
      <span className="text-sm font-bold mp-mono" style={{ color }}>{value}</span>
      <span className="text-[9px] text-[#7B7F93] uppercase tracking-wider">{label}</span>
    </div>
  );
}
