/**
 * MerchPad Project System
 *
 * Architecture:
 * - Up to 3 LOCAL MerchPad project slots, each a fully isolated workspace
 *   (own products, shows, sessions, stock — stored in localStorage under a
 *   namespaced key; IndexedDB data is scoped by projectId prefix)
 * - Hub Projects: pulled from the user's Moshly Hub dashboard via API.
 *   Currently a PLACEHOLDER — requires Moshly OAuth / API key integration.
 *   See README.md § "Hub Projects Integration" for the full spec.
 *
 * Switching projects reloads the entire app context with the new projectId.
 */

export const MAX_LOCAL_PROJECTS = 3;

export type ProjectSource = 'local' | 'hub';

export interface MerchPadProject {
  id: string;            // UUID for local; hub project ID for hub projects
  name: string;
  description?: string;
  color: string;         // accent color for visual identification
  source: ProjectSource;
  createdAt: string;
  // Hub-only fields (populated when source === 'hub')
  hubId?: string;
  hubSyncedAt?: string;
  hubStatus?: 'connected' | 'disconnected' | 'error';
}

// ── Placeholder Hub Projects ───────────────────────────────────────────────
// These represent what will be returned by the Moshly Hub API once auth
// is implemented. Replace with a real API call — see README.md.

export const HUB_PROJECTS_PLACEHOLDER: MerchPadProject[] = [
  {
    id: 'hub-placeholder-1',
    name: 'Connect Moshly Hub',
    description: 'Link your Moshly Hub account to pull projects here',
    color: '#7B7F93',
    source: 'hub',
    createdAt: new Date().toISOString(),
    hubStatus: 'disconnected',
  },
];

// ── Project colors ─────────────────────────────────────────────────────────

export const PROJECT_COLORS = [
  '#6B5CFF', // Moshly Purple
  '#C026D3', // Moshly Magenta
  '#00E5FF', // Moshly Cyan
  '#4ADE80', // Green
  '#FBBF24', // Amber
  '#F87171', // Red
];

// ── Local storage helpers ──────────────────────────────────────────────────

const PROJECTS_KEY = 'mp_projects';
const ACTIVE_PROJECT_KEY = 'mp_active_project_id';

export function loadLocalProjects(): MerchPadProject[] {
  try {
    const raw = localStorage.getItem(PROJECTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as MerchPadProject[];
  } catch {
    return [];
  }
}

export function saveLocalProjects(projects: MerchPadProject[]): void {
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
}

export function getActiveProjectId(): string | null {
  return localStorage.getItem(ACTIVE_PROJECT_KEY);
}

export function setActiveProjectId(id: string): void {
  localStorage.setItem(ACTIVE_PROJECT_KEY, id);
}

export function getActiveProject(projects: MerchPadProject[]): MerchPadProject | null {
  const id = getActiveProjectId();
  if (!id) return projects[0] ?? null;
  return projects.find(p => p.id === id) ?? projects[0] ?? null;
}

// ── Default project ────────────────────────────────────────────────────────

export function ensureDefaultProject(): MerchPadProject[] {
  const existing = loadLocalProjects();
  if (existing.length > 0) return existing;

  const defaultProject: MerchPadProject = {
    id: 'default',
    name: 'My Merch',
    description: 'Default project',
    color: '#6B5CFF',
    source: 'local',
    createdAt: new Date().toISOString(),
  };

  saveLocalProjects([defaultProject]);
  setActiveProjectId(defaultProject.id);
  return [defaultProject];
}
