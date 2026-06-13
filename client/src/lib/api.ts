const BASE = '/api';

async function request<T = any>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  login: (username: string, password: string) =>
    request<{ id: number; username: string; displayName: string }>('/auth/login', {
      method: 'POST', body: JSON.stringify({ username, password }),
    }),

  subjects: {
    list: () => request<any[]>('/subjects'),
    get: (id: number) => request<any>(`/subjects/${id}`),
  },

  chapters: {
    list: (subjectId: number) => request<any[]>(`/chapters?subjectId=${subjectId}`),
  },

  dataDictionaries: {
    list: () => request<any[]>('/data-dictionaries'),
    create: (data: any) => request<any>('/data-dictionaries', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) => request<any>(`/data-dictionaries/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => request(`/data-dictionaries/${id}`, { method: 'DELETE' }),
  },

  tags: {
    list: () => request<any[]>('/tags'),
  },

  questions: {
    list: (params?: Record<string, string | number | boolean>) => {
      const qs = params ? '?' + new URLSearchParams(
        Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]))
      ).toString() : '';
      return request<{ items: any[]; total: number; page: number; pageSize: number; totalPages: number }>(`/questions${qs}`);
    },
    get: (id: number) => request<any>(`/questions/${id}`),
    create: (data: any) => request<any>('/questions', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) => request<any>(`/questions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => request(`/questions/${id}`, { method: 'DELETE' }),
    batchCreate: (questions: any[]) =>
      request<{ total: number; successCount: number; failCount: number; results: any[] }>('/questions/batch', {
        method: 'POST', body: JSON.stringify({ questions }),
      }),
  },

  templates: {
    list: () => request<any[]>('/templates'),
    get: (id: number) => request<any>(`/templates/${id}`),
    create: (data: any) => request<any>('/templates', { method: 'POST', body: JSON.stringify(data) }),
  },

  papers: {
    list: (page = 1) => request<{ items: any[]; total: number }>(`/papers?page=${page}`),
    get: (id: number) => request<any>(`/papers/${id}`),
    generate: (data: any) => request<any>('/papers/generate', { method: 'POST', body: JSON.stringify(data) }),
    finalize: (id: number) => request<any>(`/papers/${id}/finalize`, { method: 'PUT' }),
    promote: (id: number) => request<any>(`/papers/${id}/promote`, { method: 'PUT' }),
    delete: (id: number) => request(`/papers/${id}`, { method: 'DELETE' }),
  },

  aiConfigs: {
    list: () => request<any[]>('/ai-configs'),
    create: (data: any) => request<any>('/ai-configs', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) => request<any>(`/ai-configs/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => request(`/ai-configs/${id}`, { method: 'DELETE' }),
    test: (data: { apiBaseUrl: string; apiKey: string; modelVersion: string }) =>
      request<{ success: boolean; message: string }>('/ai-configs/test', { method: 'POST', body: JSON.stringify(data) }),
  },
};
