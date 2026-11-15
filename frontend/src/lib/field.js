import { createContext, useContext } from 'react'
export const FieldContext = createContext(null)
export function useField() { return useContext(FieldContext) }
export async function fieldApi(path, { method = 'GET', body, signal } = {}) {
  if (method !== 'GET') await fetch('/api/health/', { signal })
  const csrf = document.cookie.split('; ').find(part => part.startsWith('csrftoken='))?.split('=')[1] || ''
  const response = await fetch(`/api/${path}`, { method, signal, headers: { 'Content-Type': 'application/json', ...(method !== 'GET' ? { 'X-CSRFToken': csrf } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) })
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('The field service is unavailable. Please try again.')
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Your request could not be completed.')
  return result
}
export const SOILS = [['unknown', 'Not known yet'], ['sand', 'Sand'], ['sandy_loam', 'Sandy loam'], ['loam', 'Loam'], ['silt_loam', 'Silt loam'], ['clay_loam', 'Clay loam'], ['clay', 'Clay']]
export const GOALS = [['profit', 'Earn more', 'Compare market prices.'], ['soil', 'Improve soil health', 'Rotate crop families.'], ['water', 'Use water carefully', 'Review water needs.'], ['harvest', 'Focus on harvest', 'Check growing conditions.'], ['diversity', 'Diversify the rotation', 'Vary crops across the field.']]
