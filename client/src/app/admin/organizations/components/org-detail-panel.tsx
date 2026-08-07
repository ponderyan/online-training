'use client';

import { OrgNode, DataScope, OrgUsers, LEVEL_LABELS } from '../lib';
import CertImageUploader from './cert-image-uploader';

interface OrgDetailPanelProps {
  node: OrgNode;
  dataScope: DataScope | null;
  orgUsers: OrgUsers | null;
  orgAgencies: any[];
  certConfig: { certIssuerName?: string; certLogoUrl?: string; certFooterText?: string; sealUrl?: string; useFoxLearnSeal?: boolean } | null;
  certSaving: boolean;
  certUploading: 'logo' | 'seal' | null;
  onCreate: (parent: OrgNode | null) => void;
  onEdit: (org: OrgNode) => void;
  onDelete: (org: OrgNode) => void;
  onMigrate: (org: OrgNode) => void;
  onCertConfigChange: (config: any) => void;
  onCertSave: () => void;
  onCertUpload: (type: 'logo' | 'seal', file: File) => void;
}

function ScopeStat({ label, value, suffix, hint }: { label: string; value: number; suffix?: string; hint?: string }) {
  return (
    <div className="rounded-lg p-3 bg-[var(--paper)]" style={{  border: '1px solid var(--ink-100)' }}>
      <div className="text-[var(--ink-400)] text-xs mb-1">{label}</div>
      <div className="text-[var(--ink-700)] text-xl font-bold">
        {value}<span className="text-[var(--ink-300)] text-xs font-normal ml-0.5">{suffix}</span>
      </div>
      {hint && <div className="text-[var(--ink-300)] text-[10px] mt-1">{hint}</div>}
    </div>
  );
}

/** 组织详情面板（右侧） */
export default function OrgDetailPanel({ node, dataScope, orgUsers, orgAgencies, certConfig, certSaving, certUploading, onCreate, onEdit, onDelete, onMigrate, onCertConfigChange, onCertSave, onCertUpload }: OrgDetailPanelProps) {
  return (
    <div className="space-y-5">
      {/* 组织信息 */}
      <div className="card p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[var(--ink-700)] font-bold text-base">{node.name}</h2>
              <span className="tag tag-ink text-[10px]">{node.code}</span>
              <span className="tag text-[10px] bg-[var(--fox-pale)] text-[var(--fox-dark)]" >
                {LEVEL_LABELS[node.level] || `Level ${node.level}`}
              </span>
            </div>
            <div className="text-[var(--ink-400)] flex gap-4 mt-2 text-xs">
              <span>👥 {node.userCount} 用户</span>
              <span>📋 {node.programCount} 培训班</span>
              <span>🏢 {node.childOrgCount} 下级组织</span>
              {node.contactName && <span>📞 {node.contactName}</span>}
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={() => onCreate(node)} className="btn btn-ghost btn-xs">+ 子组织</button>
            <button onClick={() => onMigrate(node)} className="btn btn-ghost btn-xs">🔄 迁移学员</button>
            <button onClick={() => onEdit(node)} className="btn btn-ghost btn-xs">编辑</button>
            <button onClick={() => onDelete(node)} className="btn btn-ghost btn-xs text-[var(--verm)]" >删除</button>
          </div>
        </div>
      </div>

      {/* 数据范围预览 */}
      <div className="card p-5">
        <h3 className="section-title">📊 数据范围预览</h3>
        {dataScope ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <ScopeStat label="下属组织" value={dataScope.descendantCount} suffix="个" hint={`含自身共 ${dataScope.orgCount} 个`} />
            <ScopeStat label="可见考试" value={dataScope.examCount} suffix="场" />
            <ScopeStat label="可见学员" value={dataScope.studentCount} suffix="人" />
            <ScopeStat label="可见培训班" value={dataScope.programCount} suffix="个" />
            <ScopeStat label="可见证书" value={dataScope.certCount} suffix="张" />
            <ScopeStat label="招生机构" value={dataScope.agencyCount} suffix="个" />
          </div>
        ) : (
          <div className="text-[var(--ink-300)] text-xs py-4 text-center">加载中…</div>
        )}
      </div>

      {/* 用户列表 */}
      <div className="card p-5">
        <h3 className="section-title">👥 该组织用户（{orgUsers?.total ?? 0} 人）</h3>
        {orgUsers ? (
          orgUsers.groups.length === 0 ? (
            <div className="text-[var(--ink-300)] text-xs py-6 text-center">暂无用户</div>
          ) : (
            <div className="space-y-3">
              {orgUsers.groups.map(g => (
                <div key={g.roleCode} className="rounded-lg p-3 bg-[var(--paper)]" style={{  border: '1px solid var(--ink-100)' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: g.color || 'var(--ink-300)' }} />
                    <span className="text-[var(--ink-600)] text-xs font-medium">{g.roleName}</span>
                    <span className="text-[var(--ink-300)] text-[10px]">({g.users.length} 人)</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {g.users.map(u => (
                      <span key={u.id} className="text-xs px-2 py-1 rounded bg-[var(--paper-dark)] text-[var(--ink-500)]" >
                        {u.displayName} <span className="text-[var(--ink-300)]">({u.username})</span>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="text-[var(--ink-300)] text-xs py-4 text-center">加载中…</div>
        )}
      </div>

      {/* 下属招生机构 */}
      <div className="card p-5">
        <h3 className="section-title">🏢 下属招生机构（{orgAgencies.length} 个）</h3>
        {orgAgencies.length === 0 ? (
          <div className="text-[var(--ink-300)] text-xs py-6 text-center">该组织下暂无招生机构</div>
        ) : (
          <div className="space-y-2 mt-2">
            {orgAgencies.map((a: any) => (
              <div key={a.id} className="flex items-center justify-between rounded-lg px-3 py-2 bg-[var(--paper)]" style={{  border: '1px solid var(--ink-100)' }}>
                <div className="flex items-center gap-2">
                  <span className="text-[var(--ink-600)] text-sm font-medium">{a.name}</span>
                  {a.shortName && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--paper-dark)] text-[var(--ink-400)]" >{a.shortName}</span>}
                  <span className={`tag ${a.isActive ? 'tag-cyan' : 'tag-ink'} text-[10px]`}>{a.isActive ? '启用' : '停用'}</span>
                </div>
                <div className="text-[var(--ink-400)] flex items-center gap-3 text-xs">
                  {a.contactPerson && <span>👤 {a.contactPerson}</span>}
                  <span>👥 {a._count?.primaryStudents ?? 0} 学员</span>
                  <span>📋 {a._count?.enrollments ?? 0} 招生</span>
                </div>
              </div>
            ))}
            <div className="text-right mt-2">
              <a href="/agencies" className="text-[var(--fox-dark)] text-xs">前往招生机构管理 →</a>
            </div>
          </div>
        )}
      </div>

      {/* 证书配置 */}
      <div className="card p-5">
        <h3 className="section-title">📜 证书配置</h3>
        {certConfig ? (
          <div className="space-y-4 mt-3">
            <div>
              <label className="text-[var(--ink-500)] block text-xs font-medium mb-1">签发单位名称</label>
              <input value={certConfig.certIssuerName || ''} onChange={e => onCertConfigChange({ ...certConfig, certIssuerName: e.target.value })}
                className="input text-sm" placeholder="如：XX省数智化协会" />
            </div>
            <CertImageUploader label="机构 Logo" hint="建议 PNG 透明底 · 尺寸 ≥ 200×80px · ≤ 2MB"
              value={certConfig.certLogoUrl || ''} uploading={certUploading === 'logo'}
              onUpload={(file) => onCertUpload('logo', file)}
              onClear={() => onCertConfigChange({ ...certConfig, certLogoUrl: '' })}
              previewStyle={{ maxWidth: '160px', maxHeight: '48px' }} />
            <CertImageUploader label="电子印章" hint="建议 PNG 透明底正方形 · 尺寸 ≥ 240×240px · ≤ 2MB"
              value={certConfig.sealUrl || ''} uploading={certUploading === 'seal'}
              onUpload={(file) => onCertUpload('seal', file)}
              onClear={() => onCertConfigChange({ ...certConfig, sealUrl: '' })}
              previewStyle={{ width: '72px', height: '72px' }} round />
            <div>
              <label className="text-[var(--ink-500)] block text-xs font-medium mb-1">底部说明文字</label>
              <input value={certConfig.certFooterText || ''} onChange={e => onCertConfigChange({ ...certConfig, certFooterText: e.target.value })}
                className="input text-sm" placeholder="本证书最终解释权归..." />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={certConfig.useFoxLearnSeal ?? true}
                onChange={e => onCertConfigChange({ ...certConfig, useFoxLearnSeal: e.target.checked })}
                style={{ accentColor: 'var(--fox)' }} />
              <span className="text-[var(--ink-500)] text-xs">使用平台统一印章（忽略机构印章）</span>
            </div>
            <button disabled={certSaving} onClick={onCertSave} className="btn btn-fox btn-sm">{certSaving ? '保存中…' : '保存证书配置'}</button>
          </div>
        ) : (
          <div className="text-[var(--ink-300)] text-xs py-4 text-center">加载中…</div>
        )}
      </div>
    </div>
  );
}
