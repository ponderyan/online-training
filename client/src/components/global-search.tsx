'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Fuse from 'fuse.js';
import { Search, CornerDownLeft, X } from 'lucide-react';

interface SearchItem {
  path: string;
  label: string;
  group: string;
  keywords?: string;
}

const SEARCH_INDEX: SearchItem[] = [
  // 工作台
  { path: '/dashboard', label: '工作台', group: '工作台', keywords: '首页 概览' },
  { path: '/my/profile', label: '个人中心', group: '工作台', keywords: '账户 设置' },
  { path: '/notifications', label: '消息通知', group: '工作台', keywords: '通知 消息' },
  { path: '/admin/dashboard', label: '统计看板', group: '工作台', keywords: '数据 图表 运营' },
  // 培训管理
  { path: '/programs', label: '培训班管理', group: '培训管理', keywords: '班级 培训' },
  { path: '/courses', label: '课程管理', group: '培训管理', keywords: '课件 课程' },
  { path: '/admin/video-courses', label: '视频课程', group: '培训管理', keywords: '视频 录播' },
  { path: '/instructors', label: '讲师管理', group: '培训管理', keywords: '老师 教师' },
  { path: '/students', label: '学员管理', group: '培训管理', keywords: '学生 用户' },
  { path: '/agencies', label: '招生机构', group: '培训管理', keywords: '渠道 代理' },
  { path: '/admin/learning-hours', label: '学时管理', group: '培训管理', keywords: '课时 学时' },
  // 考务管理
  { path: '/questions', label: '题库管理', group: '考务管理', keywords: '试题 题目 出题' },
  { path: '/admin/subjects', label: '科目管理', group: '考务管理', keywords: '学科' },
  { path: '/admin/knowledge-points', label: '知识点管理', group: '考务管理', keywords: '知识 考点' },
  { path: '/materials', label: '教材出题', group: '考务管理', keywords: '教材 导入' },
  { path: '/generate', label: '智能组卷', group: '考务管理', keywords: 'AI 自动 生成试卷' },
  { path: '/papers', label: '试卷管理', group: '考务管理', keywords: '考卷' },
  { path: '/exams', label: '考试管理', group: '考务管理', keywords: '考场 在线考试' },
  { path: '/proctoring', label: '监考中心', group: '考务管理', keywords: '监控 防作弊' },
  { path: '/grading', label: '阅卷中心', group: '考务管理', keywords: '批改 评分' },
  // 认证管理
  { path: '/certificates', label: '证书管理', group: '认证管理', keywords: '结业证 荣誉' },
  { path: '/admin/certificate-templates', label: '证书模板', group: '认证管理', keywords: '设计 模板' },
  { path: '/evaluations', label: '评价管理', group: '认证管理', keywords: '反馈 评分' },
  { path: '/admin/learning-hour-certificates', label: '学时证明', group: '认证管理', keywords: '证明 学时' },
  // 系统管理
  { path: '/admin/organizations', label: '组织管理', group: '系统管理', keywords: '机构 部门' },
  { path: '/admin/system-config', label: '配置中心', group: '系统管理', keywords: '参数 设置' },
  { path: '/admin/ai-configs', label: 'AI 配置', group: '系统管理', keywords: '大模型 GPT' },
  { path: '/admin/audit-trail', label: '全链审计', group: '系统管理', keywords: '日志 追踪' },
  { path: '/accounts', label: '账户管理', group: '权限中心', keywords: '用户 账号' },
  { path: '/permissions', label: '权限管理', group: '权限中心', keywords: '角色 授权' },
];

export function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const fuse = useMemo(() => new Fuse(SEARCH_INDEX, {
    keys: ['label', 'keywords', 'group'],
    threshold: 0.4,
    includeScore: true,
  }), []);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    return fuse.search(query.trim()).slice(0, 8).map(r => r.item);
  }, [query, fuse]);

  // 键盘快捷键 Cmd/Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === 'Escape') {
        setOpen(false);
        inputRef.current?.blur();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // 点击外部关闭
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const navigate = (path: string) => {
    router.push(path);
    setQuery('');
    setOpen(false);
    inputRef.current?.blur();
  };

  return (
    <div ref={containerRef} className="relative hidden md:block">
      <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--ink-300)] pointer-events-none z-10" />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="搜索功能… ⌘K"
        className="pl-8 pr-3 py-1.5 text-xs rounded-md border border-[var(--ink-100)] bg-[var(--paper)] text-[var(--ink-700)] placeholder:text-[var(--ink-300)] focus:border-[var(--fox)] focus:ring-1 focus:ring-[var(--fox)]/10 outline-none w-52 transition-all focus:w-72"
      />
      {open && query.trim() && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--paper-bright)] border border-[var(--ink-100)] rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
          {results.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-[var(--ink-300)]">
              未找到匹配的功能
            </div>
          ) : (
            <div className="py-1">
              {results.map(item => (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-[var(--fox-pale)] transition-colors bg-transparent border-none cursor-pointer"
                >
                  <div>
                    <span className="text-sm text-[var(--ink-700)]">{item.label}</span>
                    <span className="text-[10px] ml-2 text-[var(--ink-300)]">{item.group}</span>
                  </div>
                  <CornerDownLeft size={12} className="text-[var(--ink-200)]" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
