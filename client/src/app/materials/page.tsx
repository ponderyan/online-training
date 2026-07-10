'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import { api } from '@/lib/api';

const STATUS: Record<string, { label: string; cls: string }> = {
  UPLOADED: { label: '待处理', cls: 'tag-ink' },
  PROCESSING: { label: '处理中', cls: 'tag-gold' },
  OCR_DONE: { label: '已识别', cls: 'tag-cyan' },
  GENERATING: { label: '出题中', cls: 'tag-gold' },
  GENERATED: { label: '待审核', cls: 'tag-fox' },
  REVIEWING: { label: '审核中', cls: 'tag-fox' },
  COMPLETED: { label: '已完成', cls: 'tag-cyan' },
  FAILED: { label: '失败', cls: 'tag-verm' },
};

export default function MaterialsPage() {
  const router = useRouter();
  const [materials, setMaterials] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [showUpload, setShowUpload] = useState(false);
  const [showEntry, setShowEntry] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.materials.list();
      setMaterials(data.items);
      setTotal(data.total);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); api.subjects.list().then(setSubjects).catch(() => {}); }, []);

  const handleDelete = async (id: number) => {
    if (!confirm('确认删除此教材及所有生成试题？')) return;
    await api.materials.delete(id);
    load();
  };

  const generatedCount = materials.filter(m => ['GENERATED', 'REVIEWING', 'COMPLETED'].includes(m.status)).length;
  const pendingReview = materials.filter(m => m.status === 'GENERATED').length;

  return (
    <AppLayout>
      <div className="flex items-start justify-between mb-7">
        <div>
          <h1 className="page-title">📖 教材出题</h1>
          <p className="page-subtitle">
            上传教材（PDF/PPTX/Word）→ AI自动出题 → 逐题审核入库 &nbsp;|&nbsp;
            已出题 {generatedCount} 份 · 待审核 {pendingReview} 份
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowEntry(true)} className="btn btn-ink btn-sm">📝 录入正文</button>
          <button onClick={() => setShowUpload(true)} className="btn btn-fox btn-sm">+ 上传教材</button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16" style={{ color: 'var(--ink-300)' }}>小狐狸正在加载… 🦊</div>
      ) : materials.length === 0 && !showUpload ? (
        <div className="text-center py-20" style={{ color: 'var(--ink-300)' }}>
          <div className="text-4xl mb-4">📖</div>
          <p className="mb-2">小狐狸还没收到教材呢</p>
          <p className="text-xs mb-5">上传教材（PDF/PPTX/Word）→ AI自动识别章节 → 智能出题</p>
          <button onClick={() => setShowUpload(true)} className="btn btn-fox">上传第一本教材</button>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(360px,1fr))] gap-4">
          {materials.map((m: any) => (
            <div key={m.id}
              className="card p-5 transition-all hover:-translate-y-0.5 hover:border-[var(--fox)] cursor-pointer"
              onClick={() => {
                if (['OCR_DONE', 'GENERATED', 'REVIEWING', 'COMPLETED'].includes(m.status)) {
                  router.push(`/materials/${m.id}`);
                }
              }}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-lg flex-shrink-0">📘</span>
                  <h3 className="font-serif font-bold text-sm leading-snug truncate" style={{ color: 'var(--ink-800)' }}>
                    {m.name}
                  </h3>
                </div>
                <span className={`tag flex-shrink-0 ${STATUS[m.status]?.cls || 'tag-ink'}`}>
                  {m.status === 'PROCESSING' || m.status === 'GENERATING' ? '⏳ ' : ''}
                  {STATUS[m.status]?.label || m.status}
                </span>
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs mb-3" style={{ color: 'var(--ink-400)' }}>
                <span>{m.subject?.code || '—'}</span>
                <span>{new Date(m.createdAt).toLocaleDateString('zh-CN')}</span>
                <span>{m._count?.chapters || 0} 章</span>
                <span>{m._count?.questions || 0} 题</span>
              </div>

              {m.status === 'UPLOADED' && m.errorMessage && (
                <div className="text-xs p-2 rounded mb-2" style={{ background: 'var(--verm-glow)', color: 'var(--verm)' }}>
                  ⚠ {m.errorMessage}
                </div>
              )}
              {m.status === 'FAILED' && m.errorMessage && (
                <div className="text-xs p-2 rounded mb-2" style={{ background: 'var(--verm-glow)', color: 'var(--verm)' }}>
                  ⚠ {m.errorMessage}
                </div>
              )}

              <div className="flex gap-2 pt-3 border-t" style={{ borderColor: 'var(--ink-100)' }}>
                {['OCR_DONE', 'GENERATED', 'REVIEWING', 'COMPLETED'].includes(m.status) && (
                  <button onClick={e => { e.stopPropagation(); router.push(`/materials/${m.id}`); }}
                    className="btn btn-fox btn-xs flex-1">
                    {m.status === 'OCR_DONE' ? '🤖 AI出题' : '去审核'}
                  </button>
                )}
                {m.status === 'UPLOADED' && (
                  <span className="text-xs flex-1 text-center py-1.5" style={{ color: 'var(--ink-300)' }}>
                    等待处理…
                  </span>
                )}
                {(['PROCESSING', 'GENERATING']).includes(m.status) && (
                  <span className="text-xs flex-1 text-center py-1.5" style={{ color: 'var(--gold)' }}>
                    ⏳ 小狐狸正在处理中…
                  </span>
                )}
                <button onClick={e => { e.stopPropagation(); handleDelete(m.id); }}
                  className="btn btn-ghost btn-xs" style={{ color: 'var(--ink-300)' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--verm)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-300)')}>删除</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {showUpload && <UploadModal subjects={subjects} onClose={() => { setShowUpload(false); load(); }} />}
      {/* Manual Entry Modal */}
      {showEntry && <ManualEntryModal subjects={subjects} onClose={() => { setShowEntry(false); load(); }} />}
    </AppLayout>
  );
}

function UploadModal({ subjects, onClose }: { subjects: any[]; onClose: () => void }) {
  const router = useRouter();
  const [subjectId, setSubjectId] = useState(subjects[0]?.id || '');
  const [materialName, setMaterialName] = useState('');
  const [batchNote, setBatchNote] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState('');

  // 弹窗打开时全局拦截 Backspace 键（防止浏览器后退导致弹窗关闭）
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Backspace') {
        const tag = (e.target as HTMLElement)?.tagName;
        const isEditable = ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || !!(e.target as HTMLElement)?.isContentEditable;
        // 输入框里按 Backspace 让正常删除，否则拦截（防止浏览器回退）
        if (!isEditable) e.preventDefault();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const handleSubmit = async () => {
    if (!file || !subjectId) return;
    if (!batchNote.trim()) { alert('请填写出题要求，说明题型、数量和难度分布'); return; }
    setUploading(true);
    setProgress('上传中…');
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', materialName || file.name.replace(/\.(pdf|pptx|docx)$/i, ''));
      formData.append('subjectId', String(subjectId));
      formData.append('batchNote', batchNote);
      formData.append('createdBy', '1');

      const result = await api.materials.upload(formData);
      setProgress('✅ 上传成功！小狐狸马上开始处理');
      setTimeout(() => {
        onClose();
        router.push(`/materials/${result.id}`);
      }, 1500);
    } catch (e: any) {
      setProgress('❌ ' + e.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget && !uploading) onClose(); }}>
      <div className="modal-card max-w-[480px] animate-fadeSlide">
        <div className="modal-header">
          <h3 className="font-serif font-bold text-base">📖 上传教材</h3>
          <button onClick={onClose} disabled={uploading}
            className="text-lg bg-transparent border-none cursor-pointer"
            style={{ color: 'var(--ink-300)' }}>✕</button>
        </div>
        <div className="modal-body space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-500)' }}>所属科目</label>
            <select value={subjectId} onChange={e => setSubjectId(e.target.value)} className="input select">
              {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-500)' }}>教材名称</label>
            <input value={materialName} onChange={e => setMaterialName(e.target.value)}
              placeholder="如：DTIV上册" className="input" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-500)' }}>
              出题要求 <span style={{ color: 'var(--verm)' }}>*必填</span>
            </label>
            <textarea value={batchNote} onChange={e => setBatchNote(e.target.value)}
              placeholder={'请详细描述出题要求，小狐狸会严格按此执行。\n\n例如：\n题型：单选题30道、判断题10道、填空题10道（每题2空）、简答题5道\n难度：60%基础（教材原文）、30%变形（理解应用）、10%场景题\n范围：重点考察第一至四章\n说明：这是数智化转型企业内部评估师考试'}
              className="input textarea" rows={5} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-500)' }}>教材文件（PDF / PPTX / DOCX）</label>
            <div className="border-2 border-dashed rounded-lg p-8 text-center transition-all"
              style={{
                borderColor: file ? 'var(--fox)' : 'var(--ink-100)',
                background: file ? 'var(--fox-pale)' : 'var(--paper)',
              }}
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault();
                const f = e.dataTransfer.files[0];
                if (f && (f.type === 'application/pdf' || f.name.endsWith('.pptx') || f.name.endsWith('.docx'))) setFile(f);

              }}>
              {file ? (
                <div>
                  <div className="text-2xl mb-2">📄</div>
                  <p className="text-sm font-medium" style={{ color: 'var(--ink-700)' }}>{file.name}</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--ink-400)' }}>
                    {(file.size / 1024 / 1024).toFixed(1)} MB
                  </p>
                  <button onClick={() => setFile(null)} className="btn btn-ghost btn-xs mt-2">重新选择</button>
                </div>
              ) : (
                <label className="cursor-pointer block">
                  <div className="text-3xl mb-2">📂</div>
                  <p className="text-sm" style={{ color: 'var(--ink-500)' }}>拖拽或点击上传 PDF</p>
                  <input type="file" accept=".pdf,.pptx,.docx" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) setFile(f); }} />
                </label>
              )}
            </div>
          </div>
          {progress && (
            <div className="text-sm text-center py-2" style={{
              color: progress.startsWith('✅') ? 'var(--cyan)' : progress.startsWith('❌') ? 'var(--verm)' : 'var(--fox)',
            }}>{progress}</div>
          )}
        </div>
        <div className="modal-footer">
          <button onClick={onClose} disabled={uploading} className="btn btn-ghost btn-sm">取消</button>
          <button onClick={handleSubmit} disabled={!file || !subjectId || uploading}
            className="btn btn-fox btn-sm">
            {uploading ? '上传中…' : '上传并开始处理'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ManualEntryModal({ subjects, onClose }: { subjects: any[]; onClose: () => void }) {
  const router = useRouter();
  const [subjectId, setSubjectId] = useState(subjects[0]?.id || '');
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [batchNote, setBatchNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState('');

  const handleSubmit = async () => {
    if (!name.trim() || !subjectId || !content.trim()) { alert('请填写教材名称和正文内容'); return; }
    setSubmitting(true);
    setProgress('提交中…');
    try {
      const result = await api.materials.create({
        name: name.trim(),
        subjectId: Number(subjectId),
        content: content.trim(),
        batchNote: batchNote.trim() || undefined,
      });
      setProgress('✅ 创建成功！小狐狸马上开始处理');
      setTimeout(() => {
        onClose();
        router.push(`/materials/${result.id}`);
      }, 1500);
    } catch (e: any) {
      setProgress('❌ ' + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Backspace guard (same as UploadModal)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Backspace') {
        const tag = (e.target as HTMLElement)?.tagName;
        const isEditable = ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || !!(e.target as HTMLElement)?.isContentEditable;
        if (!isEditable) e.preventDefault();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget && !submitting) onClose(); }}>
      <div className="modal-card max-w-[560px] animate-fadeSlide">
        <div className="modal-header">
          <h3 className="font-serif font-bold text-base">📝 录入正文</h3>
          <button onClick={onClose} disabled={submitting}
            className="text-lg bg-transparent border-none cursor-pointer"
            style={{ color: 'var(--ink-300)' }}>✕</button>
        </div>
        <div className="modal-body space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-500)' }}>所属科目</label>
            <select value={subjectId} onChange={e => setSubjectId(e.target.value)} className="input select">
              {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-500)' }}>教材名称</label>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="如：DTIV上册" className="input" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-500)' }}>
              正文内容 <span style={{ color: 'var(--verm)' }}>*必填</span>
            </label>
            <textarea value={content} onChange={e => setContent(e.target.value)}
              placeholder={'请粘贴教材正文内容。支持自然段分隔，小狐狸会自动识别章节标题（如"第一章 数字化转型"）并拆分。\n\n可以直接从 Word、PPT 或 PDF 复制文字过来。'}
              className="input textarea" rows={12} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-500)' }}>
              出题要求 <span className="text-xs" style={{ color: 'var(--ink-400)' }}>（可选）</span>
            </label>
            <textarea value={batchNote} onChange={e => setBatchNote(e.target.value)}
              placeholder={'示例：题型——单选题30道、判断题10道、简答题5道\n难度——60%基础、30%变形、10%场景题'}
              className="input textarea" rows={3} />
          </div>
          {progress && (
            <div className="text-sm text-center py-2" style={{
              color: progress.startsWith('✅') ? 'var(--cyan)' : progress.startsWith('❌') ? 'var(--verm)' : 'var(--fox)',
            }}>{progress}</div>
          )}
        </div>
        <div className="modal-footer">
          <button onClick={onClose} disabled={submitting} className="btn btn-ghost btn-sm">取消</button>
          <button onClick={handleSubmit} disabled={!name.trim() || !subjectId || !content.trim() || submitting}
            className="btn btn-fox btn-sm">
            {submitting ? '提交中…' : '创建教材'}
          </button>
        </div>
      </div>
    </div>
  );
}
