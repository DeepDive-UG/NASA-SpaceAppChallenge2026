import { useEffect, useState } from 'react'
import { FieldContext, fieldApi } from '../lib/field'
export default function FieldProvider({ children }) {
  const [record, setRecord] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    fieldApi('field/', { signal: controller.signal }).then(result => { if (!controller.signal.aborted) setRecord(result) }).catch(failure => { if (!controller.signal.aborted) setError(failure.message) }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [])
  async function save(field) {
    setSaving(true); setError('')
    try {
      const result = await fieldApi('field/', { method: 'PUT', body: { field, revision: record?.revision || 0 } })
      setRecord(result)
      return result
    } catch (failure) { setError(failure.message); throw failure }
    finally { setSaving(false) }
  }
  return <FieldContext.Provider value={{ record, loading, saving, error, save }}>{children}</FieldContext.Provider>
}
