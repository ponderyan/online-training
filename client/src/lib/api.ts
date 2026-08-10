const BASE = '/api';

// 开发模式下视频流/上传直连后端（Next.js 代理对 Range/大 body 支持有限）
export const API_STREAM_BASE = typeof window !== 'undefined' && window.location.hostname === 'localhost'
  ? 'http://localhost:3001'
  : '';

// 上传也用同样的直连策略（Next.js 代理对大文件 multipart 有问题）
const UPLOAD_BASE = typeof window !== 'undefined' && window.location.hostname === 'localhost'
  ? 'http://localhost:3001'
  : '';

/** 从 localStorage 获取 JWT token */
function getToken(): string | null {
  if (typeof window === 'undefined') return null; // SSR guard
  return localStorage.getItem('token');
}

/** 跳转到登录页（SPA 导航，避免 window.location.href 全页刷新割裂浏览器历史栈） */
function redirectToLogin() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
  localStorage.removeItem('userPermissions');
  window.dispatchEvent(new CustomEvent('auth:redirect-login'));
}

// ─── 静默续期（refresh token）───
// 多个并发请求同时 401 时只发起一次 refresh（single-flight），
// 成功后所有请求用新 token 重试一次；失败则跳登录页。
let refreshPromise: Promise<boolean> | null = null;

async function tryRefreshToken(): Promise<boolean> {
  const rt = typeof window !== 'undefined' ? localStorage.getItem('refreshToken') : null;
  if (!rt) return false;
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await fetch(`${BASE}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: rt }),
        });
        if (!res.ok) return false;
        const data = await res.json();
        if (!data.accessToken) return false;
        localStorage.setItem('token', data.accessToken);
        if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
        return true;
      } catch {
        return false;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

async function request<T = any>(path: string, options?: RequestInit, isRetry = false): Promise<T> {
  const token = getToken();
  const isFormData = options?.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options?.headers as Record<string, string>),
  };

  // 自动带 JWT（FormData 不设 Content-Type，让浏览器自设 multipart boundary）
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    // ★ 静默续期：access token 过期时用 refresh token 换新，原请求重试一次
    if (!isRetry && (await tryRefreshToken())) {
      return request<T>(path, options, true);
    }
    redirectToLogin();
    throw new Error('登录已过期，请重新登录');
  }

  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  /** 登录（手动处理，需要保存 token） */
  login: async (username: string, password: string, captchaId?: string, captchaAnswer?: string) => {
    const res = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, captchaId, captchaAnswer }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    if (!res.ok) throw new Error('登录失败');
    // 保存 token + 用户信息（refreshToken 用于 401 静默续期）
    localStorage.setItem('token', data.accessToken);
    if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
    localStorage.setItem('user', JSON.stringify(data.user));

    // 登录后获取权限并缓存
    fetch('/api/user/permissions', {
      headers: { Authorization: `Bearer ${data.accessToken}` },
    }).then(r => r.json()).then(permData => {
      if (permData && permData.permissions) {
        localStorage.setItem('userPermissions', JSON.stringify(permData));
      }
    }).catch(() => {});

    return data.user;
  },

  /** 获取验证码 */
  getCaptcha: () =>
    fetch(`${BASE}/auth/captcha`).then(r => r.json()) as Promise<{ id: string; svg: string }>,

  subjects: {
    list: () => request<any[]>('/subjects'),
    /** 活跃科目列表（过滤停用科目，供选择器使用） */
    listActive: () => request<any[]>('/subjects/active'),
    get: (id: number) => request<any>(`/subjects/${id}`),
    create: (data: any) => request<any>('/subjects', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) => request<any>(`/subjects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => request(`/subjects/${id}`, { method: 'DELETE' }),
  },

  chapters: {
    list: (subjectId: number) => request<any[]>(`/chapters?subjectId=${subjectId}`),
    get: (id: number) => request<any>(`/chapters/${id}`),
    create: (data: any) => request<any>('/chapters', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) => request<any>(`/chapters/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => request(`/chapters/${id}`, { method: 'DELETE' }),

  },

  dataDictionaries: {
    list: () => request<any[]>('/data-dictionaries'),
    create: (data: any) => request<any>('/data-dictionaries', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) => request<any>(`/data-dictionaries/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => request(`/data-dictionaries/${id}`, { method: 'DELETE' }),
  },

  tags: {
    create: (data: any) => request<any>('/tags', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) => request<any>(`/tags/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => request(`/tags/${id}`, { method: 'DELETE' }),

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
    update: (id: number, data: any) => request<any>(`/templates/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  },

  papers: {
    list: (params: string | number = 1) => request<{ items: any[]; total: number; page: number; pageSize: number; totalPages: number }>(`/papers?${typeof params === 'number' ? `page=${params}` : params}`),
    get: (id: number) => request<any>(`/papers/${id}`),
    generate: (data: any) => request<any>('/papers/generate', { method: 'POST', body: JSON.stringify(data) }),
    removeQuestion: (paperId: number, pqId: number) => request(`/papers/${paperId}/questions/${pqId}`, { method: 'DELETE' }),
    addQuestion: (paperId: number, data: { questionId: number; score: number; typeSection: string }) =>
      request<any>(`/papers/${paperId}/questions`, { method: 'POST', body: JSON.stringify(data) }),
    replaceQuestion: (paperId: number, pqId: number, newQuestionId: number) =>
      request<any>(`/papers/${paperId}/questions/${pqId}/replace`, { method: 'POST', body: JSON.stringify({ newQuestionId }) }),
    finalize: (id: number) => request<any>(`/papers/${id}/finalize`, { method: 'PUT' }),
    promote: (id: number) => request<any>(`/papers/${id}/promote`, { method: 'PUT' }),
    submitReview: (id: number) => request<any>(`/papers/${id}/submit-review`, { method: 'PUT' }),
    approveReview: (id: number) => request<any>(`/papers/${id}/approve-review`, { method: 'PUT' }),
    rejectReview: (id: number, reason?: string) => request<any>(`/papers/${id}/reject-review`, { method: 'PUT', body: JSON.stringify({ reason }) }),
    delete: (id: number) => request(`/papers/${id}`, { method: 'DELETE' }),
    archive: (id: number) => request<any>(`/papers/${id}/archive`, { method: 'POST' }),
    restore: (id: number) => request<any>(`/papers/${id}/restore`, { method: 'POST' }),
    batchStatus: (ids: number[], status: string) => request<any>('/papers/batch/status', { method: 'POST', body: JSON.stringify({ ids, status }) }),
    batchDelete: (ids: number[]) => request<any>('/papers/batch/delete', { method: 'POST', body: JSON.stringify({ ids }) }),
  },

  exams: {
    list: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return request<{ items: any[]; total: number; page: number; pageSize: number; totalPages: number }>(`/exams${qs}`);
    },
    get: (id: number) => request<any>(`/exams/${id}`),
    create: (data: any) => request<any>('/exams', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) => request<any>(`/exams/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => request(`/exams/${id}`, { method: 'DELETE' }),
    appeal: {
      submit: (examId: number, reason: string) =>
        request<any>(`/student/exams/${examId}/appeal`, {
          method: 'POST',
          body: JSON.stringify({ reason }),
        }),
    },
    admin: {
      getExamResults: (examId: number) =>
        request<any>(`/exams/${examId}/results`),
      getStudentResult: (examId: number, studentId: number) =>
        request<any>(`/exams/${examId}/results/${studentId}`),
      getAppeals: (examId: number) =>
        request<any>(`/exams/${examId}/appeals`),
      resolveAppeal: (examId: number, appealId: number, data: any) =>
        request<any>(`/exams/${examId}/appeals/${appealId}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        }),
      publishScores: (examId: number) =>
        request<any>(`/exams/${examId}/publish-scores`, { method: 'POST' }),
    },
    publish: (id: number) => request<any>(`/exams/${id}/publish`, { method: 'PUT' }),
    finish: (id: number) => request<any>(`/exams/${id}/finish`, { method: 'PUT' }),
    students: (id: number) => request<any[]>(`/exams/${id}/students`),
    addStudents: (id: number, data: { studentIds: number[] }) =>
      request<any>(`/exams/${id}/add-students`, { method: 'POST', body: JSON.stringify(data) }),
    transcript: (examId: number) => request<any>(`/exams/${examId}/transcript`),
    // ── Phase F: 监考中心 ──
    proctoring: {
      overview: (examId: number) => request<any>(`/exams/${examId}/proctoring/overview`),
      board: (examId: number) => request<any>(`/exams/${examId}/proctoring/board`),
      toggleAbsent: (examId: number, sessionId: number, data: { absent: boolean; operatorName: string }) =>
        request<any>(`/exams/${examId}/proctoring/sessions/${sessionId}/absent`, { method: 'PUT', body: JSON.stringify(data) }),
      sessions: (examId: number, params?: Record<string, string>) => {
        const qs = params ? '?' + new URLSearchParams(params).toString() : '';
        return request<{ items: any[]; total: number; page: number; pageSize: number }>(`/exams/${examId}/proctoring/sessions${qs}`);
      },
      sessionDetail: (examId: number, sessionId: number) => request<any>(`/exams/${examId}/proctoring/sessions/${sessionId}`),
      warn: (examId: number, sessionId: number, data: { message: string; operatorName: string }) =>
        request<any>(`/exams/${examId}/proctoring/sessions/${sessionId}/warn`, { method: 'PUT', body: JSON.stringify(data) }),
      forceSubmit: (examId: number, sessionId: number, data: { reason: string; operatorName: string }) =>
        request<any>(`/exams/${examId}/proctoring/sessions/${sessionId}/force-submit`, { method: 'PUT', body: JSON.stringify(data) }),
      extendTime: (examId: number, sessionId: number, data: { extraSeconds: number; reason: string; operatorName: string }) =>
        request<any>(`/exams/${examId}/proctoring/sessions/${sessionId}/extend-time`, { method: 'PUT', body: JSON.stringify(data) }),
      messages: (examId: number, sessionId: number) =>
        request<any[]>(`/exams/${examId}/proctoring/sessions/${sessionId}/messages`),
    },
  },

  // ── 线下笔试考试 ──
  offlineExams: {
    publish: (id: number) => request<any>(`/offline-exams/${id}/publish`, { method: 'PUT' }),
    startGrading: (id: number) => request<any>(`/offline-exams/${id}/start-grading`, { method: 'PUT' }),
    startScoreEntry: (id: number) => request<any>(`/offline-exams/${id}/start-score-entry`, { method: 'PUT' }),
    confirmScores: (id: number, data?: { approvalNote?: string }) =>
      request<any>(`/offline-exams/${id}/confirm-scores`, { method: 'PUT', body: JSON.stringify(data || {}) }),
    publishScores: (id: number) => request<any>(`/offline-exams/${id}/publish-scores`, { method: 'PUT' }),
    enterScore: (id: number, data: { sessionId: number; scoreByType: Record<string, number>; graderName?: string; graderId?: number; gradedAt?: string }) =>
      request<any>(`/offline-exams/${id}/scores`, { method: 'POST', body: JSON.stringify(data) }),
    batchImport: (id: number, entries: any[]) =>
      request<any>(`/offline-exams/${id}/scores/batch`, { method: 'POST', body: JSON.stringify({ entries }) }),
    getScores: (id: number) => request<any[]>(`/offline-exams/${id}/scores`),
    getAuditLogs: (id: number) => request<any[]>(`/offline-exams/${id}/audit-logs`),
    markAbsent: (id: number, sessionId: number, absent: boolean) =>
      request<any>(`/offline-exams/${id}/sessions/${sessionId}/absent`, { method: 'PUT', body: JSON.stringify({ absent }) }),
    assignSeats: (id: number, data?: { startFrom?: number }) =>
      request<any>(`/offline-exams/${id}/assign-seats`, { method: 'POST', body: JSON.stringify(data || {}) }),
    getSeatTable: (id: number) => request<any>(`/offline-exams/${id}/seat-table`),
    importTemplateUrl: (id: number) => `/api/offline-exams/${id}/import-template?token=${getToken()}`,
    createRetake: (id: number, data: { startTime: string; endTime: string; durationMinutes?: number; locations?: any }) =>
      request<any>(`/offline-exams/${id}/retake`, { method: 'POST', body: JSON.stringify(data) }),
    getRetakeInfo: (id: number) => request<any>(`/offline-exams/${id}/retake-info`),
    reviewScore: (id: number, sessionId: number, data: { reviewerName: string; reviewerId?: number; reviewNote?: string; approved: boolean }) =>
      request<any>(`/offline-exams/${id}/scores/${sessionId}/review`, { method: 'PUT', body: JSON.stringify(data) }),
    seatTableExcelUrl: (id: number) => `/api/offline-exams/${id}/seat-table/excel?token=${getToken()}`,
    seatTablePdfUrl: (id: number) => `/api/offline-exams/${id}/seat-table/pdf?token=${getToken()}`,
  },

  students: {
    list: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return request<{ items: any[]; total: number; page: number; pageSize: number; totalPages: number }>(`/students${qs}`);
    },
    get: (id: number) => request<any>(`/students/${id}`),
    create: (data: any) => request<any>('/students', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) => request<any>(`/students/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    batchCreate: (data: { students: any[] }) => request<any>('/students/batch', { method: 'POST', body: JSON.stringify(data) }),
    groups: () => request<any[]>('/students/groups/all'),
    createGroup: (data: { name: string; note?: string }) => request<any>('/students/groups', { method: 'POST', body: JSON.stringify(data) }),
    deleteGroup: (id: number) => request<any>(`/students/groups/${id}`, { method: 'DELETE' }),
    getProfile: (id: number) => request<any>(`/students/${id}/profile`),
    getExamHistory: (id: number) => request<any[]>(`/students/${id}/exam-history`),
    getCertificates: (id: number) => request<any[]>(`/students/${id}/certificates`),
    getFeeRecords: (id: number) => request<any[]>(`/students/${id}/fee-records`),
    addFeeRecord: (id: number, data: any) => request<any>(`/students/${id}/fee-records`, { method: 'POST', body: JSON.stringify(data) }),
    resetPassword: (id: number) => request<any>(`/students/${id}/reset-password`, { method: 'POST' }),
    updateFeeStatus: (id: number, data: any) => request<any>(`/students/${id}/fee-status`, { method: 'PUT', body: JSON.stringify(data) }),
    exportCsv: () => `${BASE}/students/export-csv`,
  },

  // 证书申请审批
  certificateApplications: {
    list: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return request<{ items: any[]; total: number }>(`/certificates/applications${qs}`);
    },
    approve: (id: number, operatorId: number) => request<any>(`/certificates/applications/${id}/approve`, { method: 'POST', body: JSON.stringify({ operatorId }) }),
    batchApprove: (ids: number[], operatorId: number) => request<any>('/certificates/applications/batch-approve', { method: 'POST', body: JSON.stringify({ ids, operatorId }) }),
    reject: (id: number, reason: string, operatorId: number) => request<any>(`/certificates/applications/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason, operatorId }) }),
  },

  trainingPrograms: {
    list: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return request<any>(`/training-programs${qs}`);
    },
    get: (id: number) => request<any>(`/training-programs/${id}`),
    create: (data: any) => request<any>('/training-programs', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) => request<any>(`/training-programs/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => request(`/training-programs/${id}`, { method: 'DELETE' }),
    updateStatus: (id: number, status: string, reason?: string) => request<any>(`/training-programs/${id}/status`, { method: 'PUT', body: JSON.stringify({ status, reason }) }),
    enrollStudents: (id: number, data: { studentIds: number[]; agencyId?: number }) => request<any>(`/training-programs/${id}/enroll`, { method: 'POST', body: JSON.stringify(data) }),
    getStatusLogs: (id: number) => request<any[]>(`/training-programs/${id}/status-logs`),
    getAvailableActions: (id: number) => request<any[]>(`/training-programs/${id}/available-actions`),

    // Phase 1c: 证据文件
    getEvidences: (programId: number) => request<any[]>(`/training-programs/${programId}/evidences`),
    uploadEvidence: (programId: number, formData: FormData) =>
      request<any>(`/training-programs/${programId}/evidences`, { method: 'POST', body: formData, headers: {} }),
    downloadEvidence: (programId: number, evidenceId: number) =>
      `/api/training-programs/${programId}/evidences/${evidenceId}/file`,
    deleteEvidence: (programId: number, evidenceId: number) =>
      request(`/training-programs/${programId}/evidences/${evidenceId}`, { method: 'DELETE' }),
    generateSigninSheet: (programId: number) =>
      request<{ fileName: string }>(`/training-programs/${programId}/generate-signin-sheet`),

    // Phase 1c: 出勤
    getAttendance: (programId: number) => request<any[]>(`/training-programs/${programId}/attendance`),
    updateAttendance: (programId: number, studentId: number, data: { actualDays: number; reason: string }) =>
      request<any>(`/training-programs/${programId}/attendance/${studentId}`, { method: 'PUT', body: JSON.stringify(data) }),

    // Phase 1c: 备案
    submitFiling: (programId: number, data: { agencyName: string; agencyContact: string; agencyPhone: string }) =>
      request<any>(`/filing/${programId}/submit`, { method: 'POST', body: JSON.stringify(data) }),

    // Phase 1d: 全链审计
    getAuditChain: (id: number) => request<any>(`/training-programs/${id}/audit-chain`),

    // Phase: 培训班仪表盘
    getDashboard: (id: number) => request<any>(`/training-programs/${id}/dashboard`),
  },

  // Phase 1c: 备案管理
  filing: {
    list: (params?: { page?: number; pageSize?: number; status?: string; search?: string }) => {
      const qp: Record<string, string> = {};
      if (params?.page) qp.page = params.page.toString();
      if (params?.pageSize) qp.pageSize = params.pageSize.toString();
      if (params?.status) qp.status = params.status;
      if (params?.search) qp.search = params.search;
      const qs = Object.keys(qp).length ? '?' + new URLSearchParams(qp).toString() : '';
      return request<{ items: any[]; total: number }>(`/filing${qs}`);
    },
    get: (id: number) => request<any>(`/filing/${id}`),
    review: (id: number, data: { status: string; reviewComment?: string }) =>
      request<any>(`/filing/${id}/review`, { method: 'PUT', body: JSON.stringify(data) }),
  },

  agencies: {
    list: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return request<any>(`/enrollment-agencies${qs}`);
    },
    get: (id: number) => request<any>(`/enrollment-agencies/${id}`),
    create: (data: any) => request<any>('/enrollment-agencies', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) => request<any>(`/enrollment-agencies/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => request(`/enrollment-agencies/${id}`, { method: 'DELETE' }),

    // 机构质量雷达
    radar: (params?: Record<string, string | number>) => {
      const qs = params ? '?' + new URLSearchParams(
        Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]))
      ).toString() : '';
      return request<any>(`/enrollment-agencies/radar${qs}`);
    },
  },

  getPermissionCategories: () => request<any[]>('/permissions/categories'),

  programs: {
    list: (params?: Record<string, string | number>) => {
      const qs = params ? '?' + new URLSearchParams(
        Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]))
      ).toString() : '';
      return request<{ items: any[]; total: number }>(`/training-programs${qs}`);
    },
  },

  enrollmentAgencies: {
    list: () => request<{ items: any[]; total: number; page: number; pageSize: number; totalPages: number }>('/enrollment-agencies'),
    get: (id: number) => request<any>(`/enrollment-agencies/${id}`),
    getStudents: (id: number, params?: Record<string, string | number>) => {
      const qs = params ? '?' + new URLSearchParams(
        Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]))
      ).toString() : '';
      return request<{ items: any[]; total: number; page: number; pageSize: number }>(`/enrollment-agencies/${id}/students${qs}`);
    },
    getStudentProgress: (id: number, studentId?: number) =>
      request<any[]>(`/enrollment-agencies/${id}/students/progress${studentId ? `?studentId=${studentId}` : ''}`),
    getEnrollments: (id: number, studentId?: number) =>
      request<any[]>(`/enrollment-agencies/${id}/enrollments${studentId ? `?studentId=${studentId}` : ''}`),
    listMembers: (id: number) => request<any[]>(`/enrollment-agencies/${id}/members`),
    createMember: (id: number, data: { displayName: string; username: string; phone?: string; roleCode: string }) =>
      request<any>(`/enrollment-agencies/${id}/members`, { method: 'POST', body: JSON.stringify(data) }),
    updateMemberRole: (id: number, userId: number, roleCode: string) =>
      request<any>(`/enrollment-agencies/${id}/members/${userId}`, { method: 'PUT', body: JSON.stringify({ roleCode }) }),
    removeMember: (id: number, userId: number) =>
      request<any>(`/enrollment-agencies/${id}/members/${userId}`, { method: 'DELETE' }),
  },

  getUserPermissions: () =>
    request<{ permissions: string[]; roles: any[]; isSuperAdmin: boolean }>('/user/permissions'),

  permissions: {
    getRoles: () => request<any[]>('/permissions/roles'),
    createRole: (data: any) => request<any>('/permissions/roles', { method: 'POST', body: JSON.stringify(data) }),
    updateRole: (id: number, data: any) => request<any>(`/permissions/roles/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteRole: (id: number) => request(`/permissions/roles/${id}`, { method: 'DELETE' }),
    getMatrix: () => request<any>('/permissions'),
    updateRolePerms: (roleId: number, permissions: any[]) => request<any>(`/permissions/${roleId}`, { method: 'PUT', body: JSON.stringify({ permissions }) }),
    getRoleUsers: (roleId: number, page: number, search?: string) => {
      const qs = `?page=${page}&pageSize=20${search ? '&search=' + encodeURIComponent(search) : ''}`;
      return request<any>(`/permissions/roles/${roleId}/users${qs}`);
    },
    addRoleUser: (roleId: number, userId: number) =>
      request<any>(`/permissions/roles/${roleId}/users`, { method: 'POST', body: JSON.stringify({ userId }) }),
    removeRoleUser: (roleId: number, assignmentId: number) =>
      request<any>(`/permissions/roles/${roleId}/users/${assignmentId}`, { method: 'DELETE' }),
    searchUsers: (q: string, excludeRoleId?: number) => {
      const qp: Record<string, string> = { q };
      if (excludeRoleId) qp.excludeRoleId = excludeRoleId.toString();
      return request<any[]>(`/permissions/users/search?` + new URLSearchParams(qp).toString());
    },
    /** 重置所有角色权限为 permissions.constants.ts 默认值 */
    seed: () => request<any>('/permissions/seed', { method: 'POST' }),
  },


  certificates: {
    list: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return request<{ items: any[]; total: number }>(`/certificates${qs}`);
    },
    get: (id: number) => request<any>(`/certificates/${id}`),
    my: () => request<any[]>('/certificates/my'),
    verify: (certificateNo: string, verificationCode?: string) => {
      const params = `no=${encodeURIComponent(certificateNo)}${verificationCode ? `&code=${encodeURIComponent(verificationCode)}` : ''}`;
      return request<any>(`/certificates/verify?${params}`);
    },
    issue: (examSessionId: number, studentId: number) =>
      request<any>(`/certificates/${examSessionId}/${studentId}`, { method: 'POST' }),
    revoke: (id: number, reason: string) =>
      request<any>(`/certificates/${id}/revoke`, { method: 'POST', body: JSON.stringify({ reason }) }),
    pdf: (id: number) => `${BASE}/certificates/${id}/pdf`,
  },

  grading: {
    list: (examId: number) => request<any[]>(`/grading/${examId}`),
    getStudentAnswers: (examId: number, studentId: number) => request<any>(`/grading/${examId}/${studentId}`),
    gradeAnswer: (examId: number, studentId: number, answerId: number, data: { score: number; graderNote?: string }) =>
      request<any>(`/grading/${examId}/${studentId}/${answerId}`, { method: 'PUT', body: JSON.stringify(data) }),
    publish: (examId: number) => request<any>(`/grading/${examId}/publish`, { method: 'POST' }),
    adjustScore: (examId: number, studentId: number, data: { adjustedScore: number; reason: string; operatorId: number; operatorName: string }) =>
      request<any>(`/grading/${examId}/${studentId}/adjust`, { method: 'POST', body: JSON.stringify(data) }),
  },

  materials: {
    list: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return request<{ items: any[]; total: number; page: number; totalPages: number }>(`/materials${qs}`);
    },
    get: (id: number) => request<any>(`/materials/${id}`),
    getStats: (id: number) => request<any>(`/materials/${id}/stats`),
    upload: (formData: FormData) => {
      const token = getToken();
      return fetch(`${UPLOAD_BASE}/api/materials/upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      }).then(async res => {
        if (res.status === 401) { redirectToLogin(); throw new Error('登录已过期，请重新登录'); }
        if (!res.ok) { const err = await res.text(); throw new Error(err); }
        return res.json();
      });
    },
    reviewQuestion: (id: number, data: any) =>
      request<any>(`/materials/questions/${id}/review`, { method: 'PUT', body: JSON.stringify(data) }),
    batchReview: (materialId: number, data: { action: 'approve' | 'reject'; questionIds?: number[] }) =>
      request<any>(`/materials/${materialId}/batch-review`, { method: 'POST', body: JSON.stringify(data) }),
    delete: (id: number) => request(`/materials/${id}`, { method: 'DELETE' }),
    create: (data: { name: string; subjectId: number; content: string; batchNote?: string }) =>
      request<any>('/materials', { method: 'POST', body: JSON.stringify(data) }),
    // ── 章节编辑 ──
    updateChapter: (materialId: number, chapterId: number, data: { title: string }) =>
      request<any>(`/materials/${materialId}/chapters/${chapterId}`, { method: 'PUT', body: JSON.stringify(data) }),
    mergeChapters: (materialId: number, data: { chapterIds: number[] }) =>
      request<any>(`/materials/${materialId}/chapters/merge`, { method: 'POST', body: JSON.stringify(data) }),
    splitChapter: (materialId: number, data: { chapterId: number; splitPosition: number }) =>
      request<any>(`/materials/${materialId}/chapters/split`, { method: 'POST', body: JSON.stringify(data) }),
    deleteChapter: (materialId: number, chapterId: number) =>
      request<any>(`/materials/${materialId}/chapters/${chapterId}`, { method: 'DELETE' }),
    confirmStructure: (materialId: number) =>
      request<any>(`/materials/${materialId}/confirm-structure`, { method: 'POST' }),
    getChapterContent: (materialId: number, chapterId: number) =>
      request<any>(`/materials/${materialId}/chapters/${chapterId}/content`),
    listForFilter: () => request<any[]>('/materials/list-for-filter'),
    // ── 出题计划 ──
    getQuestionPlans: (materialId: number) =>
      request<any[]>(`/materials/${materialId}/question-plans`),
    createQuestionPlan: (materialId: number, data: any) =>
      request<any>(`/materials/${materialId}/question-plans`, { method: 'POST', body: JSON.stringify(data) }),
    executeQuestionPlan: (materialId: number, planId: number) =>
      request<any>(`/materials/${materialId}/execute-plan/${planId}`, { method: 'POST' }),
    getPlanProgress: (materialId: number, planId: number) =>
      request<any>(`/materials/${materialId}/plan-progress/${planId}`),
    generateFromBatchNote: (materialId: number) =>
      request<any>(`/materials/${materialId}/generate-from-batchNote`, { method: 'POST' }),
    archive: (id: number) => request<any>(`/materials/${id}/archive`, { method: 'POST' }),
    unarchive: (id: number) => request<any>(`/materials/${id}/unarchive`, { method: 'POST' }),
  },

  // ── Phase C: 讲师管理 ──
  instructors: {
    list: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return request<{ items: any[]; total: number }>(`/instructors${qs}`);
    },
    get: (id: number) => request<any>(`/instructors/${id}`),
    create: (data: any) => request<any>('/instructors', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) => request<any>(`/instructors/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => request(`/instructors/${id}`, { method: 'DELETE' }),
    availableGraders: () => request<any[]>('/instructors/available-graders'),
    getStats: (id: number) => request<any>(`/instructors/${id}/stats`),
  },

  // ── Phase C: 课程管理 ──
  courses: {
    list: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return request<{ items: any[]; total: number }>(`/courses${qs}`);
    },
    get: (id: number) => request<any>(`/courses/${id}`),
    create: (data: any) => request<any>('/courses', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) => request<any>(`/courses/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => request(`/courses/${id}`, { method: 'DELETE' }),
    toggleStatus: (id: number) => request(`/courses/${id}/toggle-status`, { method: 'PUT' }),
    syncVideoLinks: (id: number, videoCourseIds: number[]) => request(`/courses/${id}/video-links`, { method: 'PUT', body: JSON.stringify({ videoCourseIds }) }),
  },

  // ── Phase 2: 视频课程（独立实体） ──
  videoCourses: {
    list: (params?: { page?: number; pageSize?: number; type?: string; keyword?: string; status?: string; courseId?: number }) => {
      const qp: Record<string, string> = {};
      if (params?.page) qp.page = params.page.toString();
      if (params?.pageSize) qp.pageSize = params.pageSize.toString();
      if (params?.type) qp.type = params.type;
      if (params?.status) qp.status = params.status;
      if (params?.keyword) qp.keyword = params.keyword;
      if (params?.courseId) qp.courseId = params.courseId.toString();
      const qs = Object.keys(qp).length ? '?' + new URLSearchParams(qp).toString() : '';
      return request<{ items: any[]; total: number; page: number; pageSize: number; totalPages: number }>(`/video-courses${qs}`);
    },
    get: (id: number) => request<any>(`/video-courses/${id}`),
    create: (data: any) => request<any>('/video-courses', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) => request<any>(`/video-courses/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => request(`/video-courses/${id}`, { method: 'DELETE' }),
    getLogs: (id: number) => request<any[]>(`/video-courses/${id}/logs`),
    getStudentVisible: () => request<{ videos: any[]; stats: any }>('/video-courses/student/visible'),
    getProgress: (id: number) => request<any>(`/video-courses/${id}/progress`),
    reportProgress: (id: number, data: { progress: number; lastPosition: number; completed?: boolean }) =>
      request<any>(`/video-courses/${id}/progress`, { method: 'POST', body: JSON.stringify(data) }),
    getQuizzes: (id: number) => request<any[]>(`/video-courses/${id}/quizzes`),
    addQuiz: (id: number, data: { timePoint: number; question: string; options: string[]; correctIndex: number }) =>
      request<any>(`/video-courses/${id}/quizzes`, { method: 'POST', body: JSON.stringify(data) }),
    deleteQuiz: (quizId: number) => request(`/video-courses/quizzes/${quizId}`, { method: 'DELETE' }),
  },

  // ── Phase 1b: 课程视频（即将废弃） ──
  courseVideos: {
    list: (courseId: number) => request<any[]>(`/courses/${courseId}/videos`),
    get: (courseId: number, id: number) => request<any>(`/courses/${courseId}/videos/${id}`),
    create: (courseId: number, data: any) => request<any>(`/courses/${courseId}/videos`, { method: 'POST', body: JSON.stringify(data) }),
    update: (courseId: number, id: number, data: any) => request<any>(`/courses/${courseId}/videos/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (courseId: number, id: number) => request(`/courses/${courseId}/videos/${id}`, { method: 'DELETE' }),
    upload: (courseId: number, file: File, title: string, duration: number) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', title);
      formData.append('duration', duration.toString());
      return request<any>(`/courses/${courseId}/videos/upload`, { method: 'POST', body: formData });
    },
    reorder: (courseId: number, videoIds: number[]) =>
      request(`/courses/${courseId}/videos/reorder`, { method: 'PUT', body: JSON.stringify({ videoIds }) }),
  },
  videoProgress: {
    get: (courseId: number, videoId: number) => request<any>(`/courses/${courseId}/videos/${videoId}/progress`),
    report: (courseId: number, videoId: number, data: { progress: number; lastPosition: number; completed?: boolean }) =>
      request<any>(`/courses/${courseId}/videos/${videoId}/progress`, { method: 'POST', body: JSON.stringify(data) }),
  },

  // ── Phase 1b: 学时记录 ──
  learningHours: {
    list: (params?: { programId?: number; source?: string; status?: string; studentId?: number }) => {
      const qs = params ? '?' + new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([_, v]) => v !== undefined).map(([k, v]) => [k, String(v)]))).toString() : '';
      return request<{ items: any[]; total: number }>(`/learning-hours${qs}`);
    },
    stats: () => request<{ totalHours: number; completedVideos: number; programStats: any[] }>('/learning-hours/stats'),
    programStats: (programId: number) => request<any[]>(`/learning-hours/program/${programId}`),
    pending: (programId?: number, source?: string) => {
      const params = new URLSearchParams();
      if (programId) params.set('programId', String(programId));
      if (source) params.set('source', source);
      const qs = params.toString();
      return request<any[]>(`/learning-hours/pending${qs ? '?' + qs : ''}`);
    },
    approve: (ids: number[], comment?: string) =>
      request<any>('/learning-hours/approve', { method: 'POST', body: JSON.stringify({ ids, comment }) }),
    reject: (ids: number[], comment: string) =>
      request<any>('/learning-hours/reject', { method: 'POST', body: JSON.stringify({ ids, comment }) }),
    submit: (data: { studentId: number; programId?: number; hours: number; source?: string; typeId?: number; evidenceUrl?: string; note?: string }) =>
      request<any>('/learning-hours/submit', { method: 'POST', body: JSON.stringify(data) }),
    uploadEvidence: (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return request<{ url: string; filename: string }>('/learning-hours/upload-evidence', { method: 'POST', body: formData });
    },
  },

  // ── Phase C: 排课管理 ──
  schedules: {
    list: (programId?: number) => {
      const qs = programId ? `?programId=${programId}` : '';
      return request<{ items: any[]; total: number }>(`/schedules${qs}`);
    },
    getByProgram: (programId: number) => request<any[]>(`/training-programs/${programId}/schedules`),
    create: (data: any) => request<any>('/schedules', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) => request<any>(`/schedules/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => request(`/schedules/${id}`, { method: 'DELETE' }),
  },

  // ── 公开证书查询（无登录） ──
  verifyCertificate: async (certificateNo: string, verificationCode: string) => {
    const res = await fetch(`/api/certificates/verify?no=${encodeURIComponent(certificateNo)}&code=${encodeURIComponent(verificationCode)}`);
    if (!res.ok) throw new Error('查询失败');
    return res.json();
  },

  // ── Phase D: 仪表盘 ──
  dashboard: {
    stats: () => request<any>('/dashboard/stats'),
  },

  // ── Phase D: 成绩申诉 ──
  scoreAppeals: {
    create: (examId: number, data: { reason: string; description: string; studentId: number }) =>
      request<any>(`/exams/${examId}/appeals`, { method: 'POST', body: JSON.stringify(data) }),
    listByExam: (examId: number, status?: string) => {
      const qs = status ? `?status=${status}` : '';
      return request<any[]>(`/exams/${examId}/appeals${qs}`);
    },
    my: (studentId: number) => request<any[]>(`/exams/appeals/my?studentId=${studentId}`),
    review: (id: number, data: { status: string; newScore?: number; reviewNote?: string; reviewerId: number }) =>
      request<any>(`/exams/appeals/${id}/review`, { method: 'PATCH', body: JSON.stringify(data) }),
  },

  // ── Phase D: 评价体系 ──
  evaluations: {
    list: (params?: { programId?: number; instructorId?: number }) => {
      const qs = params ? '?' + new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([_, v]) => v !== undefined).map(([k, v]) => [k, String(v)]))).toString() : '';
      return request<any[]>(`/evaluations${qs}`);
    },
    create: (data: any) => request<any>('/evaluations', { method: 'POST', body: JSON.stringify(data) }),
    byProgram: (programId: number) => request<any[]>(`/evaluations/program/${programId}`),
    programStats: (programId: number) => request<any>(`/evaluations/program/${programId}/stats`),
    my: () => request<any[]>('/evaluations/my'),
    instructorStats: (instructorId: number) => request<any>(`/evaluations/instructor/${instructorId}`),
    delete: (id: number) => request<any>(`/evaluations/${id}`, { method: 'DELETE' }),
  },

  aiConfigs: {
    list: () => request<any[]>('/ai-configs'),
    create: (data: any) => request<any>('/ai-configs', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) => request<any>(`/ai-configs/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => request(`/ai-configs/${id}`, { method: 'DELETE' }),
    test: (data: { apiBaseUrl: string; apiKey: string; modelVersion: string; configId?: number }) =>
      request<{ success: boolean; message: string }>('/ai-configs/test', { method: 'POST', body: JSON.stringify(data) }),
  },

  // ── Phase 1e: 知识库 ──
  knowledge: {
    listDocuments: (params?: { page?: number; pageSize?: number; search?: string; subjectId?: number }) => {
      const qp: Record<string, string> = {};
      if (params?.page) qp.page = params.page.toString();
      if (params?.pageSize) qp.pageSize = params.pageSize.toString();
      if (params?.search) qp.search = params.search;
      if (params?.subjectId) qp.subjectId = params.subjectId.toString();
      const qs = Object.keys(qp).length ? '?' + new URLSearchParams(qp).toString() : '';
      return request<{ items: any[]; total: number; page: number; pageSize: number }>(`/knowledge/documents${qs}`);
    },
    getDocument: (id: number) => request<any>(`/knowledge/documents/${id}`),
    uploadDocument: (formData: FormData) =>
      request<any>('/knowledge/upload', { method: 'POST', body: formData }),
    deleteDocument: (id: number) =>
      request(`/knowledge/documents/${id}`, { method: 'DELETE' }),
    deleteBySource: (source: string) =>
      request(`/knowledge/by-source/${encodeURIComponent(source)}`, { method: 'DELETE' }),
    // 分块管理
    getChunks: (docId: number, params?: { page?: number; pageSize?: number }) => {
      const qp: Record<string, string> = {};
      if (params?.page) qp.page = params.page.toString();
      if (params?.pageSize) qp.pageSize = params.pageSize.toString();
      const qs = Object.keys(qp).length ? '?' + new URLSearchParams(qp).toString() : '';
      return request<{ items: any[]; total: number; page: number; pageSize: number }>(`/knowledge/documents/${docId}/chunks${qs}`);
    },
    updateChunk: (chunkId: number, data: { content?: string; title?: string }) =>
      request<any>(`/knowledge/chunks/${chunkId}`, { method: 'PUT', body: JSON.stringify(data) }),
    mergeChunk: (chunkId: number) =>
      request<any>(`/knowledge/chunks/${chunkId}/merge`, { method: 'POST' }),
    splitChunk: (chunkId: number, position: number) =>
      request<any>(`/knowledge/chunks/${chunkId}/split`, { method: 'POST', body: JSON.stringify({ position }) }),
    deleteChunk: (chunkId: number) =>
      request<any>(`/knowledge/chunks/${chunkId}`, { method: 'DELETE' }),
    rebuildChunks: (docId: number, params?: { chunkSize?: number; overlap?: number }) =>
      request<any>(`/knowledge/documents/${docId}/rebuild`, { method: 'POST', body: JSON.stringify(params || {}) }),
    // 知识点关联
    setChunkKnowledgePoints: (chunkId: number, knowledgePointIds: number[]) =>
      request<any>(`/knowledge/chunks/${chunkId}/knowledge-points`, { method: 'PUT', body: JSON.stringify({ knowledgePointIds }) }),
    // 检索测试
    testQuery: (query: string, subjectId?: number, limit?: number) =>
      request<{ results: any[]; keywords: string[] }>('/knowledge/test-query', { method: 'POST', body: JSON.stringify({ query, subjectId, limit }) }),
    // AI 功能
    autoLabel: (docId: number) =>
      request<{ labeled: number }>(`/knowledge/documents/${docId}/auto-label`, { method: 'POST' }),
    generateQuestions: (chunkId: number, data?: { questionType?: string; count?: number }) =>
      request<{ questions: any[] }>(`/knowledge/chunks/${chunkId}/generate-questions`, { method: 'POST', body: JSON.stringify(data || {}) }),
    generateQa: (docId: number) =>
      request<{ total: number }>(`/knowledge/documents/${docId}/generate-qa`, { method: 'POST' }),
  },

  // ── Phase E: 消息通知 ──
  notifications: {
    list: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return request<{ items: any[]; total: number; page: number; pageSize: number; totalPages: number }>(`/notifications${qs}`);
    },
    unreadCount: () => request<{ count: number }>('/notifications/unread-count'),
    markAsRead: (id: number) => request<any>(`/notifications/${id}/read`, { method: 'PATCH' }),
    markAllAsRead: () => request<any>('/notifications/read-all', { method: 'PATCH' }),
  },

  // ── Phase E: 审计日志 ──
  auditLogs: {
    list: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return request<{ data: any[]; total: number; page: number; pageSize: number }>(`/audit-logs${qs}`);
    },
  },

  // ── 全链审计（业务实体生命周期时间线）──
  auditTrail: {
    getTrail: (entityType: string, entityId: number) =>
      request<{ entityType: string; entityId: number; entityName: string; events: any[] }>(`/audit-trail/${entityType}/${entityId}`),
    search: (entityType: string, keyword?: string) => {
      const params: Record<string, string> = { entityType };
      if (keyword) params.keyword = keyword;
      return request<{ entityType: string; items: any[] }>(`/audit-trail/search?${new URLSearchParams(params).toString()}`);
    },
  },

  // ── 学员成绩变动记录（脱敏版）──
  studentScores: {
    changes: (examId: number) =>
      request<{ changes: any[] }>(`/student/scores/${examId}/changes`),
  },

  // ── Phase E: 成绩分析 ──
  // ── Phase G: 数据导入导出 ──
  data: {
    importLogs: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return request<{ items: any[]; total: number }>(`/data/import/logs${qs}`);
    },
    exportLogs: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return request<{ items: any[]; total: number }>(`/data/export/logs${qs}`);
    },
  },

  examAnalysis: {
    overview: (examId: number) => request<any>(`/exams/${examId}/analysis/overview`),
    distribution: (examId: number) => request<any>(`/exams/${examId}/analysis/distribution`),
    questionAccuracy: (examId: number) => request<any>(`/exams/${examId}/analysis/question-accuracy`),

    // 质检报告
    qualityReport: (examId: number) => request<any>(`/exams/${examId}/quality-report`),
    questionDetail: (examId: number, questionId: number) =>
      request<any>(`/exams/${examId}/quality-report/question/${questionId}`),
  },

  // ── Phase F: 练习 ──
  practice: {
    questions: (params?: Record<string, string | number | boolean>) => {
      const qs = params ? '?' + new URLSearchParams(
        Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]))
      ).toString() : '';
      return request<any[]>(`/questions/practice${qs}`);
    },
    answer: (questionId: number) => request<any>(`/questions/practice/answer?questionId=${questionId}`),
    submit: (data: { questionId: number; answer: any }) =>
      request<any>('/questions/practice/submit', { method: 'POST', body: JSON.stringify(data) }),
    records: (params?: Record<string, string | number | boolean>) => {
      const qs = params ? '?' + new URLSearchParams(
        Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]))
      ).toString() : '';
      return request<{ total: number; items: any[] }>(`/questions/practice/records${qs}`);
    },
    stats: () => request<any>('/questions/practice/stats'),
    relatedChunks: (questionId: number) =>
      request<{ chunks: any[]; knowledgePoints: string[] }>(`/questions/practice/related-chunks/${questionId}`),
    favorite: {
      toggle: (questionId: number) =>
        request<any>('/questions/practice/favorite/toggle', {
          method: 'POST',
          body: JSON.stringify({ questionId }),
        }),
      ids: () => request<number[]>('/questions/practice/favorite/ids'),
      questions: (params?: Record<string, string | number | boolean>) => {
        const qs = params ? '?' + new URLSearchParams(
          Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]))
        ).toString() : '';
        return request<{ total: number; items: any[] }>(`/questions/practice/favorites${qs}`);
      },
    },
  },

  // ── 学时类型字典 ──
  learningHourTypes: {
    list: () => request<any[]>('/learning-hour-types'),
    listAll: () => request<any[]>('/learning-hour-types/all'),
    create: (data: any) => request<any>('/learning-hour-types', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) => request<any>(`/learning-hour-types/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: number) => request<any>(`/learning-hour-types/${id}`, { method: 'DELETE' }),
  },

  // ── 学时证明 ──
  learningHourCertificates: {
    apply: (programId: number) => request<any>('/learning-hour-certificates/apply', {
      method: 'POST', body: JSON.stringify({ programId }),
    }),
    preview: (programId: number, studentId?: number) => {
      const qs = studentId ? `?programId=${programId}&studentId=${studentId}` : `?programId=${programId}`;
      return request<any>(`/learning-hour-certificates/preview${qs}`);
    },
    my: () => request<any[]>('/learning-hour-certificates/my'),
    list: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return request<{ items: any[]; total: number }>(`/learning-hour-certificates${qs}`);
    },
    get: (id: number) => request<any>(`/learning-hour-certificates/${id}`),
    review: (id: number, action: string, note?: string) => request<any>(`/learning-hour-certificates/${id}/review`, {
      method: 'PATCH', body: JSON.stringify({ action, note }),
    }),
    revoke: (id: number, reason: string) => request<any>(`/learning-hour-certificates/${id}/revoke`, {
      method: 'PATCH', body: JSON.stringify({ reason }),
    }),
    pdf: (id: number) => `/api/learning-hour-certificates/${id}/pdf`,
    verify: (no: string) => request<any>(`/learning-hour-certificates/verify?no=${encodeURIComponent(no)}`),
  },

  // ── 公开科目列表（无需登录） ──
  subjectsPublic: async () => {
    const res = await fetch('/api/subjects/public');
    if (!res.ok) return [];
    return res.json();
  },

  // ── 机构管理 ──
  orgCodes: {
    getAbbreviations: () => request<any[]>('/org-codes/abbreviations'),
    createAbbreviation: (data: any) => request<any>('/org-codes/abbreviations', { method: 'POST', body: JSON.stringify(data) }),
    updateAbbreviation: (id: number, data: any) => request<any>(`/org-codes/abbreviations/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deleteAbbreviation: (id: number) => request<any>(`/org-codes/abbreviations/${id}`, { method: 'DELETE' }),
    getRules: () => request<any>('/org-codes/rules'),
    updateRules: (data: any) => request<any>('/org-codes/rules', { method: 'PUT', body: JSON.stringify(data) }),
    preview: (parentId: number | null, name: string) => request<{ code: string }>(`/org-codes/preview?parentId=${parentId || ''}&name=${encodeURIComponent(name)}`).then(r => r.code),
  },

  organizations: {
    list: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return request<any[]>(`/organizations${qs}`);
    },
    getTree: () => request<any[]>('/organizations/tree'),
    get: (id: number) => request<any>(`/organizations/${id}`),
    getDataScope: (id: number) => request<any>(`/organizations/${id}/data-scope`),
    getOrgUsers: (id: number) => request<any>(`/organizations/${id}/users`),
    create: (data: any) => request<any>('/organizations', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) => request<any>(`/organizations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    move: (id: number, newParentId: number | null) =>
      request<any>(`/organizations/${id}/move`, { method: 'PUT', body: JSON.stringify({ newParentId }) }),
    remove: (id: number) => request<any>(`/organizations/${id}`, { method: 'DELETE' }),
    importOrganizations: (rows: { name: string; parentName?: string; sortOrder?: number }[]) =>
      request<{ success: boolean; imported: number; skipped: number; errors: string[] }>(`/organizations/import`, {
        method: 'POST', body: JSON.stringify({ rows }),
      }),
    migrateStudents: (id: number, data: { targetOrgId: number; moveHours?: boolean; moveExams?: boolean }) =>
      request<any>(`/organizations/${id}/migrate-students`, { method: 'POST', body: JSON.stringify(data) }),
    updateCertConfig: (id: number, data: { certIssuerName?: string; certLogoUrl?: string; certFooterText?: string; sealUrl?: string; useFoxLearnSeal?: boolean }) =>
      request<any>(`/organizations/${id}/cert-config`, { method: 'PUT', body: JSON.stringify(data) }),
    uploadCertImage: (id: number, file: File, type: 'logo' | 'seal') => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', type);
      return request<{ url: string; fileName: string }>(`/organizations/${id}/cert-upload`, { method: 'POST', body: formData, headers: {} });
    },
  },

  // ── 用户个人资料 ──
  userProfile: {
    get: () => request<any>('/user/profile'),
    update: (data: any) => request<any>('/user/profile', { method: 'PUT', body: JSON.stringify(data) }),
    changePassword: (oldPassword: string, newPassword: string) =>
      request<any>('/user/password', { method: 'POST', body: JSON.stringify({ oldPassword, newPassword }) }),
  },

  // ── 附件管理 ──
  attachments: {
    findByUser: (userId: number, category?: string) => {
      const qs = category ? `?userId=${userId}&category=${category}` : `?userId=${userId}`;
      return request<any[]>(`/attachments${qs}`);
    },
    upload: (formData: FormData) =>
      fetch('/api/attachments/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: formData,
      }).then(r => r.json()),
    download: (id: number) =>
      fetch(`/api/attachments/${id}/file`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      }).then(r => r.blob()),
    remove: (id: number) => request<any>(`/attachments/${id}`, { method: 'DELETE' }),
    verify: (id: number) => request<any>(`/attachments/${id}/verify`, { method: 'POST' }),
  },

  // ── 知识图谱 ──
  knowledgePoints: {
    getTree: (subjectId?: number) => request<any[]>(subjectId ? `/knowledge-points?subjectId=${subjectId}` : '/knowledge-points'),
    getOne: (id: number) => request<any>(`/knowledge-points/${id}`),
    create: (data: any) => request<any>('/knowledge-points', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) => request<any>(`/knowledge-points/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    remove: (id: number) => request<any>(`/knowledge-points/${id}`, { method: 'DELETE' }),
    getQuestionKPs: (questionId: number) => request<any[]>(`/questions/${questionId}/knowledge-points`),
    setQuestionKPs: (questionId: number, knowledgePointIds: number[]) =>
      request<any>(`/questions/${questionId}/knowledge-points`, {
        method: 'PATCH', body: JSON.stringify({ knowledgePointIds }),
      }),
  },

  // ── 系统配置（题库策略+通用配置）──
  systemConfig: {
    bankPolicy: {
      get: () => request<{ allow_org_own_bank: boolean; org_bank_visibility: string }>(
        '/system-config/bank-policy'
      ),
      update: (data: { allow_org_own_bank?: boolean; org_bank_visibility?: string }) =>
        request<{ allow_org_own_bank: boolean; org_bank_visibility: string }>(
          '/system-config/bank-policy',
          { method: 'PUT', body: JSON.stringify(data) }
        ),
    },
    certPolicy: {
      get: () => request<{ cert_org_self_issue: boolean; cert_approval_required: boolean; cert_seal_mode: string }>(
        '/system-config/cert-policy'
      ),
      update: (data: { cert_org_self_issue?: boolean; cert_approval_required?: boolean; cert_seal_mode?: string }) =>
        request<{ cert_org_self_issue: boolean; cert_approval_required: boolean; cert_seal_mode: string }>(
          '/system-config/cert-policy',
          { method: 'PUT', body: JSON.stringify(data) }
        ),
    },
    getAll: () => request<Record<string, any[]>>('/system-config'),
    getByGroup: (group: string) => request<any[]>(`/system-config/${group}`),
    update: (key: string, value: string) => request<any>(`/system-config/${key}`, {
      method: 'PATCH', body: JSON.stringify({ value }),
    }),
    batchUpdate: (items: { key: string; value: string }[]) => request<any>('/system-config/batch-update', {
      method: 'POST', body: JSON.stringify({ items }),
    }),
  },
};
