'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import { useToast } from '@/components/Toast';
import { api } from '@/lib/api';

export default function EditInstructorPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.instructors.get(Number(params.id)).then((data: any) => {
      setForm({
        realName: data.realName || '', title: data.title || '', phone: data.phone || '',
        email: data.email || '', avatar: data.avatar || '', bio: data.bio || '',
        expertise: data.expertise || '', qualification: data.qualification || '',
        level: data.level || 'JUNIOR', isGrader: data.isGrader ?? true, remark: data.remark || '',
        type: data.type || 'INTERNAL', workUnit: data.workUnit || '',
        education: data.education || '', school: data.school || '', gender: data.gender || '',
        idCard: data.idCard || '', bankAccount: data.bankAccount || '',
        contractExpire: data.contractExpire || '',
      });
    }).catch(() => router.push('/instructors')).finally(() => setLoading(false));
  }, []);

  const handleSubmit = async () => {
    if (!form.realName) { toast.warning('请输入姓名'); return; }
    setSaving(true);
    try {
      await api.instructors.update(Number(params.id), {
        ...form,
        contractExpire: form.contractExpire || undefined,
      });
      router.push('/instructors');
    } catch (e: any) { toast.error('保存失败：' + e.message); }
    setSaving(false);
  };

  if (loading) return <AppLayout><div className="text-center py-16" style={{ color: 'var(--ink-300)' }}>小狐狸正在加载… 🦊</div></AppLayout>;
  if (!form) return null;

  return (
    <AppLayout>
      <button onClick={() => router.push('/instructors')} className="text-xs bg-transparent border-none cursor-pointer mb-4" style={{ color: 'var(--fox)' }}>← 返回讲师列表</button>
      <h1 className="page-title">编辑讲师</h1>
      <p className="page-subtitle mb-6">修改讲师信息</p>

      <div className="card p-6 max-w-2xl">
        <div className="space-y-4">
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>姓名 *</label>
            <input value={form.realName} onChange={e => setForm({ ...form, realName: e.target.value })} className="input w-full" />
          </div>

          {/* ⭐ 类型 + 工作单位 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>讲师类型</label>
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="input select w-full">
                <option value="INTERNAL">内部讲师</option><option value="EXTERNAL">外聘讲师</option>
              </select>
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>工作单位</label>
              <input value={form.workUnit} onChange={e => setForm({ ...form, workUnit: e.target.value })} className="input w-full" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>职称</label>
              <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="input w-full" />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>级别</label>
              <select value={form.level} onChange={e => setForm({ ...form, level: e.target.value })} className="input select w-full">
                <option value="JUNIOR">初级</option>
                <option value="MIDDLE">中级</option>
                <option value="SENIOR">高级</option>
                <option value="EXPERT">专家</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>电话</label>
              <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="input w-full" />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>邮箱</label>
              <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="input w-full" />
            </div>
          </div>

          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>简介</label>
            <textarea value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} className="input w-full" rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>擅长领域</label>
              <input value={form.expertise} onChange={e => setForm({ ...form, expertise: e.target.value })} className="input w-full" />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>资格/资质</label>
              <input value={form.qualification} onChange={e => setForm({ ...form, qualification: e.target.value })} className="input w-full" />
            </div>
          </div>

          {/* ⭐ 学历 + 毕业院校 + 性别 */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>最高学历</label>
              <select value={form.education} onChange={e => setForm({ ...form, education: e.target.value })} className="input select w-full">
                <option value="">—</option>
                <option value="博士">博士</option><option value="硕士">硕士</option>
                <option value="本科">本科</option><option value="大专">大专</option>
              </select>
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>毕业院校</label>
              <input value={form.school} onChange={e => setForm({ ...form, school: e.target.value })} className="input w-full" />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>性别</label>
              <select value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })} className="input select w-full">
                <option value="">保密</option><option value="男">男</option><option value="女">女</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="isGrader" checked={form.isGrader} onChange={e => setForm({ ...form, isGrader: e.target.checked })} />
            <label htmlFor="isGrader" className="text-sm">可参与阅卷</label>
          </div>

          {/* ⭐ 外聘专属字段 */}
          {form.type === 'EXTERNAL' && (
            <div className="p-4 rounded-lg space-y-4" style={{ background: 'var(--paper)', border: '1px solid var(--fox)' }}>
              <p className="text-xs font-semibold" style={{ color: 'var(--fox)' }}>外聘讲师信息（课酬发放用）</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>身份证号</label>
                  <input value={form.idCard} onChange={e => setForm({ ...form, idCard: e.target.value })} className="input w-full" maxLength={18} />
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>银行账户</label>
                  <input value={form.bankAccount} onChange={e => setForm({ ...form, bankAccount: e.target.value })} className="input w-full" />
                </div>
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>签约有效期至</label>
                <input type="date" value={form.contractExpire?.slice(0, 10) || ''} onChange={e => setForm({ ...form, contractExpire: e.target.value })} className="input w-full" />
              </div>
            </div>
          )}

          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>备注</label>
            <textarea value={form.remark} onChange={e => setForm({ ...form, remark: e.target.value })} className="input w-full" rows={2} />
          </div>

          <div className="flex gap-3 pt-4">
            <button onClick={handleSubmit} disabled={saving} className="btn btn-fox">{saving ? '保存中…' : '保存'}</button>
            <button onClick={() => router.push('/instructors')} className="btn btn-outline">取消</button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
