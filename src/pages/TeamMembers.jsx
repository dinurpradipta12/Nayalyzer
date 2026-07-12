import { useState } from 'react';
import { Users, Mail, Crown, Shield, BarChart2, Eye, Trash2, Plus, X, CheckCircle2, Clock } from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { useAuth } from '../context/AuthContext';

const roleConfig = {
  owner:   { label: 'Owner',   icon: Crown,    color: 'bg-amber-100 text-amber-700 border-amber-200', desc: 'Akses penuh + kelola workspace' },
  admin:   { label: 'Admin',   icon: Shield,   color: 'bg-violet-100 text-violet-700 border-violet-200', desc: 'Kelola konten, kompetitor, laporan' },
  analyst: { label: 'Analyst', icon: BarChart2, color: 'bg-blue-100 text-blue-700 border-blue-200', desc: 'Buat analisa & hipotesa' },
  viewer:  { label: 'Viewer',  icon: Eye,      color: 'bg-gray-100 text-gray-600 border-gray-200', desc: 'Hanya bisa membaca data' },
};

const statusConfig = {
  active:  { label: 'Aktif',   icon: CheckCircle2, color: 'text-green-600 bg-green-50' },
  pending: { label: 'Menunggu', icon: Clock,       color: 'text-amber-600 bg-amber-50' },
};

function InviteModal({ onClose, onInvite }) {
  const [email, setEmail] = useState('');
  const [role, setRole]   = useState('viewer');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) { setError('Email wajib diisi.'); return; }
    setLoading(true);
    const { error: err } = await onInvite({ email, role });
    setLoading(false);
    if (err) { setError(err.message || 'Gagal mengundang anggota.'); return; }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl border border-purple-100 p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-gray-800">Undang Anggota Tim</h3>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-gray-100"><X size={18} className="text-gray-500" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1.5">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="rekan@email.com"
              className="w-full px-4 py-2.5 rounded-xl border border-purple-100 text-sm focus:outline-none focus:border-violet-400 transition-all" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-2">Role</label>
            <div className="space-y-2">
              {Object.entries(roleConfig).filter(([r]) => r !== 'owner').map(([r, cfg]) => {
                const Icon = cfg.icon;
                return (
                  <label key={r} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${role === r ? 'border-violet-300 bg-violet-50' : 'border-gray-100 hover:border-violet-200'}`}>
                    <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} className="accent-violet-500" />
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center border ${cfg.color}`}>
                      <Icon size={13} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-700">{cfg.label}</p>
                      <p className="text-[10px] text-gray-400">{cfg.desc}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
          {error && <p className="text-red-500 text-xs bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-purple-100 text-sm font-medium text-gray-500 hover:bg-gray-50">Batal</button>
            <button type="submit" disabled={loading} className="flex-1 purple-btn py-2.5 text-sm disabled:opacity-70">
              {loading ? 'Mengirim...' : 'Kirim Undangan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function TeamMembers() {
  const { user } = useAuth();
  const { members, activeWorkspace, inviteMember, removeMember, updateMemberRole, hasRole } = useWorkspace();
  const [showInvite, setShowInvite] = useState(false);

  const canManage = hasRole('admin');

  const demoMembers = [
    { id: '1', email: 'hello@nayacreative.id', role: 'owner',   status: 'active',  profiles: { full_name: 'Naya Creative (Kamu)', avatar_url: null } },
    { id: '2', email: 'rania@nayacreative.id', role: 'admin',   status: 'active',  profiles: { full_name: 'Rania Putri', avatar_url: null } },
    { id: '3', email: 'dimas@nayacreative.id', role: 'analyst', status: 'active',  profiles: { full_name: 'Dimas Santoso', avatar_url: null } },
    { id: '4', email: 'client@brand.id',        role: 'viewer',  status: 'pending', profiles: { full_name: null, avatar_url: null } },
  ];

  const displayMembers = members.length ? members : demoMembers;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <p className="text-sm text-gray-500">{displayMembers.length} anggota · Workspace: {activeWorkspace?.name}</p>
        </div>
        {canManage && (
          <button onClick={() => setShowInvite(true)} className="purple-btn flex items-center gap-2 text-sm">
            <Plus size={15} /> Undang Anggota
          </button>
        )}
      </div>

      {/* Role legend */}
      <div className="bg-white rounded-2xl border border-purple-50 shadow-card p-4">
        <p className="text-xs font-semibold text-gray-500 mb-3">Hierarki Role</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.entries(roleConfig).map(([r, cfg]) => {
            const Icon = cfg.icon;
            return (
              <div key={r} className="flex items-start gap-2.5 p-2.5 bg-lavender-50 rounded-xl">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center border flex-shrink-0 ${cfg.color}`}>
                  <Icon size={13} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-700">{cfg.label}</p>
                  <p className="text-[10px] text-gray-400 leading-tight mt-0.5">{cfg.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Member list */}
      <div className="bg-white rounded-2xl border border-purple-50 shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-purple-50">
          <h3 className="font-semibold text-gray-800 text-sm flex items-center gap-2">
            <Users size={15} className="text-violet-500" /> Daftar Anggota
          </h3>
        </div>
        <div className="divide-y divide-purple-50">
          {displayMembers.map((m) => {
            const roleCfg = roleConfig[m.role] || roleConfig.viewer;
            const statusCfg = statusConfig[m.status] || statusConfig.active;
            const RoleIcon = roleCfg.icon;
            const StatusIcon = statusCfg.icon;
            const name = m.profiles?.full_name || m.email?.split('@')[0] || 'Anggota';
            const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

            return (
              <div key={m.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-lavender-50 transition-colors">
                {/* Avatar */}
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-200 to-purple-200 flex items-center justify-center text-violet-700 font-bold text-sm flex-shrink-0">
                  {initials}
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{name}</p>
                  <p className="text-xs text-gray-400 truncate flex items-center gap-1">
                    <Mail size={10} /> {m.email}
                  </p>
                </div>
                {/* Status */}
                <div className={`hidden sm:flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${statusCfg.color}`}>
                  <StatusIcon size={11} /> {statusCfg.label}
                </div>
                {/* Role */}
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${roleCfg.color}`}>
                  <RoleIcon size={11} /> {roleCfg.label}
                </div>
                {/* Actions */}
                {canManage && m.role !== 'owner' && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <select
                      value={m.role}
                      onChange={(e) => updateMemberRole(m.id, e.target.value)}
                      className="text-xs border border-purple-100 rounded-lg px-2 py-1 focus:outline-none focus:border-violet-400 hidden sm:block"
                    >
                      {['admin','analyst','viewer'].map(r => (
                        <option key={r} value={r}>{roleConfig[r].label}</option>
                      ))}
                    </select>
                    <button onClick={() => removeMember(m.id)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {showInvite && (
        <InviteModal onClose={() => setShowInvite(false)} onInvite={inviteMember} />
      )}
    </div>
  );
}
