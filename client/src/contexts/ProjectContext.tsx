/**
 * ProjectContext — manages the active MerchPad project slot
 * Separate from MerchPadContext so project switching can trigger a full
 * context reload without circular dependencies.
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  MerchPadProject,
  loadLocalProjects,
  saveLocalProjects,
  getActiveProjectId,
  setActiveProjectId,
  ensureDefaultProject,
  HUB_PROJECTS_PLACEHOLDER,
  MAX_LOCAL_PROJECTS,
  PROJECT_COLORS,
} from '../lib/projects';

interface ProjectContextValue {
  localProjects: MerchPadProject[];
  hubProjects: MerchPadProject[];
  activeProject: MerchPadProject | null;
  setActiveProject: (project: MerchPadProject) => void;
  createLocalProject: (name: string, description?: string, color?: string) => MerchPadProject | null;
  updateLocalProject: (project: MerchPadProject) => void;
  deleteLocalProject: (id: string) => void;
  canCreateMore: boolean;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function useProjects(): ProjectContextValue {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProjects must be used within ProjectProvider');
  return ctx;
}

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [localProjects, setLocalProjects] = useState<MerchPadProject[]>(() => ensureDefaultProject());
  const [activeProjectId, setActiveProjectIdState] = useState<string>(() => {
    const id = getActiveProjectId();
    const projects = ensureDefaultProject();
    return id ?? projects[0]?.id ?? 'default';
  });

  // Hub projects — placeholder until OAuth is wired
  const hubProjects = HUB_PROJECTS_PLACEHOLDER;

  const activeProject = localProjects.find(p => p.id === activeProjectId)
    ?? hubProjects.find(p => p.id === activeProjectId)
    ?? localProjects[0]
    ?? null;

  const setActiveProject = useCallback((project: MerchPadProject) => {
    setActiveProjectId(project.id);
    setActiveProjectIdState(project.id);
  }, []);

  const createLocalProject = useCallback((name: string, description?: string, color?: string): MerchPadProject | null => {
    const current = loadLocalProjects().filter(p => p.source === 'local');
    if (current.length >= MAX_LOCAL_PROJECTS) return null;

    const project: MerchPadProject = {
      id: uuidv4(),
      name,
      description,
      color: color ?? PROJECT_COLORS[current.length % PROJECT_COLORS.length],
      source: 'local',
      createdAt: new Date().toISOString(),
    };

    const updated = [...current, project];
    saveLocalProjects(updated);
    setLocalProjects(updated);
    return project;
  }, []);

  const updateLocalProject = useCallback((project: MerchPadProject) => {
    const updated = localProjects.map(p => p.id === project.id ? project : p);
    saveLocalProjects(updated);
    setLocalProjects(updated);
  }, [localProjects]);

  const deleteLocalProject = useCallback((id: string) => {
    // Cannot delete the last local project
    if (localProjects.filter(p => p.source === 'local').length <= 1) return;
    const updated = localProjects.filter(p => p.id !== id);
    saveLocalProjects(updated);
    setLocalProjects(updated);
    // If deleted project was active, switch to first available
    if (activeProjectId === id) {
      const next = updated[0];
      if (next) {
        setActiveProjectId(next.id);
        setActiveProjectIdState(next.id);
      }
    }
  }, [localProjects, activeProjectId]);

  const canCreateMore = localProjects.filter(p => p.source === 'local').length < MAX_LOCAL_PROJECTS;

  return (
    <ProjectContext.Provider value={{
      localProjects,
      hubProjects,
      activeProject,
      setActiveProject,
      createLocalProject,
      updateLocalProject,
      deleteLocalProject,
      canCreateMore,
    }}>
      {children}
    </ProjectContext.Provider>
  );
}
