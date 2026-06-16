/* eslint-disable react-refresh/only-export-components */
import type { ReactNode } from 'react'
import { createContext, useContext, useMemo, useState } from 'react'

type AuthScope = 'customer' | 'admin'

type AuthState = {
  token: string | null
  scope: AuthScope | null
}

type AuthContextValue = AuthState & {
  login: (token: string, scope: AuthScope) => void
  logout: () => void
}

const STORAGE_KEY = 'onperfumaria-auth'
const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : { token: null, scope: null }
  })

  const value = useMemo(
    () => ({
      ...state,
      login: (token: string, scope: AuthScope) => {
        const next = { token, scope }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
        setState(next)
      },
      logout: () => {
        localStorage.removeItem(STORAGE_KEY)
        setState({ token: null, scope: null })
      },
    }),
    [state],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider')
  }
  return context
}
