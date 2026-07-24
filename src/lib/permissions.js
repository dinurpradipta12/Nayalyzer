export const FEATURE_PERMISSIONS = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    desc: 'Melihat ringkasan performa workspace.',
  },
  {
    key: 'analytics',
    label: 'Account Analytics',
    desc: 'Melihat analytics akun sosial.',
  },
  {
    key: 'content',
    label: 'Content Performance',
    desc: 'Melihat dan mengelola performa konten.',
  },
  {
    key: 'competitors',
    label: 'Competitor Analysis',
    desc: 'Mengakses analisis kompetitor dasar.',
  },
  {
    key: 'competitor_intelligence',
    label: 'Competitor Intel',
    desc: 'Mengakses riset dan AI kompetitor.',
  },
  {
    key: 'analyser',
    label: 'Analyser',
    desc: 'Menganalisis profil publik.',
  },
  {
    key: 'hypothesis',
    label: 'AI Hypothesis',
    desc: 'Melihat dan membuat hipotesis AI.',
  },
  {
    key: 'reports',
    label: 'Reports',
    desc: 'Melihat dan membuat laporan.',
  },
  {
    key: 'data_sources',
    label: 'Data Sources',
    desc: 'Import data manual dari CSV atau Sheets.',
  },
  {
    key: 'team',
    label: 'Team Members',
    desc: 'Melihat anggota dan undangan workspace.',
  },
  {
    key: 'settings',
    label: 'Settings',
    desc: 'Mengubah konfigurasi workspace.',
  },
];

export const FEATURE_BY_ROUTE = {
  '/dashboard': 'dashboard',
  '/analytics': 'analytics',
  '/content': 'content',
  '/competitors': 'competitors',
  '/competitor-intelligence': 'competitor_intelligence',
  '/analyser': 'analyser',
  '/hypothesis': 'hypothesis',
  '/reports': 'reports',
  '/connected-accounts': 'settings',
  '/data-sources': 'data_sources',
  '/team': 'team',
  '/settings': 'settings',
};

export const DEFAULT_ROLE_PERMISSIONS = {
  owner: Object.fromEntries(FEATURE_PERMISSIONS.map(feature => [feature.key, true])),
  admin: Object.fromEntries(FEATURE_PERMISSIONS.map(feature => [
    feature.key,
    !['settings'].includes(feature.key),
  ])),
  analyst: {
    dashboard: true,
    analytics: true,
    content: true,
    competitors: true,
    competitor_intelligence: true,
    analyser: true,
    hypothesis: true,
    reports: true,
    data_sources: false,
    team: false,
    settings: false,
  },
  viewer: {
    dashboard: true,
    analytics: true,
    content: true,
    competitors: false,
    competitor_intelligence: false,
    analyser: false,
    hypothesis: false,
    reports: true,
    data_sources: false,
    team: false,
    settings: false,
  },
};

export function normalizePermissions(role = 'viewer', permissions = null) {
  const defaults = DEFAULT_ROLE_PERMISSIONS[role] || DEFAULT_ROLE_PERMISSIONS.viewer;
  if (role === 'owner') return { ...DEFAULT_ROLE_PERMISSIONS.owner };
  return { ...defaults, ...(permissions || {}) };
}

export function hasFeaturePermission(workspace, featureKey) {
  if (!featureKey) return true;
  if (!workspace) return false;
  if (workspace.role === 'owner') return true;
  const permissions = normalizePermissions(workspace.role, workspace.permissions);
  return permissions[featureKey] === true;
}

export function roleDisplayName(role = 'viewer') {
  if (role === 'analyst') return 'Sub Admin';
  if (role === 'viewer') return 'Member';
  if (role === 'owner' || role === 'admin') return 'Admin';
  return 'Member';
}
