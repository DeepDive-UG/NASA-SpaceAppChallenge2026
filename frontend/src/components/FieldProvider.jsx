import { useEffect, useState } from 'react'
import { FieldContext, fieldApi } from '../lib/field'
import { readLegacyProfile } from '../lib/farmProfile'
export default function FieldProvider({ children }) {
  const [record, setRecord] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    fieldApi('field/', { signal: controller.signal }).then(async result => {
      if (controller.signal.aborted) return
      setRecord(result)
      const legacy = !result.field.farm_profile && readLegacyProfile()
      if (legacy) {
        try {
          const migrated = await fieldApi('field/', { method: 'PUT', signal: controller.signal, body: { revision: result.revision, onboarding_profile: legacy } })
          if (!controller.signal.aborted) setRecord(migrated)
        } catch (failure) {
          if (!controller.signal.aborted) setError(`Your saved onboarding profile could not be imported: ${failure.message}`)
        }
      }
    }).catch(failure => { if (!controller.signal.aborted) setError(failure.message) }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [])
  async function persist(values, path = 'field/') {
    setSaving(true); setError('')
    try {
      const result = await fieldApi(path, { method: path === 'field/' ? 'PUT' : 'POST', body: { ...values, revision: record?.revision || 0 } })
      setRecord(result)
      if (result.field.farm_profile) {
        try { localStorage.setItem('farmProfile', JSON.stringify(result.field.farm_profile)) } catch { /* The server record remains authoritative when browser storage is unavailable. */ }
      }
      return result
    } catch (failure) { setError(failure.message); throw failure }
    finally { setSaving(false) }
  }
  return <FieldContext.Provider value={{ record, loading, saving, error, save: field => persist({ field }), saveProfile: profile => persist({ onboarding_profile: profile }), loadExample: () => persist({}, 'field/example/') }}>{children}</FieldContext.Provider>
}
