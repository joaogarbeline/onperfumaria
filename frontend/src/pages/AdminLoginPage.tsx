import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/Button'
import { InputField } from '../components/Field'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../services/api'

export function AdminLoginPage() {
  const navigate = useNavigate()
  const { login, token, scope } = useAuth()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (token && scope === 'admin') {
      navigate('/admin', { replace: true })
    }
  }, [token, scope, navigate])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    setLoading(true)
    setError('')
    try {
      const response = await api.post<{ token: string }>('/auth/admin/login', {
        email: String(formData.get('email')),
        password: String(formData.get('password')),
      })
      login(response.token, 'admin')
      navigate('/admin', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro no login administrativo')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="mx-auto max-w-4xl">
      <div className="surface-panel grid overflow-hidden lg:grid-cols-[0.88fr_1.12fr]">
        <div className="bg-[#171412] px-6 py-10 text-[#fafaf8] sm:px-8">
          <p className="text-xs font-bold uppercase tracking-[0.34em] text-[#f6dba5]">Painel privado</p>
          <h1 className="mt-4 text-5xl leading-none">Login administrativo</h1>
          <p className="mt-4 max-w-md text-sm leading-7 text-[#d9d0c4]">
            Acesso restrito ao painel operacional, cadastro de produtos, pedidos, clientes e PDV.
          </p>
        </div>

        <div className="px-6 py-10 sm:px-8">
          <form className="space-y-4" onSubmit={handleSubmit}>
            <InputField name="email" type="email" label="E-mail" placeholder="admin@onperfumaria.com" required />
            <InputField name="password" type="password" label="Senha" placeholder="Digite sua senha" required />
            <Button type="submit" fullWidth size="lg" disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar no painel'}
            </Button>
            {error ? <p className="rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
          </form>
        </div>
      </div>
    </section>
  )
}
