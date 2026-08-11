'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/components/Toast';
import ReasonConfirmModal from '@/components/ReasonConfirmModal';

// 证据 Tab：签到表生成 + 证据文件上传/下载/删除
export default function EvidencesTab({ programId, programName }: { programId: number; programName: string }) {
  const toast = useToast();
  const [evidences, setEvidences] = useState<any[]>([]);
  const [evidencesLoading, setEvidencesLoading] = useState(false);
  const [uploadModal, setUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadType, setUploadType] = useState('ATTENDANCE_SHEET');
  const [uploadNotes, setUploadNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [signinGenerating, setSigninGenerating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);

  const loadEvidences = async () => {
    setEvidencesLoading(true);
    try { setEvidences(await api.trainingPrograms.getEvidences(programId) || []); } catch {}
    setEvidencesLoading(false);
  };

  useEffect(() => { loadEvidences(); }, []);

  const handleDeleteWithReason = async (reason: string) => {
    if (deleteTarget === null) return;
    try {
      await api.trainingPrograms.deleteEvidence(programId, deleteTarget);
      toast.success('证据文件已删除');
      setDeleteTarget(null);
      loadEvidences();
    } catch (e: any) { toast.error('删除失败：' + e.message); }
  };

  const generateSigninSheet = async () => {
    setSigninGenerating(true);
    try {
      const res = await fetch(`/api/training-programs/${programId}/generate-signin-sheet`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `签到表_${programName}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) { toast.error('生成失败：' + e.message); }
    setSigninGenerating(false);
  };

  return (
    <div>
      <div className="flex gap-3 mb-4">
        <button onClick={generateSigninSheet} disabled={signinGenerating} className="btn btn-fox btn-sm">
          {signinGenerating ? '生成中…' : '📄 生成签到表'}
        </button>
        <button onClick={() => setUploadModal(true)} className="btn btn-outline btn-sm">📎 上传证据文件</button>
      </div>

      <div className="card p-0 overflow-hidden">
        {evidencesLoading ? (
          <div className="text-[var(--ink-300)] p-10 text-center text-xs">加载中…</div>
        ) : evidences.length === 0 ? (
          <div className="text-[var(--ink-300)] p-10 text-center text-xs">暂无证据文件</div>
        ) : (
          <div className="overflow-x-auto">
          <table className="list-table">
            <thead><tr><th>文件名</th><th>类型</th><th>上传者</th><th>上传时间</th><th>备注</th><th>操作</th></tr></thead>
            <tbody>
              {evidences.map((e: any) => (
                <tr key={e.id}>
                  <td>
                    <a href={api.trainingPrograms.downloadEvidence(programId, e.id)}
                      target="_blank" className="text-[var(--fox)] text-sm">{e.fileName}</a>
                  </td>
                  <td><span className="tag" style={{
                    background: e.evidenceType === 'ATTENDANCE_SHEET' ? 'var(--cyan-glow)' : 'var(--fox-glow)',
                    color: e.evidenceType === 'ATTENDANCE_SHEET' ? 'var(--info)' : 'var(--ink-300)',
                    fontSize: '10px',
                  }}>{e.evidenceType === 'ATTENDANCE_SHEET' ? '签到表' : e.evidenceType === 'SCORING' ? '成绩表' : e.evidenceType === 'SCHEDULE' ? '排课表' : '其他'}</span></td>
                  <td className="text-[var(--ink-400)] text-xs">{e.uploadedBy?.displayName || '—'}</td>
                  <td className="text-[var(--ink-300)] text-xs">{new Date(e.createdAt).toLocaleString('zh-CN')}</td>
                  <td className="text-[var(--ink-400)] text-xs">{e.notes || '—'}</td>
                  <td>
                    <button onClick={() => setDeleteTarget(e.id)} className="text-xs bg-transparent border-none cursor-pointer text-[var(--error)]" >删除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {uploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => !uploading && setUploadModal(false)}>
          <div className="rounded-xl p-6 w-full max-w-md bg-[var(--paper)]" style={{  border: '1px solid var(--ink-200)' }} onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-base mb-4">上传证据文件</h3>
            <div className="space-y-3">
              <div>
                <label className="text-[var(--ink-400)] text-xs mb-1 block">文件</label>
                <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setUploadFile(e.target.files?.[0] || null)} className="input w-full" />
              </div>
              <div>
                <label className="text-[var(--ink-400)] text-xs mb-1 block">证据类型</label>
                <select value={uploadType} onChange={e => setUploadType(e.target.value)} className="input select w-full">
                  <option value="ATTENDANCE_SHEET">签到表</option>
                  <option value="SCORING">成绩表</option>
                  <option value="SCHEDULE">排课表</option>
                  <option value="OTHER">其他</option>
                </select>
              </div>
              <div>
                <label className="text-[var(--ink-400)] text-xs mb-1 block">备注</label>
                <input value={uploadNotes} onChange={e => setUploadNotes(e.target.value)} className="input w-full" placeholder="可选" />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={async () => {
                  if (!uploadFile) { toast.warning('请选择文件'); return; }
                  setUploading(true);
                  try {
                    const fd = new FormData();
                    fd.append('file', uploadFile);
                    fd.append('evidenceType', uploadType);
                    fd.append('notes', uploadNotes);
                    await api.trainingPrograms.uploadEvidence(programId, fd);
                    setUploadModal(false);
                    setUploadFile(null);
                    setUploadNotes('');
                    loadEvidences();
                  } catch (e: any) { toast.error('上传失败：' + e.message); }
                  setUploading(false);
                }} disabled={uploading} className="btn btn-fox btn-sm">{uploading ? '上传中…' : '上传'}</button>
                <button onClick={() => setUploadModal(false)} className="btn btn-outline btn-sm">取消</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 证据文件删除弹窗 */}
      <ReasonConfirmModal
        open={deleteTarget !== null}
        title="🗑 删除文件"
        required
        presetReasons={['文件上传错误', '文件已过时', '重复上传']}
        confirmText="确认删除"
        onConfirm={handleDeleteWithReason}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
