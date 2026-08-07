'use client';

import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { validateTel, validateEmail, validateOrgCode } from '@/lib/validators';
import { OrgNode, DataScope, OrgUsers, findNode } from './lib';
import OrgNodeView from './components/org-node-view';
import OrgDetailPanel from './components/org-detail-panel';
import { OrgFormModal, ImportModal, MigrateModal } from './components/org-modals';

export default function OrganizationsPage() {
  const toast = useToast();
  const [tree, setTree] = useState<OrgNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState('');

  const [dataScope, setDataScope] = useState<DataScope | null>(null);
  const [orgUsers, setOrgUsers] = useState<OrgUsers | null>(null);

  const [showOrgModal, setShowOrgModal] = useState(false);
  const [editOrg, setEditOrg] = useState<OrgNode | null>(null);
  const [modalParent, setModalParent] = useState<OrgNode | null>(null);
  const codeTouched = useRef(false); // 用户手动改过编码后，preview 不再覆盖
  const [orgForm, setOrgForm] = useState({ name: '', code: '', contactName: '', contactPhone: '', contactEmail: '', orgType: 'BRANCH' });
  const [saving, setSaving] = useState(false);

  const [dragId, setDragId] = useState<number | null>(null);

  const [showImportModal, setShowImportModal] = useState(false);
  const [importRows, setImportRows] = useState<{ name: string; parentName?: string; sortOrder?: number }[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);

  const [showMigrateModal, setShowMigrateModal] = useState(false);
  const [migrateSource, setMigrateSource] = useState<OrgNode | null>(null);
  const [migrateTargetId, setMigrateTargetId] = useState<number | null>(null);
  const [migrateOptions, setMigrateOptions] = useState({ moveHours: true, moveExams: false });
  const [migrating, setMigrating] = useState(false);

  const [certConfig, setCertConfig] = useState<{ certIssuerName?: string; certLogoUrl?: string; certFooterText?: string; sealUrl?: string; useFoxLearnSeal?: boolean } | null>(null);
  const [certSaving, setCertSaving] = useState(false);
  const [certUploading, setCertUploading] = useState<'logo' | 'seal' | null>(null);
  const [orgAgencies, setOrgAgencies] = useState<any[]>([]);

  const load = async () => {
    try {
      const data = await api.organizations.getTree();
      setTree(data || []);
      if (data.length > 0) {
        setExpanded(prev => { const next = new Set(prev); data.forEach(d => next.add(d.id)); return next; });
      }
    } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

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
    setExpanded(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  const { filteredTree, matchIds } = useMemo(() => {
    if (!search.trim()) return { filteredTree: tree, matchIds: new Set<number>() };
    const q = search.trim().toLowerCase();
    const matches = new Set<number>();
    const filterNode = (node: OrgNode): OrgNode | null => {
      const selfMatch = node.name.toLowerCase().includes(q) || node.code.toLowerCase().includes(q);
      const kids = node.children.map(filterNode).filter(Boolean) as OrgNode[];
      if (selfMatch || kids.length > 0) { if (selfMatch) matches.add(node.id); return { ...node, children: kids }; }
      return null;
    };
    return { filteredTree: tree.map(filterNode).filter(Boolean) as OrgNode[], matchIds: matches };
  }, [tree, search]);

  useEffect(() => {
    if (!search.trim() || matchIds.size === 0) return;
    setExpanded(prev => {
      const next = new Set(prev);
      const expandAncestors = (nodes: OrgNode[]): boolean => {
        let has = false;
        for (const n of nodes) {
          const childHas = expandAncestors(n.children);
          if (matchIds.has(n.id) || childHas) { has = true; if (n.children.length > 0) next.add(n.id); }
        }
        return has;
      };
      expandAncestors(tree);
      return next;
    });
  }, [matchIds, tree, search]);

  // ── Handlers ──
  const openCreate = (parent: OrgNode | null) => {
    setEditOrg(null); setModalParent(parent); codeTouched.current = false;
    setOrgForm({ name: '', code: '', contactName: '', contactPhone: '', contactEmail: '', orgType: 'BRANCH' });
    setShowOrgModal(true);
  };
  const openEdit = (org: OrgNode) => {
    setEditOrg(org); setModalParent(null);
    setOrgForm({ name: org.name, code: org.code, contactName: org.contactName || '', contactPhone: org.contactPhone || '', contactEmail: org.contactEmail || '', orgType: org.orgType || 'BRANCH' });
    setShowOrgModal(true);
  };

  const handleSaveOrg = async () => {
    if (!orgForm.name || (!editOrg && !orgForm.code)) { toast.warning('名称和编码不能为空'); return; }
    if (!editOrg) { const codeErr = validateOrgCode(orgForm.code); if (codeErr) { toast.warning(codeErr); return; } }
    const telErr = validateTel(orgForm.contactPhone); if (telErr) { toast.warning(telErr); return; }
    const emailErr = validateEmail(orgForm.contactEmail); if (emailErr) { toast.warning(emailErr); return; }
    setSaving(true);
    try {
      if (editOrg) {
        await api.organizations.update(editOrg.id, { name: orgForm.name, contactName: orgForm.contactName, contactPhone: orgForm.contactPhone, contactEmail: orgForm.contactEmail, orgType: orgForm.orgType });
      } else {
        await api.organizations.create({ name: orgForm.name, code: orgForm.code, parentId: modalParent?.id || null, contactName: orgForm.contactName, contactPhone: orgForm.contactPhone, contactEmail: orgForm.contactEmail, orgType: orgForm.orgType });
      }
      setShowOrgModal(false); setEditOrg(null); setModalParent(null);
      await load();
    } catch (e: any) { toast.error('保存失败：' + e.message); }
    setSaving(false);
  };

  const handleDelete = async (org: OrgNode) => {
    if (!confirm(`确认删除「${org.name}」？`)) return;
    try { await api.organizations.remove(org.id); if (selectedId === org.id) setSelectedId(null); await load(); }
    catch (e: any) { toast.error(e.message || '删除失败'); }
  };

  const onDrop = async (target: OrgNode | null) => {
    if (dragId === null) return;
    const targetId = target?.id ?? null;
    if (dragId === targetId) { setDragId(null); return; }
    const moving = findNode(tree, dragId);
    if (!moving) { setDragId(null); return; }
    if (target && moving.path && target.path && target.path.startsWith(moving.path)) { toast.warning('不能将组织移动到其下属组织下'); setDragId(null); return; }
    const targetLabel = target ? `「${target.name}」下` : '根层级';
    if (!confirm(`将「${moving.name}」移动到${targetLabel}？`)) { setDragId(null); return; }
    try { await api.organizations.move(dragId, targetId); await load(); }
    catch (e: any) { toast.error(e.message || '移动失败'); }
    setDragId(null);
  };

  const downloadTemplate = () => {
    import('xlsx').then(XLSX => {
      const ws = XLSX.utils.aoa_to_sheet([['组织名称', '上级组织名称', '排序号'], ['示例部门', '', '1'], ['示例子部门', '示例部门', '1']]);
      ws['!cols'] = [{ wch: 24 }, { wch: 20 }, { wch: 10 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '组织导入');
      XLSX.writeFile(wb, '组织导入模板.xlsx');
    });
  };

  const handleImportFile = (file: File) => {
    if (file.size > 2 * 1024 * 1024) { toast.warning('文件不能超过 2MB'); return; }
    import('xlsx').then(XLSX => {
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const wb = XLSX.read(data, { type: 'array' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const json: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
          const rows = json.slice(1).filter(r => r[0] != null && String(r[0]).trim())
            .map(r => ({ name: String(r[0] || '').trim(), parentName: r[1] != null ? String(r[1]).trim() : undefined, sortOrder: r[2] != null && r[2] !== '' ? Number(r[2]) : undefined }));
          setImportRows(rows); setImportResult(null);
        } catch { toast.error('Excel 解析失败，请检查文件格式'); }
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
      if (res.imported > 0) { toast.success(`导入成功 ${res.imported} 个组织`); await load(); }
      else toast.warning('未导入任何组织');
    } catch (e: any) { toast.error('导入失败：' + e.message); }
    setImporting(false);
  };

  const openMigrateModal = (org: OrgNode) => {
    setMigrateSource(org); setMigrateTargetId(null); setMigrateOptions({ moveHours: true, moveExams: false }); setShowMigrateModal(true);
  };

  const handleMigrate = async () => {
    if (!migrateSource || !migrateTargetId) { toast.warning('请选择目标组织'); return; }
    if (migrateSource.id === migrateTargetId) { toast.warning('不能迁移到自身组织'); return; }
    if (!confirm(`确认将「${migrateSource.name}」及其下属组织的学员迁移到目标组织？`)) return;
    setMigrating(true);
    try {
      const res = await api.organizations.migrateStudents(migrateSource.id, { targetOrgId: migrateTargetId, moveHours: migrateOptions.moveHours, moveExams: migrateOptions.moveExams });
      toast.success(`已迁移 ${res.migrated} 名学员到「${res.targetOrgName}」`);
      setShowMigrateModal(false); await load();
    } catch (e: any) { toast.error('迁移失败：' + e.message); }
    setMigrating(false);
  };

  const handleCertUpload = async (type: 'logo' | 'seal', file: File) => {
    if (!selectedId) return;
    setCertUploading(type);
    try {
      const res = await api.organizations.uploadCertImage(selectedId, file, type);
      setCertConfig(prev => prev ? { ...prev, [type === 'logo' ? 'certLogoUrl' : 'sealUrl']: res.url } : prev);
      toast.success(type === 'logo' ? 'Logo 已上传' : '印章已上传');
    } catch (e: any) { toast.error('上传失败：' + (e.message || '')); }
    setCertUploading(null);
  };

  const handleCertSave = async () => {
    if (!selectedId || !certConfig) return;
    setCertSaving(true);
    try { await api.organizations.updateCertConfig(selectedId, certConfig); toast.success('证书配置已保存'); }
    catch (e: any) { toast.error('保存失败：' + (e.message || '')); }
    setCertSaving(false);
  };

  // 编码自动生成（防抖）
  const handleFormChange = (form: any) => {
    // 用户手动修改了编码（name 未变而 code 变了）→ 后续 preview 不再覆盖
    if (!editOrg && form.code !== orgForm.code && form.name === orgForm.name) codeTouched.current = true;
    setOrgForm(form);
    if (!editOrg && !codeTouched.current && form.name.length >= 2) {
      clearTimeout((window as any).__orgCodeTimer);
      (window as any).__orgCodeTimer = setTimeout(async () => {
        try { const code = await api.orgCodes.preview(modalParent?.id || null, form.name); if (code) setOrgForm(prev => ({ ...prev, code })); } catch {}
      }, 400);
    }
  };

  if (loading) {
    return <AppLayout><div className="text-[var(--ink-300)] text-center py-16">小狐狸正在加载组织树… 🦊</div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="page-title">组织管理</h1>
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
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 bg-transparent border-none cursor-pointer text-sm leading-none text-[var(--ink-300)]" title="清除搜索">✕</button>
            )}
          </div>
          <div className="card flex-1 overflow-y-auto p-2" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); onDrop(null); }}>
            {filteredTree.length === 0 ? (
              <div className="text-[var(--ink-300)] text-center py-12 text-xs">{search ? '未找到匹配组织' : '暂无组织，点击右上角新建'}</div>
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
            <OrgDetailPanel
              node={selectedNode} dataScope={dataScope} orgUsers={orgUsers} orgAgencies={orgAgencies}
              certConfig={certConfig} certSaving={certSaving} certUploading={certUploading}
              onCreate={openCreate} onEdit={openEdit} onDelete={handleDelete} onMigrate={openMigrateModal}
              onCertConfigChange={setCertConfig} onCertSave={handleCertSave} onCertUpload={handleCertUpload}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center"><p className="text-5xl mb-4">🏢</p><p className="text-[var(--ink-300)]">从左侧选择一个组织查看详情</p></div>
            </div>
          )}
        </div>
      </div>

      <OrgFormModal open={showOrgModal} editOrg={editOrg} modalParent={modalParent} orgForm={orgForm} saving={saving}
        onClose={() => { setShowOrgModal(false); setEditOrg(null); setModalParent(null); }}
        onFormChange={handleFormChange} onSave={handleSaveOrg} />

      <ImportModal open={showImportModal} importRows={importRows} importing={importing} importResult={importResult}
        onClose={() => { setShowImportModal(false); setImportRows([]); setImportResult(null); }}
        onDownloadTemplate={downloadTemplate} onFileSelect={handleImportFile} onImport={handleImport} />

      <MigrateModal open={showMigrateModal} source={migrateSource} tree={tree} targetId={migrateTargetId}
        options={migrateOptions} migrating={migrating} totalUsers={orgUsers?.total ?? null}
        onClose={() => setShowMigrateModal(false)} onTargetChange={setMigrateTargetId}
        onOptionsChange={setMigrateOptions} onMigrate={handleMigrate} />
    </AppLayout>
  );
}
