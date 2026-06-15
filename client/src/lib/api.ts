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
    getReferencedPapers: (id: number) => request<{ count: number; papers: any[] }>(`/questions/${id}/referenced-papers`),
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
    delete: (id: number) => request(`/templates/${id}`, { method: 'DELETE' }),
  },

  papers: {
    list: (page = 1) => request<{ items: any[]; total: number; page: number; pageSize: number; totalPages: number }>(`/papers?page=${page}`),
    get: (id: number) => request<any>(`/papers/${id}`),
    generate: (data: any) => request<any>('/papers/generate', { method: 'POST', body: JSON.stringify(data) }),
    removeQuestion: (paperId: number, pqId: number) => request(`/papers/${paperId}/questions/${pqId}`, { method: 'DELETE' }),
    addQuestion: (paperId: number, data: { questionId: number; score: number; typeSection: string }) =>
      request<any>(`/papers/${paperId}/questions`, { method: 'POST', body: JSON.stringify(data) }),
    replaceQuestion: (paperId: number, pqId: number, newQuestionId: number) =>
      request<any>(`/papers/${paperId}/questions/${pqId}/replace`, { method: 'POST', body: JSON.stringify({ newQuestionId }) }),
    finalize: (id: number) => request<any>(`/papers/${id}/finalize`, { method: 'PUT' }),
    promote: (id: number) => request<any>(`/papers/${id}/promote`, { method: 'PUT' }),
    delete: (id: number) => request(`/papers/${id}`, { method: 'DELETE' }),
  },

  materials: {
    list: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return request<{ items: any[]; total: number; page: number; totalPages: number }>(`/materials${qs}`);
    },
    get: (id: number) => request<any>(`/materials/${id}`),
    getStats: (id: number) => request<any>(`/materials/${id}/stats`),
    upload: (formData: FormData) => {
      return fetch(`${BASE}/materials/upload`, {
        method: 'POST',
        body: formData, // no Content-Type header — browser will set multipart boundary
      }).then(async res => {
        if (!res.ok) { const err = await res.text(); throw new Error(err); }
        return res.json();
      });
    },
    reviewQuestion: (id: number, data: any) =>
      request<any>(`/materials/questions/${id}/review`, { method: 'PUT', body: JSON.stringify(data) }),
    batchReview: (materialId: number, data: { action: 'approve' | 'reject'; questionIds?: number[] }) =>
      request<any>(`/materials/${materialId}/batch-review`, { method: 'POST', body: JSON.stringify(data) }),
    delete: (id: number) => request(`/materials/${id}`, { method: 'DELETE' }),
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
