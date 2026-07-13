'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import { useToast } from '@/components/Toast';
import { api } from '@/lib/api';

export default function NewInstructorPage() {
  const router = useRouter();
  const toast = useToast();
  const [users, setUsers] = useState<any[]>([]);
  const [form, setForm] = useState({
    userId: '', realName: '', title: '', phone: '', email: '', avatar: '',
    bio: '', expertise: '', qualification: '', level: 'JUNIOR', isGrader: true, remark: '',
    type: 'INTERNAL', workUnit: '', education: '', school: '', gender: '',
    idCard: '', bankAccount: '', contractExpire: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.students.list({ pageSize: '200' }).then((d: any) => {
      setUsers(d.items || []);
    }).catch(() => {});
  }, []);

  const handleSubmit = async () => {
    if (!form.userId) { toast.warning('请选择关联用户'); return; }
    if (!form.realName) { toast.warning('请输入姓名'); return; }
    if (form.type === 'EXTERNAL' && !form.idCard) { toast.warning('外聘讲师必须填写身份证号'); return; }
    setSaving(true);
    try {
      await api.instructors.create({
        ...form,
        userId: parseInt(form.userId),
        contractExpire: form.contractExpire || undefined,
      });
      router.push('/instructors');
    } catch (e: any) { toast.error('保存失败：' + e.message); }
    setSaving(false);
  };

  return (
    <AppLayout>
      <button onClick={() => router.push('/instructors')} className="text-xs bg-transparent border-none cursor-pointer mb-4" style={{ color: 'var(--fox)' }}>← 返回讲师列表</button>
      <h1 className="page-title">新建讲师</h1>
      <p className="page-subtitle mb-6">添加新的讲师信息</p>

      <div className="card p-6 max-w-2xl">
        <div className="space-y-4">
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>关联用户 *</label>
            <select value={form.userId} onChange={e => setForm({ ...form, userId: e.target.value })} className="input select w-full">
              <option value="">选择用户…</option>
              {users.map((u: any) => (
                <option key={u.id} value={u.id}>{u.displayName} ({u.username})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>姓名 *</label>
            <input value={form.realName} onChange={e => setForm({ ...form, realName: e.target.value })} className="input w-full" placeholder="讲师真实姓名" />
          </div>

          {/* ⭐ 类型 + 工作单位 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>讲师类型 *</label>
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="input select w-full">
                <option value="INTERNAL">内部讲师</option>
                <option value="EXTERNAL">外聘讲师</option>
              </select>
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>工作单位</label>
              <input value={form.workUnit} onChange={e => setForm({ ...form, workUnit: e.target.value })} className="input w-full" placeholder="所在单位全称" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>职称</label>
              <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="input w-full" placeholder="教授/高工/讲师" />
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
              <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="input w-full" placeholder="手机号" />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>邮箱</label>
              <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="input w-full" placeholder="电子邮箱" />
            </div>
          </div>

          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>简介</label>
            <textarea value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} className="input w-full" rows={3} placeholder="讲师简介" />
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>擅长领域（逗号分隔）</label>
            <input value={form.expertise} onChange={e => setForm({ ...form, expertise: e.target.value })} className="input w-full" placeholder="例如：数据分析,数字化转型" />
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>资格/资质</label>
            <input value={form.qualification} onChange={e => setForm({ ...form, qualification: e.target.value })} className="input w-full" />
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
              <input value={form.school} onChange={e => setForm({ ...form, school: e.target.value })} className="input w-full" placeholder="学校全称" />
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
                  <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>身份证号 *</label>
                  <input value={form.idCard} onChange={e => setForm({ ...form, idCard: e.target.value })} className="input w-full" placeholder="18位" maxLength={18} />
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>银行账户</label>
                  <input value={form.bankAccount} onChange={e => setForm({ ...form, bankAccount: e.target.value })} className="input w-full" placeholder="开户行+卡号" />
                </div>
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--ink-400)' }}>签约有效期至</label>
                <input type="date" value={form.contractExpire} onChange={e => setForm({ ...form, contractExpire: e.target.value })} className="input w-full" />
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
