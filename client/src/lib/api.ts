const BASE = '/api';

// 开发模式下视频流/上传直连后端（Next.js 代理对 Range/大 body 支持有限）
export const API_STREAM_BASE = typeof window !== 'undefined' && window.location.hostname === 'localhost'
  ? 'http://localhost:3001'
  : '';

/** 从 localStorage 获取 JWT token */
function getToken(): string | null {
  if (typeof window === 'undefined') return null; // SSR guard
  return localStorage.getItem('token');
}

/** 跳转到登录页 */
function redirectToLogin() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/login';
}

async function request<T = any>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  };

  // 自动带 JWT（FormData 类型会让浏览器自己设 Content-Type）
  if (token && !(options?.body instanceof FormData)) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
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
    // 保存 token + 用户信息
    localStorage.setItem('token', data.accessToken);
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
    },
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
    removeRoleUser: (roleId: number, assignmentId: number) =>
      request<any>(`/permissions/roles/${roleId}/users/${assignmentId}`, { method: 'DELETE' }),
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
  },

  // ── Phase 2: 视频课程（独立实体） ──
  videoCourses: {
    list: (params?: { page?: number; pageSize?: number; type?: string; keyword?: string; status?: string }) => {
      const qp: Record<string, string> = {};
      if (params?.page) qp.page = params.page.toString();
      if (params?.pageSize) qp.pageSize = params.pageSize.toString();
      if (params?.type) qp.type = params.type;
      if (params?.status) qp.status = params.status;
      if (params?.keyword) qp.keyword = params.keyword;
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
    list: (params?: { programId?: number; source?: string }) => {
      const qs = params ? '?' + new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([_, v]) => v !== undefined)) as any).toString() : '';
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
    submit: (data: { studentId: number; programId?: number; hours: number; source?: string; evidenceUrl?: string; note?: string }) =>
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
    create: (data: any) => request<any>('/evaluations', { method: 'POST', body: JSON.stringify(data) }),
    byProgram: (programId: number) => request<any[]>(`/evaluations/program/${programId}`),
    programStats: (programId: number) => request<any>(`/evaluations/program/${programId}/stats`),
    my: (studentId: number) => request<any[]>(`/evaluations/my?studentId=${studentId}`),
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
    listDocuments: (params?: { page?: number; pageSize?: number; search?: string }) => {
      const qp: Record<string, string> = {};
      if (params?.page) qp.page = params.page.toString();
      if (params?.pageSize) qp.pageSize = params.pageSize.toString();
      if (params?.search) qp.search = params.search;
      const qs = Object.keys(qp).length ? '?' + new URLSearchParams(qp).toString() : '';
      return request<{ items: any[]; total: number }>(`/knowledge/documents${qs}`);
    },
    deleteDocument: (source: string) =>
      request(`/knowledge/documents/${encodeURIComponent(source)}`, { method: 'DELETE' }),
    queryPlaceholder: () =>
      request<{ success: boolean; message: string }>('/knowledge/query', { method: 'POST' }),
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

  // ── 公开科目列表（无需登录） ──
  subjectsPublic: async () => {
    const res = await fetch('/api/subjects/public');
    if (!res.ok) return [];
    return res.json();
  },

  // ── 机构管理 ──
  organizations: {
    list: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return request<any[]>(`/organizations${qs}`);
    },
    get: (id: number) => request<any>(`/organizations/${id}`),
    create: (data: any) => request<any>('/organizations', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) => request<any>(`/organizations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id: number) => request<any>(`/organizations/${id}`, { method: 'DELETE' }),
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
};
