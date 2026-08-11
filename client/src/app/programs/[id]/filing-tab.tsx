'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/components/Toast';

// 备案 Tab：备案状态 + 提交备案弹窗（提交成功后回调刷新培训班）
export default function FilingTab({ programId, onProgramChanged }: { programId: number; onProgramChanged?: () => void }) {
  const toast = useToast();
  const [filing, setFiling] = useState<any>(null);
  const [filingLoading, setFilingLoading] = useState(false);
  const [filingModal, setFilingModal] = useState(false);
  const [filingForm, setFilingForm] = useState({ agencyName: '', agencyContact: '', agencyPhone: '' });
  const [filingSubmitting, setFilingSubmitting] = useState(false);

  const loadFiling = async () => {
    setFilingLoading(true);
    try {
      const all = await api.filing.list({ pageSize: 100 });
      const progFiling = (all.items || []).find((f: any) => f.programId === programId || f.program?.id === programId);
      setFiling(progFiling || null);
    } catch {}
    setFilingLoading(false);
  };

  useEffect(() => { loadFiling(); }, []);

  return (
    <div>
      <div className="card p-5 mb-6 text-center">
        <div className="text-[var(--ink-400)] text-xs mb-2">备案状态</div>
        <div className="text-2xl font-bold mb-1" style={{
          color: !filing ? 'var(--ink-300)' : filing.status === 'PENDING' ? 'var(--fox)' : filing.status === 'APPROVED' ? 'var(--sage)' : 'var(--error)',
        }}>
          {!filing ? '未提交' : filing.status === 'PENDING' ? '待审核' : filing.status === 'APPROVED' ? '已通过' : '已驳回'}
        </div>
      </div>

      {!filing && (
        <div className="card p-6 text-center">
          <p className="text-[var(--ink-400)] text-sm mb-4">尚未提交备案</p>
          <button onClick={async () => {
            const evs = await api.trainingPrograms.getEvidences(programId).catch(() => []);
            if (!evs || evs.length === 0) { toast.warning('请先上传签到表扫描件后再提交备案'); return; }
            setFilingForm({ agencyName: '', agencyContact: '', agencyPhone: '' });
            setFilingModal(true);
          }} className="btn btn-fox">提交备案</button>
        </div>
      )}

      {filing && (
        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="text-sm font-semibold mb-3">审核信息</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-[var(--ink-400)] text-xs">机构名称</span><p>{filing.agencyName}</p></div>
              <div><span className="text-[var(--ink-400)] text-xs">联系人</span><p>{filing.agencyContact} ({filing.agencyPhone})</p></div>
              <div><span className="text-[var(--ink-400)] text-xs">提交人</span><p>{filing.submittedBy?.displayName || '—'}</p></div>
              <div><span className="text-[var(--ink-400)] text-xs">提交时间</span><p>{filing.submittedAt ? new Date(filing.submittedAt).toLocaleString('zh-CN') : '—'}</p></div>
            </div>
          </div>

          {filing.reviewedBy && (
            <div className="card p-5">
              <h3 className="text-sm font-semibold mb-3">审核记录</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-[var(--ink-400)] text-xs">审核人</span><p>{filing.reviewedBy?.displayName || '—'}</p></div>
                <div><span className="text-[var(--ink-400)] text-xs">审核时间</span><p>{filing.reviewedAt ? new Date(filing.reviewedAt).toLocaleString('zh-CN') : '—'}</p></div>
              </div>
              {filing.reviewComment && (
                <div className="mt-2"><span className="text-[var(--ink-400)] text-xs">审核意见</span><p className="text-sm mt-1">{filing.reviewComment}</p></div>
              )}
            </div>
          )}

          {filing.status === 'APPROVED' && (
            <div className="bg-[var(--sage-glow)] card p-5 text-center">
              <p className="text-[var(--sage)] text-sm font-semibold">✅ 备案已通过</p>
              <p className="text-[var(--ink-400)] text-xs mt-1">培训班状态已自动更新为「报名中」</p>
            </div>
          )}
        </div>
      )}

      {/* Filing Submit Modal */}
      {filingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setFilingModal(false)}>
          <div className="rounded-xl p-6 w-full max-w-md bg-[var(--paper)]" style={{  border: '1px solid var(--ink-200)' }} onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-base mb-4">提交备案</h3>
            <div className="space-y-3">
              <div>
                <label className="text-[var(--ink-400)] text-xs mb-1 block">机构名称 *</label>
                <input value={filingForm.agencyName} onChange={e => setFilingForm({ ...filingForm, agencyName: e.target.value })} className="input w-full" placeholder="例如：XX培训机构" />
              </div>
              <div>
                <label className="text-[var(--ink-400)] text-xs mb-1 block">联系人 *</label>
                <input value={filingForm.agencyContact} onChange={e => setFilingForm({ ...filingForm, agencyContact: e.target.value })} className="input w-full" placeholder="姓名" />
              </div>
              <div>
                <label className="text-[var(--ink-400)] text-xs mb-1 block">联系电话 *</label>
                <input value={filingForm.agencyPhone} onChange={e => setFilingForm({ ...filingForm, agencyPhone: e.target.value })} className="input w-full" placeholder="手机号" />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={async () => {
                  if (!filingForm.agencyName || !filingForm.agencyContact || !filingForm.agencyPhone) {
                    toast.warning('请填写完整信息'); return;
                  }
                  setFilingSubmitting(true);
                  try {
                    await api.trainingPrograms.submitFiling(programId, filingForm);
                    setFilingModal(false);
                    loadFiling();
                    onProgramChanged?.();
                  } catch (e: any) { toast.error('提交失败：' + e.message); }
                  setFilingSubmitting(false);
                }} disabled={filingSubmitting} className="btn btn-fox btn-sm">{filingSubmitting ? '提交中…' : '提交'}</button>
                <button onClick={() => setFilingModal(false)} className="btn btn-outline btn-sm">取消</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
