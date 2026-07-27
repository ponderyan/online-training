'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { validateTel, validateEmail, validateOrgCode } from '@/lib/validators';

// ── 组织树节点（与后端 OrgNode 对齐） ──
interface OrgNode {
  id: number;
  name: string;
  code: string;
  parentId: number | null;
  level: number;
  path: string | null;
  sortOrder: number;
  orgType?: string;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  isActive: boolean;
  userCount: number;
  programCount: number;
  childOrgCount: number;
  children: OrgNode[];
}

interface DataScope {
  orgCount: number;
  descendantCount: number;
  examCount: number;
  studentCount: number;
  programCount: number;
  certCount: number;
  agencyCount: number;
}

interface OrgUsers {
  total: number;
  groups: { roleId: number; roleName: string; roleCode: string; color: string | null; users: any[] }[];
}

const LEVEL_LABELS: Record<number, string> = { 1: 'Level 1', 2: 'Level 2', 3: 'Level 3', 4: 'Level 4' };
const ORG_TYPE_LABELS: Record<string, string> = { ASSOCIATION: '协会', BRANCH: '分会', DEPARTMENT: '部门' };
const ORG_TYPE_COLORS: Record<string, string> = { ASSOCIATION: '#7b1fa2', BRANCH: '#1565c0', DEPARTMENT: '#2e7d32' };

// ── 搜索高亮：匹配关键词部分加淡狐狸色背景 ──
function highlightText(text: string, keyword: string) {
  if (!keyword) return text;
  const idx = text.toLowerCase().indexOf(keyword.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.substring(0, idx)}
      <span style={{ background: 'rgba(232,125,48,0.15)', borderRadius: '2px', padding: '0 1px' }}>{text.substring(idx, idx + keyword.length)}</span>
      {text.substring(idx + keyword.length)}
    </>
  );
}

export default function OrganizationsPage() {
  const toast = useToast();
  const [tree, setTree] = useState<OrgNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState('');

  // 详情面板数据
  const [dataScope, setDataScope] = useState<DataScope | null>(null);
  const [orgUsers, setOrgUsers] = useState<OrgUsers | null>(null);

  // 弹窗
  const [showOrgModal, setShowOrgModal] = useState(false);
  const [editOrg, setEditOrg] = useState<OrgNode | null>(null);
  const [modalParent, setModalParent] = useState<OrgNode | null>(null); // 新建子组织时的父节点
  const [orgForm, setOrgForm] = useState({ name: '', code: '', contactName: '', contactPhone: '', contactEmail: '', orgType: 'BRANCH' });
  const [saving, setSaving] = useState(false);

  // 拖拽
  const [dragId, setDragId] = useState<number | null>(null);

  // 批量导入
  const [showImportModal, setShowImportModal] = useState(false);
  const [importRows, setImportRows] = useState<{ name: string; parentName?: string; sortOrder?: number }[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);

  // 迁移学员
  const [showMigrateModal, setShowMigrateModal] = useState(false);
  const [migrateSource, setMigrateSource] = useState<OrgNode | null>(null);
  const [migrateTargetId, setMigrateTargetId] = useState<number | null>(null);
  const [migrateOptions, setMigrateOptions] = useState({ moveHours: true, moveExams: false });
  const [migrating, setMigrating] = useState(false);

  // 证书配置
  const [certConfig, setCertConfig] = useState<{ certIssuerName?: string; certLogoUrl?: string; certFooterText?: string; sealUrl?: string; useFoxLearnSeal?: boolean } | null>(null);
  const [certSaving, setCertSaving] = useState(false);
  const [certUploading, setCertUploading] = useState<'logo' | 'seal' | null>(null);

  // 下属招生机构
  const [orgAgencies, setOrgAgencies] = useState<any[]>([]);

  const load = async () => {
    try {
      const data = await api.organizations.getTree();
      setTree(data || []);
      // 默认展开根节点
      if (data.length > 0) {
        setExpanded(prev => {
          const next = new Set(prev);
          data.forEach(d => next.add(d.id));
          return next;
        });
      }
    } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  // 选中节点 → 加载详情
  useEffect(() => {
    if (!selectedId) { setDataScope(null); setOrgUsers(null); setCertConfig(null); setOrgAgencies([]); return; }
    api.organizations.getDataScope(selectedId).then(setDataScope).catch(() => setDataScope(null));
    api.organizations.getOrgUsers(selectedId).then(setOrgUsers).catch(() => setOrgUsers(null));
    api.agencies.list({ organizationId: String(selectedId) }).then((d: any) => setOrgAgencies(d.items || [])).catch(() => setOrgAgencies([]));
    api.organizations.get(selectedId).then((org: any) => setCertConfig({
      certIssuerName: org.certIssuerName || '', certLogoUrl: org.certLogoUrl || '',
      certFooterText: org.certFooterText || '', sealUrl: org.sealUrl || '',
      useFoxLearnSeal: org.useFoxLearnSeal ?? true,
    })).catch(() => setCertConfig(null));
  }, [selectedId]);

  const selectedNode = useMemo(() => findNode(tree, selectedId), [tree, selectedId]);

  const toggleExpand = (id: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // 搜索过滤：保留匹配节点及其祖先链，并收集需展开的节点
  const { filteredTree, matchIds } = useMemo(() => {
    if (!search.trim()) return { filteredTree: tree, matchIds: new Set<number>() };
    const q = search.trim().toLowerCase();
    const matches = new Set<number>();
    const filterNode = (node: OrgNode): OrgNode | null => {
      const selfMatch = node.name.toLowerCase().includes(q) || node.code.toLowerCase().includes(q);
      const kids = node.children.map(filterNode).filter(Boolean) as OrgNode[];
      if (selfMatch || kids.length > 0) {
        if (selfMatch) matches.add(node.id);
        return { ...node, children: kids };
      }
      return null;
    };
    const result = tree.map(filterNode).filter(Boolean) as OrgNode[];
    return { filteredTree: result, matchIds: matches };
  }, [tree, search]);

  // 搜索时自动展开匹配节点所在的子树（含祖先链）
  useEffect(() => {
    if (!search.trim() || matchIds.size === 0) return;
    setExpanded(prev => {
      const next = new Set(prev);
      // 展开所有包含匹配节点的路径上的祖先
      const expandAncestors = (nodes: OrgNode[]): boolean => {
        let hasMatchInSubtree = false;
        for (const n of nodes) {
          const childHasMatch = expandAncestors(n.children);
          if (matchIds.has(n.id) || childHasMatch) {
            hasMatchInSubtree = true;
            if (n.children.length > 0) next.add(n.id); // 展开有匹配的祖先
          }
        }
        return hasMatchInSubtree;
      };
      expandAncestors(tree);
      return next;
    });
  }, [matchIds, tree, search]);

  // ── 新建/编辑组织 ──
  const openCreate = (parent: OrgNode | null) => {
    setEditOrg(null);
    setModalParent(parent);
    setOrgForm({ name: '', code: '', contactName: '', contactPhone: '', contactEmail: '', orgType: 'BRANCH' });
    setShowOrgModal(true);
  };
  const openEdit = (org: OrgNode) => {
    setEditOrg(org);
    setModalParent(null);
    setOrgForm({
      name: org.name, code: org.code,
      contactName: org.contactName || '', contactPhone: org.contactPhone || '', contactEmail: org.contactEmail || '',
      orgType: org.orgType || 'BRANCH',
    });
    setShowOrgModal(true);
  };

  const handleSaveOrg = async () => {
    if (!orgForm.name || (!editOrg && !orgForm.code)) { toast.warning('名称和编码不能为空'); return; }
    // 编码格式校验（仅新建时）
    if (!editOrg) {
      const codeErr = validateOrgCode(orgForm.code);
      if (codeErr) { toast.warning(codeErr); return; }
    }
    // 联系电话校验
    const telErr = validateTel(orgForm.contactPhone);
    if (telErr) { toast.warning(telErr); return; }
    // 邮箱校验
    const emailErr = validateEmail(orgForm.contactEmail);
    if (emailErr) { toast.warning(emailErr); return; }
    setSaving(true);
    try {
      if (editOrg) {
        await api.organizations.update(editOrg.id, {
          name: orgForm.name, contactName: orgForm.contactName, contactPhone: orgForm.contactPhone, contactEmail: orgForm.contactEmail,
          orgType: orgForm.orgType,
        });
      } else {
        await api.organizations.create({
          name: orgForm.name, code: orgForm.code, parentId: modalParent?.id || null,
          contactName: orgForm.contactName, contactPhone: orgForm.contactPhone, contactEmail: orgForm.contactEmail,
          orgType: orgForm.orgType,
        });
      }
      setShowOrgModal(false); setEditOrg(null); setModalParent(null);
      await load();
    } catch (e: any) { toast.error('保存失败：' + e.message); }
    setSaving(false);
  };

  const handleDelete = async (org: OrgNode) => {
    if (!confirm(`确认删除「${org.name}」？`)) return;
    try {
      await api.organizations.remove(org.id);
      if (selectedId === org.id) setSelectedId(null);
      await load();
    } catch (e: any) {
      toast.error(e.message || '删除失败');
    }
  };

  // ── 拖拽移动 ──
  const onDrop = async (target: OrgNode | null) => {
    if (dragId === null) return;
    const targetId = target?.id ?? null;
    if (dragId === targetId) { setDragId(null); return; }
    const moving = findNode(tree, dragId);
    if (!moving) { setDragId(null); return; }
    // 不能移到自己的子孙下
    if (target && moving.path && target.path && target.path.startsWith(moving.path)) {
      toast.warning('不能将组织移动到其下属组织下');
      setDragId(null);
      return;
    }
    const targetLabel = target ? `「${target.name}」下` : '根层级';
    if (!confirm(`将「${moving.name}」移动到${targetLabel}？`)) { setDragId(null); return; }
    try {
      await api.organizations.move(dragId, targetId);
      await load();
    } catch (e: any) {
      toast.error(e.message || '移动失败');
    }
    setDragId(null);
  };

  // ── 批量导入 ──
  const downloadTemplate = () => {
    import('xlsx').then(XLSX => {
      const ws = XLSX.utils.aoa_to_sheet([
        ['组织名称', '上级组织名称', '排序号'],
        ['示例部门', '', '1'],
        ['示例子部门', '示例部门', '1'],
      ]);
      ws['!cols'] = [{ wch: 24 }, { wch: 20 }, { wch: 10 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '组织导入');
      XLSX.writeFile(wb, '组织导入模板.xlsx');
    });
  };

  const handleImportFile = (file: File) => {
    import('xlsx').then(XLSX => {
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const wb = XLSX.read(data, { type: 'array' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const json: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
          // 跳过表头，从第2行开始
          const rows = json.slice(1)
            .filter(r => r[0] != null && String(r[0]).trim())
            .map(r => ({
              name: String(r[0] || '').trim(),
              parentName: r[1] != null ? String(r[1]).trim() : undefined,
              sortOrder: r[2] != null && r[2] !== '' ? Number(r[2]) : undefined,
            }));
          setImportRows(rows);
          setImportResult(null);
        } catch {
          toast.error('Excel 解析失败，请检查文件格式');
        }
      };
      reader.readAsArrayBuffer(file);
    });
  };

  const handleImport = async () => {
    if (importRows.length === 0) { toast.warning('没有可导入的数据'); return; }
    setImporting(true);
    try {
      const res = await api.organizations.importOrganizations(importRows);
      setImportResult({ imported: res.imported, skipped: res.skipped, errors: res.errors });
      if (res.imported > 0) {
        toast.success(`导入成功 ${res.imported} 个组织`);
        await load();
      } else {
        toast.warning('未导入任何组织');
      }
    } catch (e: any) {
      toast.error('导入失败：' + e.message);
    }
    setImporting(false);
  };

  // ── 迁移学员 ──
  const openMigrateModal = (org: OrgNode) => {
    setMigrateSource(org);
    setMigrateTargetId(null);
    setMigrateOptions({ moveHours: true, moveExams: false });
    setShowMigrateModal(true);
  };

  const handleMigrate = async () => {
    if (!migrateSource || !migrateTargetId) { toast.warning('请选择目标组织'); return; }
    if (migrateSource.id === migrateTargetId) { toast.warning('不能迁移到自身组织'); return; }
    if (!confirm(`确认将「${migrateSource.name}」及其下属组织的学员迁移到目标组织？`)) return;
    setMigrating(true);
    try {
      const res = await api.organizations.migrateStudents(migrateSource.id, {
        targetOrgId: migrateTargetId,
        moveHours: migrateOptions.moveHours,
        moveExams: migrateOptions.moveExams,
      });
      toast.success(`已迁移 ${res.migrated} 名学员到「${res.targetOrgName}」`);
      setShowMigrateModal(false);
      await load();
    } catch (e: any) {
      toast.error('迁移失败：' + e.message);
    }
    setMigrating(false);
  };

  if (loading) {
    return <AppLayout><div className="text-center py-16" style={{ color: 'var(--ink-300)' }}>小狐狸正在加载组织树… 🦊</div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="page-title">🏢 组织管理</h1>
          <p className="page-subtitle">多层级组织架构 · 拖拽可调整层级</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowImportModal(true)} className="btn btn-outline btn-sm">📥 导入</button>
          <button onClick={() => openCreate(null)} className="btn btn-fox btn-sm">➕ 新建根组织</button>
        </div>
      </div>

      <div className="flex gap-6" style={{ minHeight: 'calc(100vh - 200px)' }}>
        {/* 左：组织树 */}
        <div className="w-[360px] flex-shrink-0 flex flex-col">
          <div className="relative mb-3">
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="🔍 搜索组织名称/编码…" className="input text-xs" style={{ height: 32, paddingRight: search ? 28 : undefined }} />
            {search && (
              <button onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-transparent border-none cursor-pointer text-sm leading-none"
                style={{ color: 'var(--ink-300)' }} title="清除搜索">✕</button>
            )}
          </div>
          <div className="card flex-1 overflow-y-auto p-2"
            onDragOver={e => { e.preventDefault(); }}
            onDrop={e => { e.preventDefault(); onDrop(null); }}>
            {filteredTree.length === 0 ? (
              <div className="text-center py-12 text-xs" style={{ color: 'var(--ink-300)' }}>
                {search ? '未找到匹配组织' : '暂无组织，点击右上角新建'}
              </div>
            ) : (
              filteredTree.map(node => (
                <OrgNodeView key={node.id} node={node} depth={0}
                  selectedId={selectedId} expanded={expanded}
                  onSelect={setSelectedId} onToggle={toggleExpand}
                  onCreate={openCreate} onEdit={openEdit} onDelete={handleDelete}
                  dragId={dragId} setDragId={setDragId} onDrop={onDrop}
                  searchKeyword={search.trim()}
                />
              ))
            )}
          </div>
        </div>

        {/* 右：详情面板 */}
        <div className="flex-1 min-w-0 overflow-y-auto">
          {selectedNode ? (
            <div className="space-y-5">
              {/* 组织信息 */}
              <div className="card p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-bold text-base" style={{ color: 'var(--ink-700)' }}>{selectedNode.name}</h2>
                      <span className="tag tag-ink text-[10px]">{selectedNode.code}</span>
                      <span className="tag text-[10px]" style={{ background: 'var(--fox-pale)', color: 'var(--fox-dark)' }}>
                        {LEVEL_LABELS[selectedNode.level] || `Level ${selectedNode.level}`}
                      </span>
                    </div>
                    <div className="flex gap-4 mt-2 text-xs" style={{ color: 'var(--ink-400)' }}>
                      <span>👥 {selectedNode.userCount} 用户</span>
                      <span>📋 {selectedNode.programCount} 培训班</span>
                      <span>🏢 {selectedNode.childOrgCount} 下级组织</span>
                      {selectedNode.contactName && <span>📞 {selectedNode.contactName}</span>}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => openCreate(selectedNode)} className="btn btn-ghost btn-xs">+ 子组织</button>
                    <button onClick={() => openMigrateModal(selectedNode)} className="btn btn-ghost btn-xs">🔄 迁移学员</button>
                    <button onClick={() => openEdit(selectedNode)} className="btn btn-ghost btn-xs">编辑</button>
                    <button onClick={() => handleDelete(selectedNode)} className="btn btn-ghost btn-xs" style={{ color: 'var(--verm)' }}>删除</button>
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
                  <div className="text-xs py-4 text-center" style={{ color: 'var(--ink-300)' }}>加载中…</div>
                )}
              </div>

              {/* 用户列表（按角色分组） */}
              <div className="card p-5">
                <h3 className="section-title">👥 该组织用户（{orgUsers?.total ?? 0} 人）</h3>
                {orgUsers ? (
                  orgUsers.groups.length === 0 ? (
                    <div className="text-xs py-6 text-center" style={{ color: 'var(--ink-300)' }}>暂无用户</div>
                  ) : (
                    <div className="space-y-3">
                      {orgUsers.groups.map(g => (
                        <div key={g.roleCode} className="rounded-lg p-3" style={{ background: 'var(--paper)', border: '1px solid var(--ink-100)' }}>
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ background: g.color || '#8b8174' }} />
                            <span className="text-xs font-medium" style={{ color: 'var(--ink-600)' }}>{g.roleName}</span>
                            <span className="text-[10px]" style={{ color: 'var(--ink-300)' }}>({g.users.length} 人)</span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {g.users.map(u => (
                              <span key={u.id} className="text-xs px-2 py-1 rounded"
                                style={{ background: 'var(--paper-dark)', color: 'var(--ink-500)' }}>
                                {u.displayName} <span style={{ color: 'var(--ink-300)' }}>({u.username})</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  <div className="text-xs py-4 text-center" style={{ color: 'var(--ink-300)' }}>加载中…</div>
                )}
              </div>

              {/* 下属招生机构 */}
              <div className="card p-5">
                <h3 className="section-title">🏢 下属招生机构（{orgAgencies.length} 个）</h3>
                {orgAgencies.length === 0 ? (
                  <div className="text-xs py-6 text-center" style={{ color: 'var(--ink-300)' }}>该组织下暂无招生机构</div>
                ) : (
                  <div className="space-y-2 mt-2">
                    {orgAgencies.map((a: any) => (
                      <div key={a.id} className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: 'var(--paper)', border: '1px solid var(--ink-100)' }}>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium" style={{ color: 'var(--ink-600)' }}>{a.name}</span>
                          {a.shortName && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--paper-dark)', color: 'var(--ink-400)' }}>{a.shortName}</span>}
                          <span className={`tag ${a.isActive ? 'tag-cyan' : 'tag-ink'} text-[10px]`}>{a.isActive ? '启用' : '停用'}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--ink-400)' }}>
                          {a.contactPerson && <span>👤 {a.contactPerson}</span>}
                          <span>👥 {a._count?.primaryStudents ?? 0} 学员</span>
                          <span>📋 {a._count?.enrollments ?? 0} 招生</span>
                        </div>
                      </div>
                    ))}
                    <div className="text-right mt-2">
                      <a href="/agencies" className="text-xs" style={{ color: 'var(--fox-dark)' }}>前往招生机构管理 →</a>
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
                      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>签发单位名称</label>
                      <input value={certConfig.certIssuerName || ''} onChange={e => setCertConfig(prev => prev ? { ...prev, certIssuerName: e.target.value } : prev)}
                        className="input text-sm" placeholder="如：XX省数智化协会" />
                    </div>

                    {/* Logo 上传 */}
                    <CertImageUploader
                      label="机构 Logo"
                      hint="建议 PNG 透明底 · 尺寸 ≥ 200×80px · ≤ 2MB"
                      value={certConfig.certLogoUrl || ''}
                      uploading={certUploading === 'logo'}
                      onUpload={async (file) => {
                        if (!selectedId) return;
                        setCertUploading('logo');
                        try {
                          const res = await api.organizations.uploadCertImage(selectedId, file, 'logo');
                          setCertConfig(prev => prev ? { ...prev, certLogoUrl: res.url } : prev);
                          toast.success('Logo 已上传');
                        } catch (e: any) { toast.error('上传失败：' + (e.message || '')); }
                        setCertUploading(null);
                      }}
                      onClear={() => setCertConfig(prev => prev ? { ...prev, certLogoUrl: '' } : prev)}
                      previewStyle={{ maxWidth: '160px', maxHeight: '48px' }}
                    />

                    {/* 印章上传 */}
                    <CertImageUploader
                      label="电子印章"
                      hint="建议 PNG 透明底正方形 · 尺寸 ≥ 240×240px · ≤ 2MB"
                      value={certConfig.sealUrl || ''}
                      uploading={certUploading === 'seal'}
                      onUpload={async (file) => {
                        if (!selectedId) return;
                        setCertUploading('seal');
                        try {
                          const res = await api.organizations.uploadCertImage(selectedId, file, 'seal');
                          setCertConfig(prev => prev ? { ...prev, sealUrl: res.url } : prev);
                          toast.success('印章已上传');
                        } catch (e: any) { toast.error('上传失败：' + (e.message || '')); }
                        setCertUploading(null);
                      }}
                      onClear={() => setCertConfig(prev => prev ? { ...prev, sealUrl: '' } : prev)}
                      previewStyle={{ width: '72px', height: '72px' }}
                      round
                    />

                    <div>
                      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>底部说明文字</label>
                      <input value={certConfig.certFooterText || ''} onChange={e => setCertConfig(prev => prev ? { ...prev, certFooterText: e.target.value } : prev)}
                        className="input text-sm" placeholder="本证书最终解释权归..." />
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="checkbox" checked={certConfig.useFoxLearnSeal ?? true}
                        onChange={e => setCertConfig(prev => prev ? { ...prev, useFoxLearnSeal: e.target.checked } : prev)}
                        style={{ accentColor: '#e87a30' }} />
                      <span className="text-xs" style={{ color: 'var(--ink-500)' }}>使用平台统一印章（忽略机构印章）</span>
                    </div>
                    <button disabled={certSaving} onClick={async () => {
                      if (!selectedId || !certConfig) return;
                      setCertSaving(true);
                      try {
                        await api.organizations.updateCertConfig(selectedId, certConfig);
                        toast.success('证书配置已保存');
                      } catch (e: any) { toast.error('保存失败：' + (e.message || '')); }
                      setCertSaving(false);
                    }} className="btn btn-fox btn-sm">{certSaving ? '保存中…' : '保存证书配置'}</button>
                  </div>
                ) : (
                  <div className="text-xs py-4 text-center" style={{ color: 'var(--ink-300)' }}>加载中…</div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <p className="text-5xl mb-4">🏢</p>
                <p style={{ color: 'var(--ink-300)' }}>从左侧选择一个组织查看详情</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 新建/编辑组织 Modal */}
      {showOrgModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) { setShowOrgModal(false); setEditOrg(null); setModalParent(null); } }}>
          <div className="modal-card max-w-[460px] animate-fadeSlide">
            <div className="modal-header">
              <h3 className="font-serif font-bold text-base">
                {editOrg ? '编辑组织' : '新建组织'}
                {modalParent && <span className="text-xs font-normal ml-2" style={{ color: 'var(--ink-400)' }}>（父级：{modalParent.name}）</span>}
              </h3>
              <button onClick={() => { setShowOrgModal(false); setEditOrg(null); setModalParent(null); }}
                className="text-lg bg-transparent border-none cursor-pointer" style={{ color: 'var(--ink-300)' }}>✕</button>
            </div>
            <div className="modal-body space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>组织名称 *</label>
                  <input value={orgForm.name} onChange={e => {
                    const name = e.target.value;
                    const newForm = { ...orgForm, name };
                    setOrgForm(newForm);
                    // Phase 2: 后端自动生成编码预览（防抖）
                    if (!editOrg && name.length >= 2) {
                      clearTimeout((window as any).__orgCodeTimer);
                      (window as any).__orgCodeTimer = setTimeout(async () => {
                        try {
                          const code = await api.orgCodes.preview(modalParent?.id || null, name);
                          if (code) setOrgForm(prev => ({ ...prev, code }));
                        } catch {}
                      }, 400);
                    }
                  }} className="input" placeholder="如：符合性评估部" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>组织编码 *</label>
                  <input value={orgForm.code} onChange={e => setOrgForm({ ...orgForm, code: e.target.value.toUpperCase() })} className="input" placeholder="大写字母+数字+连字符，如 CEC-ITSS" disabled={!!editOrg} maxLength={20} />
                  {!editOrg && <p className="text-[10px] mt-0.5" style={{ color: 'var(--ink-300)' }}>自动生成，可手动覆盖。格式：大写字母+数字+连字符</p>}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>组织类型</label>
                <select value={orgForm.orgType} onChange={e => setOrgForm({ ...orgForm, orgType: e.target.value })} className="input select">
                  <option value="ASSOCIATION">协会（总会）</option>
                  <option value="BRANCH">分会</option>
                  <option value="DEPARTMENT">部门 / 业务线</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>联系人</label>
                <input value={orgForm.contactName} onChange={e => setOrgForm({ ...orgForm, contactName: e.target.value })} className="input" placeholder="联系人姓名" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>联系电话</label>
                  <input value={orgForm.contactPhone} onChange={e => setOrgForm({ ...orgForm, contactPhone: e.target.value.replace(/[^\d+\-\s]/g, '') })} className="input" placeholder="如 13800138000" maxLength={20} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>联系邮箱</label>
                  <input value={orgForm.contactEmail} onChange={e => setOrgForm({ ...orgForm, contactEmail: e.target.value.replace(/[^a-zA-Z0-9._%+@\-]/g, '') })} className="input" placeholder="邮箱" />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => { setShowOrgModal(false); setEditOrg(null); setModalParent(null); }} className="btn btn-ghost btn-sm">取消</button>
              <button onClick={handleSaveOrg} disabled={saving} className="btn btn-fox btn-sm">{saving ? '保存中…' : '保存'}</button>
            </div>
          </div>
        </div>
      )}

      {/* 批量导入组织 Modal */}
      {showImportModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) { setShowImportModal(false); setImportRows([]); setImportResult(null); } }}>
          <div className="modal-card max-w-[560px] animate-fadeSlide">
            <div className="modal-header">
              <h3 className="font-serif font-bold text-base">📥 批量导入组织</h3>
              <button onClick={() => { setShowImportModal(false); setImportRows([]); setImportResult(null); }}
                className="text-lg bg-transparent border-none cursor-pointer" style={{ color: 'var(--ink-300)' }}>✕</button>
            </div>
            <div className="modal-body space-y-4">
              <button onClick={downloadTemplate} className="btn btn-outline btn-sm">📥 下载导入模板</button>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>选择文件（支持 .xlsx / .xls，最大 2MB）</label>
                <input type="file" accept=".xlsx,.xls" className="input" style={{ padding: 6 }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) { if (f.size > 2 * 1024 * 1024) { toast.warning('文件不能超过 2MB'); return; } handleImportFile(f); } }} />
              </div>
              <div className="text-xs space-y-1 p-3 rounded-lg" style={{ background: 'var(--paper)', color: 'var(--ink-400)' }}>
                <div className="font-medium" style={{ color: 'var(--ink-500)' }}>导入说明：</div>
                <div>· 第一列：组织名称（必填）</div>
                <div>· 第二列：上级组织名称（可选，留空=根组织）</div>
                <div>· 第三列：排序号（可选）</div>
              </div>
              {/* 预览 */}
              {importRows.length > 0 && (
                <div>
                  <div className="text-xs font-medium mb-2" style={{ color: 'var(--ink-500)' }}>预览（前 5 行，共 {importRows.length} 行）</div>
                  <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--ink-100)' }}>
                    <table className="list-table">
                      <thead><tr><th>组织名称</th><th>上级组织</th><th>排序</th></tr></thead>
                      <tbody>
                        {importRows.slice(0, 5).map((r, i) => (
                          <tr key={i}><td>{r.name}</td><td className="text-xs">{r.parentName || '—'}</td><td>{r.sortOrder ?? '—'}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {/* 导入结果 */}
              {importResult && (
                <div className="p-3 rounded-lg" style={{ background: importResult.imported > 0 ? 'var(--sage-glow)' : 'var(--verm-glow)' }}>
                  <div className="text-sm font-medium mb-1" style={{ color: importResult.imported > 0 ? 'var(--sage)' : 'var(--verm)' }}>
                    导入 {importResult.imported} 个，跳过 {importResult.skipped} 个
                  </div>
                  {importResult.errors.length > 0 && (
                    <div className="text-xs space-y-0.5" style={{ color: 'var(--ink-500)' }}>
                      {importResult.errors.map((err, i) => <div key={i}>· {err}</div>)}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button onClick={() => { setShowImportModal(false); setImportRows([]); setImportResult(null); }} className="btn btn-ghost btn-sm">取消</button>
              <button onClick={handleImport} disabled={importing || importRows.length === 0} className="btn btn-fox btn-sm">
                {importing ? '导入中…' : `导入 ${importRows.length} 行`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 迁移学员 Modal */}
      {showMigrateModal && migrateSource && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowMigrateModal(false); }}>
          <div className="modal-card max-w-[520px] animate-fadeSlide" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="font-serif font-bold text-base">🔄 迁移学员</h3>
              <button onClick={() => setShowMigrateModal(false)}
                className="text-lg bg-transparent border-none cursor-pointer" style={{ color: 'var(--ink-300)' }}>✕</button>
            </div>
            <div className="modal-body space-y-4">
              <div className="p-3 rounded-lg" style={{ background: 'var(--paper)' }}>
                <div className="text-xs" style={{ color: 'var(--ink-400)' }}>从</div>
                <div className="text-sm font-medium" style={{ color: 'var(--ink-700)' }}>{migrateSource.name}</div>
                <div className="text-xs mt-1" style={{ color: 'var(--ink-300)' }}>
                  当前学员数：{orgUsers?.total ?? '加载中…'} 人（含下属组织）
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>迁移到</label>
                <div className="rounded-lg p-2 max-h-[240px] overflow-y-auto" style={{ border: '1px solid var(--ink-100)', background: 'var(--paper-bright)' }}>
                  {tree.map(node => (
                    <MigrateOrgPicker key={node.id} node={node} depth={0}
                      selectedId={migrateTargetId} onSelect={setMigrateTargetId}
                      excludeId={migrateSource.id}
                    />
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-xs font-medium" style={{ color: 'var(--ink-500)' }}>迁移选项</div>
                <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: 'var(--ink-600)' }}>
                  <input type="checkbox" checked={migrateOptions.moveHours}
                    onChange={e => setMigrateOptions({ ...migrateOptions, moveHours: e.target.checked })}
                    className="accent-[var(--fox)]" />
                  ☑ 学时记录随学员迁移（通过学员关联自动归属）
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: 'var(--ink-600)' }}>
                  <input type="checkbox" checked={migrateOptions.moveExams}
                    onChange={e => setMigrateOptions({ ...migrateOptions, moveExams: e.target.checked })}
                    className="accent-[var(--fox)]" />
                  考试记录随学员迁移（通过学员关联自动归属）
                </label>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowMigrateModal(false)} className="btn btn-ghost btn-sm">取消</button>
              <button onClick={handleMigrate} disabled={migrating || !migrateTargetId} className="btn btn-fox btn-sm">
                {migrating ? '迁移中…' : '确认迁移'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

// ── 递归树节点组件 ──
function OrgNodeView({ node, depth, selectedId, expanded, onSelect, onToggle, onCreate, onEdit, onDelete, dragId, setDragId, onDrop, searchKeyword }: {
  node: OrgNode; depth: number;
  selectedId: number | null;
  expanded: Set<number>;
  onSelect: (id: number) => void;
  onToggle: (id: number) => void;
  onCreate: (parent: OrgNode | null) => void;
  onEdit: (org: OrgNode) => void;
  onDelete: (org: OrgNode) => void;
  dragId: number | null;
  setDragId: (id: number | null) => void;
  onDrop: (target: OrgNode | null) => void;
  searchKeyword?: string;
}) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expanded.has(node.id);
  const isSelected = selectedId === node.id;
  const isDragging = dragId === node.id;

  return (
    <div>
      <div
        draggable
        onDragStart={() => setDragId(node.id)}
        onDragEnd={() => setDragId(null)}
        onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
        onDrop={e => { e.preventDefault(); e.stopPropagation(); onDrop(node); }}
        onClick={() => onSelect(node.id)}
        className="flex items-center gap-1.5 px-2 py-2 rounded-lg cursor-pointer transition-all group"
        style={{
          marginLeft: depth * 16,
          background: isSelected ? 'var(--fox-pale)' : 'transparent',
          border: isSelected ? '1px solid var(--fox)' : '1px solid transparent',
          opacity: isDragging ? 0.4 : 1,
        }}
      >
        <button onClick={e => { e.stopPropagation(); if (hasChildren) onToggle(node.id); }}
          className="w-4 h-4 flex items-center justify-center text-[10px] bg-transparent border-none cursor-pointer flex-shrink-0"
          style={{ color: 'var(--ink-400)', visibility: hasChildren ? 'visible' : 'hidden' }}>
          {isExpanded ? '▼' : '▶'}
        </button>
        <span className="text-sm font-medium truncate flex-1" style={{ color: isSelected ? 'var(--fox-dark)' : 'var(--ink-600)' }}>
          {highlightText(node.name, searchKeyword || '')}
        </span>
        <span className="tag text-[9px] flex-shrink-0" style={{ background: 'var(--paper-dark)', color: ORG_TYPE_COLORS[node.orgType || ''] || 'var(--ink-400)' }}>
          {ORG_TYPE_LABELS[node.orgType || ''] || LEVEL_LABELS[node.level] || `L${node.level}`}
        </span>
        <span className="text-[9px] flex-shrink-0" style={{ color: 'var(--ink-300)' }}>
          {node.childOrgCount > 0 && `🏢${node.childOrgCount}`}
          {node.userCount > 0 && ` 👥${node.userCount}`}
        </span>
        {/* 悬停操作 */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button onClick={e => { e.stopPropagation(); onCreate(node); }}
            className="text-[10px] bg-transparent border-none cursor-pointer px-1" style={{ color: 'var(--ink-300)' }} title="新建子组织">＋</button>
          <button onClick={e => { e.stopPropagation(); onEdit(node); }}
            className="text-[10px] bg-transparent border-none cursor-pointer px-1" style={{ color: 'var(--ink-300)' }} title="编辑">✏️</button>
          <button onClick={e => { e.stopPropagation(); onDelete(node); }}
            className="text-[10px] bg-transparent border-none cursor-pointer px-1" style={{ color: 'var(--verm)' }} title="删除">🗑️</button>
        </div>
      </div>
      {hasChildren && isExpanded && (
        <div>
          {node.children.map(child => (
            <OrgNodeView key={child.id} node={child} depth={depth + 1}
              selectedId={selectedId} expanded={expanded}
              onSelect={onSelect} onToggle={onToggle}
              onCreate={onCreate} onEdit={onEdit} onDelete={onDelete}
              dragId={dragId} setDragId={setDragId} onDrop={onDrop}
              searchKeyword={searchKeyword}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── 数据范围统计小卡片 ──
function ScopeStat({ label, value, suffix, hint }: { label: string; value: number; suffix?: string; hint?: string }) {
  return (
    <div className="rounded-lg p-3" style={{ background: 'var(--paper)', border: '1px solid var(--ink-100)' }}>
      <div className="text-xs mb-1" style={{ color: 'var(--ink-400)' }}>{label}</div>
      <div className="text-xl font-bold" style={{ color: 'var(--ink-700)' }}>
        {value}<span className="text-xs font-normal ml-0.5" style={{ color: 'var(--ink-300)' }}>{suffix}</span>
      </div>
      {hint && <div className="text-[10px] mt-1" style={{ color: 'var(--ink-300)' }}>{hint}</div>}
    </div>
  );
}

// ── 工具：在树中按 id 查找节点 ──
function findNode(nodes: OrgNode[], id: number | null): OrgNode | null {
  if (id === null) return null;
  for (const n of nodes) {
    if (n.id === id) return n;
    const found = findNode(n.children, id);
    if (found) return found;
  }
  return null;
}

// ── 迁移弹窗：组织选择器（排除源组织及其子孙，防止环） ──
function MigrateOrgPicker({ node, depth, selectedId, onSelect, excludeId }: {
  node: OrgNode; depth: number;
  selectedId: number | null;
  onSelect: (id: number) => void;
  excludeId: number;
}) {
  // 排除源组织本身（子孙通过 path 已被排除，这里简单按 id 排除自身）
  if (node.id === excludeId) return null;
  const isSelected = selectedId === node.id;
  return (
    <div>
      <div onClick={() => onSelect(node.id)}
        className="flex items-center gap-1.5 px-2 py-1.5 rounded cursor-pointer transition-colors"
        style={{ marginLeft: depth * 16, background: isSelected ? 'var(--fox-pale)' : 'transparent' }}>
        <span className="text-xs" style={{ color: isSelected ? 'var(--fox-dark)' : 'var(--ink-600)' }}>{node.name}</span>
        {isSelected && <span className="text-[10px]" style={{ color: 'var(--fox)' }}>✓</span>}
      </div>
      {node.children.map(child => (
        <MigrateOrgPicker key={child.id} node={child} depth={depth + 1}
          selectedId={selectedId} onSelect={onSelect} excludeId={excludeId} />
      ))}
    </div>
  );
}


/** 证书图片上传组件：拖拽 / 点击上传 + 预览 + 格式校验 */
function CertImageUploader({ label, hint, value, uploading, onUpload, onClear, previewStyle, round }: {
  label: string;
  hint: string;
  value: string;
  uploading: boolean;
  onUpload: (file: File) => void;
  onClear: () => void;
  previewStyle?: React.CSSProperties;
  round?: boolean;
}) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const validate = (file: File): boolean => {
    const validTypes = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      alert('格式不支持，请上传 PNG / JPG / SVG / WebP 格式的图片');
      return false;
    }
    if (file.size > 2 * 1024 * 1024) {
      alert('文件过大，最大支持 2MB');
      return false;
    }
    return true;
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && validate(file)) onUpload(file);
  };

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && validate(file)) onUpload(file);
    e.target.value = '';
  };

  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>{label}</label>
      <div className="flex items-center gap-3">
        {/* 预览区 */}
        {value ? (
          <div className="relative group" style={{ borderRadius: round ? '50%' : '6px', overflow: 'hidden', border: '1px solid var(--ink-100)', background: '#fafafa', ...previewStyle }}>
            <img src={value} alt={label} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            <button onClick={onClear}
              className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              style={{ background: 'rgba(0,0,0,0.5)', color: '#fff', border: 'none' }}
              title="移除">✕</button>
          </div>
        ) : (
          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className="flex flex-col items-center justify-center cursor-pointer transition-colors"
            style={{
              width: round ? '72px' : '160px',
              height: round ? '72px' : '56px',
              borderRadius: round ? '50%' : '8px',
              border: `1.5px dashed ${dragOver ? 'var(--fox)' : 'var(--ink-200)'}`,
              background: dragOver ? 'var(--fox-pale)' : 'var(--paper)',
            }}
          >
            {uploading ? (
              <span className="text-[10px]" style={{ color: 'var(--fox)' }}>上传中…</span>
            ) : (
              <>
                <span className="text-sm">📁</span>
                <span className="text-[10px] mt-0.5" style={{ color: 'var(--ink-300)' }}>拖拽或点击</span>
              </>
            )}
          </div>
        )}
        {value && (
          <button onClick={() => inputRef.current?.click()} className="btn btn-ghost btn-xs" style={{ color: 'var(--ink-400)' }}>
            {uploading ? '上传中…' : '更换'}
          </button>
        )}
      </div>
      <p className="text-[10px] mt-1" style={{ color: 'var(--ink-300)' }}>{hint}</p>
      <p className="text-[10px]" style={{ color: 'var(--ink-300)' }}>支持 PNG / JPG / SVG / WebP · 最大 2MB · 图片不会变形（等比缩放）</p>
      <input ref={inputRef} type="file" accept=".png,.jpg,.jpeg,.svg,.webp" onChange={handleSelect} className="hidden" />
    </div>
  );
}
