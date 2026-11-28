'use client'

import { useManagerSession } from '@/components/internal/ManagerSession'

/** Scheduler adapters share the internal memory-only manager session. */
export function useManagerCode() { return useManagerSession().token }
