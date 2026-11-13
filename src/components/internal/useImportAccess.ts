'use client'
import { useCallback } from 'react'
import { ImportApiError } from '@/lib/converter/import-api'
import { useManagerSession } from './ManagerSession'
export function useImportAccess() {
  const { expire } = useManagerSession()
  return useCallback((error: unknown) => {
    if (error instanceof ImportApiError && error.code === 'unauthorized') expire()
    return `importApi.${error instanceof ImportApiError ? error.code : 'unavailable'}`
  }, [expire])
}
