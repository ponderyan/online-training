'use client';

import { useEffect, useState, useCallback } from 'react';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';

// ── 事件类型 → 颜色 + 图标 ──
const EVENT_STYLE: Record<string, { color: string; bg: string; icon: string }> = {
  STATE_CHANGE: { color: '#2563eb', bg: 'rgba(37,99,235,0.10)', icon: '🔄' },
  ASSIGNMENT:   { color: '#00897b', bg: 'rgba(0,137,123,0.10)', icon: '👥' },
  SUBMISSION:   { color: '#7b1fa2', bg: 'rgba(123,31,162,0.10)', icon: '📝' },
  GRADING:      { color: '#c9a03a', bg: 'rgba(201,160,58,0.12)', icon: '✏️' },
  APPEAL:       { color: '#e87a30', bg: 'rgba(232,122,48,0.10)', icon: '⚖️' },
  SCORE_ADJUST: { color: '#e53935', bg: 'rgba(229,57,53,0.10)',  icon: '🔧' },
  CERT_ISSUE:   { color: '#00897b', bg: 'rgba(0,137,123,0.10)',  icon: '🎓' },
};

const ENTITY_LABELS: Record<string, string> = { EXAM: '考试', PROGRAM: '培训班' };

function can(permission: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const permsStr = localStorage.getItem('userPermissions');
    if (permsStr) {
      const permsData = JSON.parse(permsStr);
      if (permsData.isSuperAdmin) return true;
      return (permsData.permissions || []).includes(permission);
    }
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      if (user.isSuperAdmin) return true;
      return (user.permissions || []).includes(permission);
    }
  } catch {}
  return false;
}

export default function AuditTrailPage() {
  const hasPermission = can('auditLog:view');
  const [entityType, setEntityType] = useState<'EXAM' | 'PROGRAM'>('EXAM');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<any>(null);
  const [trail, setTrail] = useState<any>(null);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingTrail, setLoadingTrail] = useState(false);
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);

  // 实体搜索（防抖）
  useEffect(() => {
    if (!hasPermission) return;
    setLoadingSearch(true);
    const t = setTimeout(async () => {
      try {
        const data = await api.auditTrail.search(entityType, searchKeyword);
        setSearchResults(data.items || []);
      } catch { setSearchResults([]); }
      setLoadingSearch(false);
    }, 400);
    return () => clearTimeout(t);
  }, [entityType, searchKeyword, hasPermission]);

  // 加载时间线
  const loadTrail = useCallback(async (entity: any) => {
    setSelectedEntity(entity);
    setLoadingTrail(true);
    setExpandedEvent(null);
    try {
      const data = await api.auditTrail.getTrail(entityType, entity.id);
      setTrail(data);
    } catch { setTrail(null); }
    setLoadingTrail(false);
  }, [entityType]);

  if (!hasPermission) {
    return (
      <AppLayout>
        <div className="mb-6"><h1 className="page-title">🔍 全链审计</h1><p className="page-subtitle">业务实体生命周期追溯</p></div>
        <div className="card p-12 text-center">
          <p className="text-4xl mb-4">🔒</p>
          <p style={{ color: 'var(--ink-300)' }}>您没有查看审计日志的权限</p>
          <p className="text-xs mt-2" style={{ color: 'var(--ink-300)' }}>请联系管理员开通 auditLog:view 权限</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="page-title">🔍 全链审计</h1>
        <p className="page-subtitle">业务实体生命周期追溯 · 创建 → 状态流转 → 交卷判分 → 发证</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5">
        {/* ═══ 左侧：实体选择器 ═══ */}
        <div className="card p-4">
          {/* 实体类型切换 */}
          <div className="flex gap-1 mb-3 p-0.5 rounded-lg" style={{ background: 'var(--paper-dark)' }}>
            {(['EXAM', 'PROGRAM'] as const).map(t => (
              <button key={t} onClick={() => { setEntityType(t); setSelectedEntity(null); setTrail(null); }}
                className="flex-1 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer border-none"
                style={{ background: entityType === t ? 'var(--paper)' : 'transparent', color: entityType === t ? 'var(--fox)' : 'var(--ink-400)', boxShadow: entityType === t ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
                {ENTITY_LABELS[t]}
              </button>
            ))}
          </div>

          {/* 搜索框 */}
          <input value={searchKeyword} onChange={e => setSearchKeyword(e.target.value)}
            placeholder={`搜索${ENTITY_LABELS[entityType]}名称…`}
            className="input text-xs w-full mb-3" />

          {/* 搜索结果列表 */}
          <div className="space-y-1 max-h-[calc(100vh-280px)] overflow-y-auto">
            {loadingSearch ? (
              <p className="text-xs text-center py-4" style={{ color: 'var(--ink-300)' }}>加载中…</p>
            ) : searchResults.length === 0 ? (
              <p className="text-xs text-center py-4" style={{ color: 'var(--ink-300)' }}>暂无{ENTITY_LABELS[entityType]}</p>
            ) : (
              searchResults.map(entity => {
                const name = entity.title || entity.name;
                const isSelected = selectedEntity?.id === entity.id;
                return (
                  <button key={entity.id} onClick={() => loadTrail(entity)}
                    className="w-full text-left p-2.5 rounded-lg transition-all cursor-pointer border-[1.5px]"
                    style={{
                      background: isSelected ? 'var(--fox-glow)' : 'transparent',
                      borderColor: isSelected ? 'var(--fox)' : 'var(--ink-100)',
                    }}>
                    <div className="text-xs font-medium truncate" style={{ color: 'var(--ink-700)' }}>{name}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] font-mono" style={{ color: 'var(--ink-300)' }}>#{entity.id}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--paper-dark)', color: 'var(--ink-400)' }}>{entity.status}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ═══ 右侧：时间线 ═══ */}
        <div>
          {!selectedEntity ? (
            <div className="card p-12 text-center">
              <p className="text-4xl mb-4">👈</p>
              <p className="text-sm" style={{ color: 'var(--ink-400)' }}>请从左侧选择一个{ENTITY_LABELS[entityType]}查看完整生命周期</p>
            </div>
          ) : loadingTrail ? (
            <div className="card p-12 text-center"><p className="text-sm" style={{ color: 'var(--ink-300)' }}>正在加载时间线… 🦊</p></div>
          ) : !trail || trail.events.length === 0 ? (
            <div className="card p-12 text-center">
              <p className="text-4xl mb-4">📋</p>
              <p className="text-sm" style={{ color: 'var(--ink-300)' }}>{trail?.entityName || '该实体'} 暂无事件记录</p>
            </div>
          ) : (
            <div className="card p-5">
              {/* 实体标题 */}
              <div className="mb-5 pb-4 border-b" style={{ borderColor: 'var(--ink-100)' }}>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold m-0" style={{ color: 'var(--ink-700)' }}>{trail.entityName}</h2>
                  <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: 'var(--paper-dark)', color: 'var(--ink-400)' }}>#{trail.entityId}</span>
                </div>
                <p className="text-xs mt-1" style={{ color: 'var(--ink-400)' }}>共 {trail.events.length} 个事件 · 按时间倒序</p>
              </div>

              {/* 纵向时间线 */}
              <div className="relative pl-6">
                {/* 竖线 */}
                <div className="absolute left-[11px] top-2 bottom-2 w-0.5" style={{ background: 'var(--ink-100)' }} />

                {trail.events.map((event: any) => {
                  const style = EVENT_STYLE[event.eventType] || EVENT_STYLE.STATE_CHANGE;
                  const isExpanded = expandedEvent === event.id;
                  const hasDetail = event.detail || event.relatedAuditLogIds?.length > 0;
                  return (
                    <div key={event.id} className="relative mb-4 last:mb-0">
                      {/* 圆点 */}
                      <div className="absolute -left-6 top-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] border-2"
                        style={{ background: style.bg, borderColor: style.color }}>
                        {style.icon}
                      </div>

                      {/* 事件卡片 */}
                      <div className="rounded-lg p-3 transition-all" style={{ background: isExpanded ? style.bg : 'var(--paper-bright)', border: `1px solid ${isExpanded ? style.color : 'var(--ink-100)'}` }}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium" style={{ color: 'var(--ink-700)' }}>{event.eventName}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: style.bg, color: style.color }}>
                                {event.eventType}
                              </span>
                              {event.fromState && event.toState && (
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'var(--paper-dark)', color: 'var(--ink-400)' }}>
                                  {event.fromState} → {event.toState}
                                </span>
                              )}
                            </div>
                            <p className="text-xs mt-1" style={{ color: 'var(--ink-500)' }}>{event.summary}</p>
                          </div>
                          {hasDetail && (
                            <button onClick={() => setExpandedEvent(isExpanded ? null : event.id)}
                              className="text-[10px] bg-transparent border-none cursor-pointer whitespace-nowrap flex-shrink-0"
                              style={{ color: 'var(--fox)' }}>
                              {isExpanded ? '收起' : '详情'}
                            </button>
                          )}
                        </div>

                        {/* 元信息行 */}
                        <div className="flex items-center gap-3 mt-2 text-[10px]" style={{ color: 'var(--ink-300)' }}>
                          <span>🕐 {new Date(event.timestamp).toLocaleString('zh-CN')}</span>
                          <span>👤 {event.operatorName}</span>
                        </div>

                        {/* 展开详情 */}
                        {isExpanded && hasDetail && (
                          <div className="mt-3 pt-3 border-t space-y-2" style={{ borderColor: 'var(--ink-100)' }}>
                            {event.detail?.changeReason && (
                              <div className="text-xs">
                                <span style={{ color: 'var(--ink-400)' }}>变更原因：</span>
                                <span style={{ color: 'var(--verm)' }}>{event.detail.changeReason}</span>
                              </div>
                            )}
                            {event.detail?.fromScore !== undefined && event.detail?.toScore !== undefined && (
                              <div className="text-xs">
                                <span style={{ color: 'var(--ink-400)' }}>分数变化：</span>
                                <span className="font-mono">{event.detail.fromScore} → {event.detail.toScore}</span>
                                {event.detail.reason && <span style={{ color: 'var(--ink-400)' }}>（{event.detail.reason}）</span>}
                              </div>
                            )}
                            {event.detail?.before && event.detail?.after && (
                              <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                                <div>
                                  <div style={{ color: 'var(--ink-400)' }}>变更前：</div>
                                  <pre className="p-2 rounded overflow-auto max-h-32 mt-1" style={{ background: 'var(--paper-dark)' }}>
                                    {JSON.stringify(event.detail.before, null, 2)}
                                  </pre>
                                </div>
                                <div>
                                  <div style={{ color: 'var(--ink-400)' }}>变更后：</div>
                                  <pre className="p-2 rounded overflow-auto max-h-32 mt-1" style={{ background: 'var(--paper-dark)' }}>
                                    {JSON.stringify(event.detail.after, null, 2)}
                                  </pre>
                                </div>
                              </div>
                            )}
                            {event.relatedAuditLogIds?.length > 0 && (
                              <div className="text-[10px]" style={{ color: 'var(--ink-300)' }}>
                                关联审计日志 ID：{event.relatedAuditLogIds.join(', ')}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
