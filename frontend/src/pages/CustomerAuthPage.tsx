import type { FormEvent } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '../components/Button'
import { InputField } from '../components/Field'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../services/api'

export function CustomerAuthPage({ mode }: { mode: 'login' | 'register' }) {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    setLoading(true)
    setError('')

    try {
      const path = mode === 'login' ? '/auth/customer/login' : '/auth/customer/register'
      const password = String(formData.get('password'))
      const confirmPassword = String(formData.get('confirmPassword') || '')

      if (mode === 'register' && password !== confirmPassword) {
        throw new Error('As senhas nao coincidem.')
      }

      const payload =
        mode === 'login'
          ? {
              email: String(formData.get('email')),
              password,
            }
          : {
              name: String(formData.get('name')),
              email: String(formData.get('email')),
              phone: String(formData.get('phone')),
              cpf: String(formData.get('cpf') || ''),
              password,
            }

      const response = await api.post<{ token: string }>(path, payload)
      login(response.token, 'customer')
      navigate('/conta')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro na autenticacao')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="mx-auto max-w-5xl">
      <div className="surface-panel grid overflow-hidden lg:grid-cols-[0.92fr_1.08fr]">
        <div className="bg-[#171412] px-6 py-10 text-[#fafaf8] sm:px-8">
          <p className="text-xs font-bold uppercase tracking-[0.34em] text-[#f6dba5]">Experiencia premium</p>
          <h1 className="mt-4 text-5xl leading-none">
            {mode === 'login' ? 'Acesse sua conta' : 'Crie seu cadastro'}
          </h1>
          <p className="mt-4 max-w-md text-sm leading-7 text-[#d9d0c4]">
            Seu perfil de cliente centraliza pedidos, enderecos e checkout mais rapido sem misturar com o painel administrativo.
          </p>
        </div>

        <div className="px-6 py-10 sm:px-8">
          <form className="space-y-4" onSubmit={handleSubmit}>
            {mode === 'register' ? (
              <>
                <InputField name="name" required label="Nome completo" placeholder="Seu nome" />
                <InputField name="phone" required label="Telefone" placeholder="(67) 99999-9999" />
                <InputField name="cpf" label="CPF" placeholder="Opcional" />
              </>
            ) : null}
            <InputField name="email" required type="email" label="E-mail" placeholder="voce@exemplo.com" />
            <PasswordField
              name="password"
              required
              label="Senha"
              placeholder="Digite sua senha"
              visible={showPassword}
              onToggleVisibility={() => setShowPassword((current) => !current)}
            />
            {mode === 'register' ? (
              <PasswordField
                name="confirmPassword"
                required
                label="Confirmar senha"
                placeholder="Repita sua senha"
                visible={showConfirmPassword}
                onToggleVisibility={() => setShowConfirmPassword((current) => !current)}
              />
            ) : null}
            <Button type="submit" fullWidth size="lg" disabled={loading}>
              {loading ? 'Processando...' : mode === 'login' ? 'Entrar como cliente' : 'Criar conta'}
            </Button>
            {error ? <p className="rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
          </form>

          <p className="mt-5 text-sm text-[#6b665f]">
            {mode === 'login' ? 'Ainda nao tem cadastro?' : 'Ja possui cadastro?'}{' '}
            <Link to={mode === 'login' ? '/cadastro' : '/login'} className="font-semibold text-[#b77717]">
              {mode === 'login' ? 'Criar conta' : 'Entrar'}
            </Link>
          </p>
        </div>
      </div>
    </section>
  )
}

function PasswordField({
  label,
  name,
  placeholder,
  required = false,
  visible,
  onToggleVisibility,
}: {
  label: string
  name: string
  placeholder: string
  required?: boolean
  visible: boolean
  onToggleVisibility: () => void
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-[#6b665f]">{label}</span>
      <div className="relative">
        <input
          name={name}
          required={required}
          type={visible ? 'text' : 'password'}
          placeholder={placeholder}
          className="field-base pr-12"
        />
        <button
          type="button"
          aria-label={visible ? 'Ocultar senha' : 'Visualizar senha'}
          onClick={onToggleVisibility}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-2 text-[#6b665f]"
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </label>
  )
}
