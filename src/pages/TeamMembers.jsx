import { useMemo, useState } from 'react';
import {
  Users, Mail, Crown, Shield, BarChart2, Eye, Trash2, Plus, X,
  CheckCircle2, Clock, LockKeyhole, SlidersHorizontal, UserPlus,
  Copy, Link as LinkIcon, KeyRound,
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { useAuth } from '../context/AuthContext';
import { FEATURE_PERMISSIONS, normalizePermissions, roleDisplayName } from '../lib/permissions';

const roleConfig = {
  owner:   { label: 'Admin',     icon: Crown,    color: 'bg-amber-100 text-amber-700 border-amber-200', desc: 'Admin utama dengan akses penuh.' },
  admin:   { label: 'Admin',     icon: Shield,   color: 'bg-violet-100 text-violet-700 border-violet-200', desc: 'Mengelola operasional sesuai fitur yang diizinkan.' },
  analyst: { label: 'Sub Admin', icon: BarChart2, color: 'bg-blue-100 text-blue-700 border-blue-200', desc: 'Membantu operasional dan analisa sesuai fitur.' },
  viewer:  { label: 'Member',    icon: Eye,      color: 'bg-gray-100 text-gray-600 border-gray-200', desc: 'Akses dasar sesuai fitur yang diizinkan.' },
};

const statusConfig = {
  active:    { label: 'Aktif',     icon: CheckCircle2, color: 'text-green-600 bg-green-50' },
  pending:   { label: 'Menunggu',  icon: Clock,        color: 'text-amber-600 bg-amber-50' },
  suspended: { label: 'Suspended', icon: LockKeyhole,  color: 'text-red-500 bg-red-50' },
};

function PermissionToggle({ feature, checked, disabled, onChange }) {
  return (
    <label className={`flex items-start gap-3 rounded-xl border p-3 transition-colors ${
      checked ? 'border-violet-200 bg-violet-50' : 'border-purple-50 bg-white'
    } ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:border-violet-200'}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={e => onChange(feature.key, e.target.checked)}
        className="mt-0.5 accent-violet-500"
      />
      <div className="min-w-0">
        <p className="text-xs font-semibold text-gray-700">{feature.label}</p>
        <p className="text-[10px] text-gray-400 leading-tight mt-0.5">{feature.desc}</p>
      </div>
    </label>
  );
}

function RoleBadge({ role }) {
  const cfg = roleConfig[role] || roleConfig.viewer;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${cfg.color}`}>
      <Icon size={11} /> {cfg.label}
    </span>
  );
}

function StatusBadge({ status }) {
  const cfg = statusConfig[status] || statusConfig.active;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${cfg.color}`}>
      <Icon size={11} /> {cfg.label}
    </span>
  );
}

function InviteModal({ onClose, onInvite }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('viewer');
  const [permissions, setPermissions] = useState(() => normalizePermissions('viewer'));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [inviteResult, setInviteResult] = useState(null);
  const [copied, setCopied] = useState('');

  const setRolePreset = (nextRole) => {
    setRole(nextRole);
    setPermissions(normalizePermissions(nextRole));
  };

  const setPermission = (key, value) => {
    setPermissions(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) { setError('Email wajib diisi.'); return; }
    setLoading(true);
    setError('');
    const { data, error: err } = await onInvite({ email: email.trim(), role, permissions });
    setLoading(false);
    if (err) { setError(err.message || 'Gagal mengundang anggota.'); return; }
    const origin = window.location.origin;
    setInviteResult({
      email: data.email || email.trim(),
      otp: data.invite_otp,
      link: `${origin}/join-workspace?token=${encodeURIComponent(data.invite_token)}`,
    });
  };

  const copyValue = async (label, value) => {
    await navigator.clipboard?.writeText(value);
    setCopied(label);
    setTimeout(() => setCopied(''), 1600);
  };

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-purple-100 w-full max-w-3xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-purple-50">
          <div>
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <UserPlus size={17} className="text-violet-500" /> Undang Anggota
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">Pilih role awal dan fitur yang boleh digunakan.</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-gray-100">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        {inviteResult ? (
          <div className="p-5 space-y-5">
            <div className="rounded-2xl border border-green-100 bg-green-50 p-4">
              <p className="text-sm font-bold text-green-700">Undangan siap dibagikan</p>
              <p className="text-xs text-green-600 mt-1">
                Bagikan link dan OTP ini ke {inviteResult.email}. User akan set password setelah OTP cocok.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1.5">Link Undangan</label>
                <div className="flex gap-2">
                  <div className="flex-1 min-w-0 flex items-center gap-2 px-3 py-2.5 rounded-xl border border-purple-100 bg-lavender-50">
                    <LinkIcon size={14} className="text-violet-500 flex-shrink-0" />
                    <p className="text-xs text-gray-600 truncate">{inviteResult.link}</p>
                  </div>
                  <button type="button" onClick={() => copyValue('link', inviteResult.link)}
                    className="px-3 py-2.5 rounded-xl border border-purple-100 text-violet-600 hover:bg-violet-50">
                    <Copy size={14} />
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1.5">Kode OTP</label>
                <div className="flex gap-2">
                  <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-purple-100 bg-white">
                    <KeyRound size={15} className="text-violet-500" />
                    <p className="text-lg font-bold tracking-[0.25em] text-gray-800">{inviteResult.otp}</p>
                  </div>
                  <button type="button" onClick={() => copyValue('otp', inviteResult.otp)}
                    className="px-3 py-2.5 rounded-xl border border-purple-100 text-violet-600 hover:bg-violet-50">
                    <Copy size={14} />
                  </button>
                </div>
              </div>

              {copied && (
                <p className="text-xs text-green-600 font-medium">
                  {copied === 'link' ? 'Link' : 'OTP'} berhasil disalin.
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-purple-100 text-sm font-medium text-gray-500 hover:bg-gray-50">
                Tutup
              </button>
              <button type="button" onClick={() => {
                setInviteResult(null);
                setEmail('');
                setRolePreset('viewer');
              }} className="purple-btn py-2.5 text-sm">
                Undang Lagi
              </button>
            </div>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto max-h-[calc(90vh-73px)] space-y-5">
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="rekan@email.com"
              className="w-full px-4 py-2.5 rounded-xl border border-purple-100 text-sm focus:outline-none focus:border-violet-400 transition-all"
            />
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-600 mb-2">Role</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {['admin', 'analyst', 'viewer'].map((roleKey) => {
                const cfg = roleConfig[roleKey];
                const Icon = cfg.icon;
                return (
                  <button
                    key={roleKey}
                    type="button"
                    onClick={() => setRolePreset(roleKey)}
                    className={`text-left flex items-start gap-3 p-3 rounded-xl border transition-all ${
                      role === roleKey ? 'border-violet-300 bg-violet-50' : 'border-gray-100 hover:border-violet-200'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center border flex-shrink-0 ${cfg.color}`}>
                      <Icon size={14} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-700">{cfg.label}</p>
                      <p className="text-[10px] text-gray-400 leading-tight mt-0.5">{cfg.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3 mb-2">
              <p className="text-xs font-semibold text-gray-600">Akses Fitur</p>
              <span className="text-[10px] text-gray-400">{Object.values(permissions).filter(Boolean).length} fitur aktif</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {FEATURE_PERMISSIONS.map(feature => (
                <PermissionToggle
                  key={feature.key}
                  feature={feature}
                  checked={permissions[feature.key] === true}
                  onChange={setPermission}
                />
              ))}
            </div>
          </div>

          <div className="rounded-xl bg-amber-50 border border-amber-100 p-3 flex gap-2">
            <LockKeyhole size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 leading-relaxed">
              Setelah undangan dibuat, sistem akan menampilkan link dan OTP acak. User membuka link, memasukkan OTP, lalu set password sendiri.
            </p>
          </div>

          {error && <p className="text-red-500 text-xs bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-purple-100 text-sm font-medium text-gray-500 hover:bg-gray-50">
              Batal
            </button>
            <button type="submit" disabled={loading}
              className="purple-btn py-2.5 text-sm disabled:opacity-70">
              {loading ? 'Mengirim...' : 'Kirim Undangan'}
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
}

export default function TeamMembers() {
  const { user } = useAuth();
  const {
    members,
    activeWorkspace,
    inviteMember,
    removeMember,
    updateMemberRole,
    updateMemberPermissions,
    isPrimaryAdmin,
  } = useWorkspace();
  const [showInvite, setShowInvite] = useState(false);
  const [expandedMember, setExpandedMember] = useState(null);
  const [savingMember, setSavingMember] = useState(null);

  const demoMembers = useMemo(() => [
    {
      id: '1',
      user_id: user?.id || 'demo',
      email: 'hello@nayacreative.id',
      role: 'owner',
      status: 'active',
      permissions: normalizePermissions('owner'),
      profiles: { full_name: 'Naya Creative (Kamu)', avatar_url: null },
    },
    {
      id: '2',
      email: 'rania@nayacreative.id',
      role: 'admin',
      status: 'active',
      permissions: normalizePermissions('admin'),
      profiles: { full_name: 'Rania Putri', avatar_url: null },
    },
    {
      id: '3',
      email: 'dimas@nayacreative.id',
      role: 'analyst',
      status: 'active',
      permissions: normalizePermissions('analyst'),
      profiles: { full_name: 'Dimas Santoso', avatar_url: null },
    },
    {
      id: '4',
      email: 'client@brand.id',
      role: 'viewer',
      status: 'pending',
      permissions: normalizePermissions('viewer'),
      profiles: { full_name: null, avatar_url: null },
    },
  ], [user?.id]);

  const displayMembers = members.length ? members : demoMembers;
  const activeCount = displayMembers.filter(m => m.status === 'active').length;
  const pendingCount = displayMembers.filter(m => m.status === 'pending').length;

  const updateRole = async (memberId, role) => {
    setSavingMember(memberId);
    await updateMemberRole(memberId, role);
    setSavingMember(null);
  };

  const updatePermission = async (member, key, value) => {
    const nextPermissions = {
      ...normalizePermissions(member.role, member.permissions),
      [key]: value,
    };
    setSavingMember(member.id);
    await updateMemberPermissions(member.id, nextPermissions);
    setSavingMember(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <p className="text-sm text-gray-500">{displayMembers.length} anggota · Workspace: {activeWorkspace?.name}</p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="text-xs px-2.5 py-1 rounded-full bg-green-50 text-green-600 font-medium">{activeCount} aktif</span>
            <span className="text-xs px-2.5 py-1 rounded-full bg-amber-50 text-amber-600 font-medium">{pendingCount} menunggu</span>
            <span className="text-xs px-2.5 py-1 rounded-full bg-violet-50 text-violet-600 font-medium">Admin utama: akses penuh</span>
          </div>
        </div>
        {isPrimaryAdmin && (
          <button onClick={() => setShowInvite(true)} className="purple-btn flex items-center gap-2 text-sm">
            <Plus size={15} /> Undang Anggota
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-purple-50 shadow-card p-5">
          <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center mb-4">
            <SlidersHorizontal size={18} />
          </div>
          <p className="text-sm font-bold text-gray-800">Akses Per Fitur</p>
          <p className="text-xs text-gray-400 mt-1 leading-relaxed">
            Setiap anggota bisa diberi akses spesifik ke dashboard, konten, competitor intel, analyser, reports, dan fitur lainnya.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-purple-50 shadow-card p-5">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
            <LockKeyhole size={18} />
          </div>
          <p className="text-sm font-bold text-gray-800">Login Akun Sosial</p>
          <p className="text-xs text-gray-400 mt-1 leading-relaxed">
            Tombol masuk Instagram, TikTok, Threads, disconnect, dan pengaturan workspace dikunci untuk admin utama.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-purple-50 shadow-card p-5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
            <Mail size={18} />
          </div>
          <p className="text-sm font-bold text-gray-800">Undangan Workspace</p>
          <p className="text-xs text-gray-400 mt-1 leading-relaxed">
            Undangan disimpan sebagai status menunggu. Saat user menerima undangan, ia masuk workspace dengan permission yang sudah ditentukan.
          </p>
        </div>
      </div>

      {!isPrimaryAdmin && (
        <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 flex items-start gap-2">
          <LockKeyhole size={15} className="text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-700 leading-relaxed">
            Kamu bisa melihat anggota, tetapi hanya admin utama yang bisa mengundang, mengubah role, dan mengubah akses fitur.
          </p>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-purple-50 shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-purple-50 flex items-center justify-between gap-3">
          <h3 className="font-semibold text-gray-800 text-sm flex items-center gap-2">
            <Users size={15} className="text-violet-500" /> Daftar Anggota
          </h3>
          <span className="text-xs text-gray-400">{activeWorkspace?.role === 'owner' ? 'Admin utama' : roleDisplayName(activeWorkspace?.role)}</span>
        </div>

        <div className="divide-y divide-purple-50">
          {displayMembers.map((member) => {
            const permissions = normalizePermissions(member.role, member.permissions);
            const name = member.profiles?.full_name || member.email?.split('@')[0] || 'Anggota';
            const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
            const enabledFeatures = FEATURE_PERMISSIONS.filter(feature => permissions[feature.key]);
            const isOwner = member.role === 'owner';
            const canEditMember = isPrimaryAdmin && !isOwner;
            const isExpanded = expandedMember === member.id;

            return (
              <div key={member.id} className="p-4 lg:p-5">
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-200 to-purple-200 flex items-center justify-center text-violet-700 font-bold text-sm flex-shrink-0">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">
                        {name}{member.user_id === user?.id ? ' (Kamu)' : ''}
                      </p>
                      <p className="text-xs text-gray-400 truncate flex items-center gap-1">
                        <Mail size={10} /> {member.email || 'Belum ada email'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusBadge status={member.status} />
                    <RoleBadge role={member.role} />
                  </div>

                  <div className="flex items-center gap-2 lg:justify-end">
                    {canEditMember && (
                      <select
                        value={member.role}
                        onChange={(e) => updateRole(member.id, e.target.value)}
                        disabled={savingMember === member.id}
                        className="text-xs border border-purple-100 rounded-lg px-2 py-1.5 focus:outline-none focus:border-violet-400"
                      >
                        {['admin', 'analyst', 'viewer'].map(roleKey => (
                          <option key={roleKey} value={roleKey}>{roleConfig[roleKey].label}</option>
                        ))}
                      </select>
                    )}
                    <button
                      onClick={() => setExpandedMember(isExpanded ? null : member.id)}
                      className="px-3 py-1.5 rounded-lg border border-purple-100 text-xs font-semibold text-violet-600 hover:bg-violet-50"
                    >
                      {isExpanded ? 'Tutup Akses' : 'Atur Akses'}
                    </button>
                    {canEditMember && (
                      <button onClick={() => removeMember(member.id)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {enabledFeatures.slice(0, 6).map(feature => (
                    <span key={feature.key} className="text-[10px] px-2 py-1 rounded-full bg-lavender-50 text-gray-500 font-medium">
                      {feature.label}
                    </span>
                  ))}
                  {enabledFeatures.length > 6 && (
                    <span className="text-[10px] px-2 py-1 rounded-full bg-lavender-50 text-gray-400 font-medium">
                      +{enabledFeatures.length - 6} fitur
                    </span>
                  )}
                </div>

                {isExpanded && (
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                    {FEATURE_PERMISSIONS.map(feature => (
                      <PermissionToggle
                        key={feature.key}
                        feature={feature}
                        checked={permissions[feature.key] === true}
                        disabled={!canEditMember || savingMember === member.id}
                        onChange={(key, value) => updatePermission(member, key, value)}
                      />
                    ))}
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
