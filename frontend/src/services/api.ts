const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  })

  const payload = await response.json()
  if (!response.ok) {
    throw new Error(payload.message ?? 'Erro na requisicao')
  }

  return payload.data as T
}

export const api = {
  get: <T>(path: string, token?: string) =>
    request<T>(path, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    }),
  post: <T>(path: string, body: unknown, token?: string) =>
    request<T>(path, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    }),
  put: <T>(path: string, body: unknown, token?: string) =>
    request<T>(path, {
      method: 'PUT',
      body: JSON.stringify(body),
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    }),
  delete: <T>(path: string, token?: string) =>
    request<T>(path, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    }),
  upload: async (path: string, file: File, token?: string): Promise<string> => {
    const formData = new FormData()
    formData.append('file', file)
    const response = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: formData,
    })
    const payload = await response.json()
    if (!response.ok) {
      throw new Error(payload.message ?? 'Erro no upload')
    }
    return payload.data.url as string
  },
}
