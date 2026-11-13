'use client'
import { createContext, useContext } from 'react'
export const WorkspaceVisibility = createContext(true)
export function useWorkspaceVisible() { return useContext(WorkspaceVisibility) }
