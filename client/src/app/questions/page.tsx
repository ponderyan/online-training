'use client';

import { useEffect, useState, useCallback } from 'react';
import { useDebounce } from '@/hooks/use-debounce';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import { AddQuestionModal, ViewQuestionModal } from '@/components/question-modals';
import QuestionImportModal from '@/components/question-import-modal';
import { api } from '@/lib/api';
import ReasonConfirmModal from '@/components/ReasonConfirmModal';
import { useToast } from '@/components/Toast';
import { Button } from '@/components/ui/button';
import { Pencil, Upload, Plus } from 'lucide-react';
import QuestionFilterBar from './components/QuestionFilterBar';
import QuestionTable from './components/QuestionTable';
import SelectionBar from './components/SelectionBar';
import KnowledgePointModal from './components/KnowledgePointModal';
import ReferencedPapersModal from './components/ReferencedPapersModal';

export default function QuestionsPage() {
  const toast = useToast();
  const router = useRouter();
  const [questions, setQuestions] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [keyword, setKeyword] = useState('');
  const debouncedKeyword = useDebounce(keyword);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [toggleTarget, setToggleTarget] = useState<any | null>(null);
  const [filterType, setFilterType] = useState('');
  const [filterDifficulty, setFilterDifficulty] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [filterMaterial, setFilterMaterial] = useState('');
  const [filterMatChapter, setFilterMatChapter] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [subjects, setSubjects] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [matChapters, setMatChapters] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [selectMode, setSelectMode] = useState(false);

  const [showAdd, setShowAdd] = useState(false);
  const [viewQuestion, setViewQuestion] = useState<any>(null);
  const [editQuestion, setEditQuestion] = useState<any>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [bankPolicy, setBankPolicy] = useState<{ org_bank_visibility: string; allow_org_own_bank?: boolean } | null>(null);
  const [referencedPapers, setReferencedPapers] = useState<any>(null);
  const [loadingRefs, setLoadingRefs] = useState(false);

  // 知识点标记
  const [kpModalQuestion, setKpModalQuestion] = useState<any>(null);
  const [kpTree, setKpTree] = useState<any[]>([]);
  const [kpSelected, setKpSelected] = useState<Set<number>>(new Set());
  const [kpLoading, setKpLoading] = useState(false);
  const [kpSubjectId, setKpSubjectId] = useState<number>(0);

  // ── 数据加载 ──
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params: Record<string, string> = { page: String(page), pageSize: String(pageSize) };
    if (debouncedKeyword) params.keyword = debouncedKeyword;
    if (filterType) params.type = filterType;
    if (filterDifficulty) params.difficulty = filterDifficulty;
    if (filterSubject) params.subjectId = filterSubject;
    if (filterMaterial) params.materialId = filterMaterial;
    if (filterMatChapter) params.chapterId = filterMatChapter;
    if (filterStatus) params.status = filterStatus;
    try {
      const data = await api.questions.list(params);
      setQuestions(data.items);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (e: any) {
      setError(e.message || '加载试题列表失败');
    }
    setLoading(false);
  }, [page, pageSize, debouncedKeyword, filterType, filterDifficulty, filterSubject, filterMaterial, filterMatChapter, filterStatus]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api.subjects.list().then((subjs: any[]) => setSubjects(Array.isArray(subjs) ? subjs : [])).catch(() => {});
    api.materials.listForFilter().then(setMaterials).catch(() => {});
  }, []);
  useEffect(() => {
    if (!filterMaterial) { setMatChapters([]); setFilterMatChapter(''); return; }
    api.materials.get(Number(filterMaterial)).then(m => {
      setMatChapters(m.chapters?.map((ch: any) => ({ id: ch.id, title: ch.title })) || []);
    }).catch(() => setMatChapters([]));
  }, [filterMaterial]);
  useEffect(() => {
    api.systemConfig.bankPolicy.get().then(data => setBankPolicy(data)).catch(() => {});
  }, []);

  // 当前用户角色
  const currentUser = typeof window !== 'undefined'
    ? (() => { try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; } })()
    : {};
  const isSuperAdmin = currentUser?.roles?.includes('SUPER_ADMIN') || false;

  // ── Handlers ──
  const loadKpTree = async (subjectId: number) => {
    setKpLoading(true);
    try { setKpTree(await api.knowledgePoints.getTree(subjectId)); } catch {}
    setKpLoading(false);
  };

  const openKpModal = async (q: any) => {
    setKpModalQuestion(q);
    setKpTree([]);
    setKpSelected(new Set());
    const qSubjectId = q.subjectId || 0;
    setKpSubjectId(qSubjectId);
    if (qSubjectId > 0) loadKpTree(qSubjectId);
    try {
      const existing = await api.knowledgePoints.getQuestionKPs(q.id);
      setKpSelected(new Set(existing.map((e: any) => e.knowledgePointId)));
    } catch {}
  };

  const confirmToggle = async (reason: string) => {
    if (!toggleTarget) return;
    const newStatus = toggleTarget.status === 'PUBLISHED' ? 'ARCHIVED' : 'PUBLISHED';
    await api.questions.update(toggleTarget.id, { status: newStatus });
    setToggleTarget(null);
    load();
  };

  const handleDelete = async (reason: string) => {
    if (deleteTarget === null) return;
    const q = questions.find(qx => qx.id === deleteTarget);
    if (!q) { setDeleteTarget(null); return; }
    try {
      await api.questions.delete(q.id);
      toast.success('试题已删除');
      setDeleteTarget(null);
      load();
    } catch (e: any) { toast.error('删除失败：' + e.message); }
  };

  const requestDelete = async (q: any) => {
    try {
      const refs = await api.questions.getReferencedPapers(q.id);
      if (refs.count > 0) {
        toast.warning(`该试题已被 ${refs.count} 份试卷引用，无法删除。建议使用「停用」功能将其归档，已引用的试卷不受影响。`);
        return;
      }
    } catch {}
    setDeleteTarget(q.id);
  };

  const openEditModal = async (q: any) => {
    setEditingId(q.id);
    try { setEditQuestion(await api.questions.get(q.id)); }
    catch { setEditQuestion(q); }
    setEditingId(null);
  };

  const showReferencedPapers = async (questionId: number) => {
    setLoadingRefs(true);
    setReferencedPapers(null);
    try { setReferencedPapers(await api.questions.getReferencedPapers(questionId)); }
    catch (e: any) { toast.error('查询失败：' + e.message); }
    setLoadingRefs(false);
  };

  const handleRowDoubleClick = async (q: any) => {
    try { setViewQuestion(await api.questions.get(q.id)); }
    catch { setViewQuestion(q); }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  const goGenerateWithSelected = () => {
    if (selectedIds.size === 0) { toast.warning('请先勾选试题'); return; }
    const selectedData = questions.filter(q => selectedIds.has(q.id)).map(q => ({ id: q.id, type: q.type }));
    localStorage.setItem('selectedQuestionData', JSON.stringify(selectedData));
    router.push('/generate');
  };

  const clearSelection = () => { setSelectedIds(new Set()); setSelectMode(false); };

  const getPageNumbers = () => {
    const pages: number[] = [];
    if (totalPages <= 7) { for (let i = 1; i <= totalPages; i++) pages.push(i); }
    else if (page <= 4) { for (let i = 1; i <= 7; i++) pages.push(i); }
    else if (page >= totalPages - 3) { for (let i = totalPages - 6; i <= totalPages; i++) pages.push(i); }
    else { for (let i = page - 3; i <= page + 3; i++) pages.push(i); }
    return pages;
  };

  return (
    <AppLayout>
      {/* ── 页面标题 ── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-7">
        <div>
          <h1 className="page-title flex items-center gap-2"><Pencil size={22} className="text-[var(--fox)]" /> 题库管理</h1>
          <p className="page-subtitle">共 {total} 道试题 · 7 种题型 · {subjects.length} 个科目</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="sm" icon={<Upload size={14} />} onClick={() => setShowImport(true)}>批量导入</Button>
          {(!isSuperAdmin && bankPolicy?.allow_org_own_bank === false) ? null : (
            <Button size="sm" icon={<Plus size={14} />} onClick={() => setShowAdd(true)}>录入试题</Button>
          )}
        </div>
      </div>

      {/* ── 筛选栏 ── */}
      <QuestionFilterBar
        keyword={keyword} setKeyword={setKeyword}
        filterSubject={filterSubject} setFilterSubject={setFilterSubject}
        filterType={filterType} setFilterType={setFilterType}
        filterDifficulty={filterDifficulty} setFilterDifficulty={setFilterDifficulty}
        filterStatus={filterStatus} setFilterStatus={setFilterStatus}
        filterMaterial={filterMaterial} setFilterMaterial={setFilterMaterial}
        filterMatChapter={filterMatChapter} setFilterMatChapter={setFilterMatChapter}
        subjects={subjects} materials={materials} matChapters={matChapters}
        setPage={setPage}
      />

      {/* ── 表格 ── */}
      <QuestionTable
        questions={questions} loading={loading} error={error}
        selectedIds={selectedIds} selectMode={selectMode}
        page={page} pageSize={pageSize} editingId={editingId}
        isSuperAdmin={isSuperAdmin} bankPolicy={bankPolicy}
        onToggleSelectAll={() => {
          if (selectMode) { setSelectedIds(new Set()); setSelectMode(false); }
          else { setSelectMode(true); setSelectedIds(new Set(questions.filter(q => q.status !== 'ARCHIVED').map(q => q.id))); }
        }}
        onToggleSelect={toggleSelect}
        onRowDoubleClick={handleRowDoubleClick}
        onView={(q) => handleRowDoubleClick(q)}
        onEdit={openEditModal}
        onToggleStatus={(q) => setToggleTarget(q)}
        onOpenKp={openKpModal}
        onDelete={requestDelete}
        onShowRefs={showReferencedPapers}
        onRetry={() => load()}
        onShowAdd={() => setShowAdd(true)}
        setViewQuestion={setViewQuestion}
      />

      {/* ── 选题操作栏 ── */}
      <SelectionBar selectedIds={selectedIds} onGenerate={goGenerateWithSelected} onClear={clearSelection} onDone={load} />

      {/* ── 分页 ── */}
      <div className="text-[var(--ink-400)] flex flex-col items-center mt-4 gap-2">
        <div className="flex items-center gap-2 text-xs">
          <span>显示</span>
          <input value={pageSize} onChange={e => {
            const v = parseInt(e.target.value) || 0;
            if (v > 0 && v <= 500) { setPageSize(v); setPage(1); }
          }}
            className="input text-xs text-center" style={{ width: '56px', padding: '4px 6px' }} inputMode="numeric" />
          <span>条 / 页，共 {total} 条</span>
          <span className="text-[var(--ink-200)] ml-2">
            （第 {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} 条）
          </span>
        </div>
        {totalPages > 1 && (
          <div className="flex gap-1.5">
            {getPageNumbers().map(p => (
              <button key={p} onClick={() => setPage(p)} className="btn btn-xs"
                style={{
                  background: p === page ? 'var(--ink-900)' : 'transparent',
                  color: p === page ? 'var(--paper-light)' : 'var(--ink-500)',
                  border: p === page ? 'none' : '1px solid var(--ink-100)',
                  minWidth: '32px',
                }}>
                {p}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── 弹窗 ── */}
      <AddQuestionModal open={showAdd || !!editQuestion} onClose={() => { setShowAdd(false); setEditQuestion(null); load(); }} subjects={subjects} editQuestion={editQuestion} />
      <ViewQuestionModal open={!!viewQuestion} onClose={() => setViewQuestion(null)} question={viewQuestion} />
      <QuestionImportModal open={showImport} onClose={() => { setShowImport(false); load(); }} subjects={subjects} />
      <ReferencedPapersModal data={referencedPapers} loading={loadingRefs} onClose={() => setReferencedPapers(null)} />
      <KnowledgePointModal
        question={kpModalQuestion} kpTree={kpTree} kpSelected={kpSelected}
        kpLoading={kpLoading} kpSubjectId={kpSubjectId} subjects={subjects}
        onClose={() => setKpModalQuestion(null)}
        onSubjectChange={(sid) => { setKpSubjectId(sid); if (sid > 0) loadKpTree(sid); }}
        onToggleKp={(id) => { const next = new Set(kpSelected); next.has(id) ? next.delete(id) : next.add(id); setKpSelected(next); }}
      />
      <ReasonConfirmModal
        open={deleteTarget !== null} title="🗑 删除试题"
        message="确认永久删除此题？此操作不可撤销。" required
        presetReasons={['创建错误', '题目内容有误', '重复创建']}
        confirmText="确认删除" onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)}
      />
      <ReasonConfirmModal
        open={toggleTarget !== null}
        title={toggleTarget?.status === 'PUBLISHED' ? '⏸ 停用试题' : '▶️ 启用试题'}
        message={toggleTarget?.status === 'PUBLISHED' ? '停用后，试题不再出现在试卷选题列表中，已引用的试卷不受影响。' : '启用后，试题可被再次选入试卷。'}
        required={false} confirmText="确认" onConfirm={confirmToggle} onCancel={() => setToggleTarget(null)}
      />
    </AppLayout>
  );
}
