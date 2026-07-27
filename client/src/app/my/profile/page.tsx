'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import { useToast } from '@/components/Toast';

export default function ProfilePage() {
  const router = useRouter();
  const toast = useToast();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const [form, setForm] = useState({
    displayName: '', phone: '', email: '', organization: '',
    title: '', gender: '', remark: '',
  });
  const [activeTab, setActiveTab] = useState<'basic' | 'education' | 'contact' | 'security'>('basic');

  // Password change
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdMsg, setPwdMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const userData = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}') : {};

  const load = async () => {
    try {
      const profileRes = await fetch('/api/user/profile', { headers }).then(r => r.json());
      setProfile(profileRes);
      setForm({
        displayName: profileRes.displayName || '',
        phone: profileRes.phone || '',
        email: profileRes.email || '',
        organization: profileRes.organization || '',
        title: profileRes.title || '',
        gender: profileRes.gender || '',
        remark: profileRes.remark || '',
      });
    } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.warning('头像文件不能超过 5MB'); return; }
    if (!['image/jpeg', 'image/png'].includes(file.type)) { toast.warning('仅支持 JPG/PNG 格式'); return; }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', String(userData.id || ''));
      formData.append('category', 'AVATAR');
      const res = await fetch('/api/attachments/upload', {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (data.id) {
        const avatarUrl = data.filePath?.startsWith('http') ? data.filePath : '/uploads/attachments/' + (data.filePath || '');
        setProfile((p: any) => ({ ...p, avatar: avatarUrl }));
      }
    } catch { toast.error('上传失败'); }
    setUploading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch('/api/user/profile', { method: 'PUT', headers, body: JSON.stringify(form) });
      setEditing(false);
      load();
    } catch (e: any) { toast.error('保存失败：' + e.message); }
    setSaving(false);
  };

  const handleChangePwd = async () => {
    if (!oldPwd || !newPwd) { setPwdMsg('请填写完整'); return; }
    if (newPwd !== confirmPwd) { setPwdMsg('两次输入的密码不一致'); return; }
    if (newPwd.length < 8) { setPwdMsg('新密码至少8位'); return; }
    if (!/[A-Z]/.test(newPwd)) { setPwdMsg('新密码需包含大写字母'); return; }
    if (!/[a-z]/.test(newPwd)) { setPwdMsg('新密码需包含小写字母'); return; }
    if (!/\d/.test(newPwd)) { setPwdMsg('新密码需包含数字'); return; }
    try {
      const res = await fetch('/api/user/password', { method: 'POST', headers, body: JSON.stringify({ oldPassword: oldPwd, newPassword: newPwd }) });
      const data = await res.json();
      if (data.error) { setPwdMsg(data.error); return; }
      setPwdMsg('✅ 密码已修改'); setOldPwd(''); setNewPwd(''); setConfirmPwd('');
    } catch (e: any) { setPwdMsg('修改失败：' + e.message); }
  };

  if (loading) return <AppLayout><div className="text-center py-16" style={{ color: 'var(--ink-300)' }}>小狐狸正在加载… 🦊</div></AppLayout>;
  if (!profile) return <AppLayout><div className="text-center py-16" style={{ color: 'var(--ink-300)' }}>加载失败</div></AppLayout>;

  const roleName: Record<string, string> = { SUPER_ADMIN: '超级管理员', ORG_ADMIN: '机构管理员', LECTURER: '讲师', PROCTOR: '监考员', STUDENT: '学员' };
  const firstRole = (profile.roles || [profile.role || 'STUDENT'])[0];
  const isStudent = firstRole === 'STUDENT';

  // 字段定义按 Tab 分组（展示+编辑共用）
  const basicFields = [
    { key: 'displayName', label: '姓名', type: 'text' },
    { key: 'gender', label: '性别', type: 'select', options: [{ v: '', l: '—' }, { v: 'M', l: '男' }, { v: 'F', l: '女' }] },
    { key: 'title', label: '职务/职称', type: 'text' },
    { key: 'remark', label: '个人简介', type: 'textarea', full: true },
  ];
  const contactFields = [
    { key: 'phone', label: '手机号', type: 'text' },
    { key: 'email', label: '邮箱', type: 'text' },
    { key: 'organization', label: '单位', type: 'text' },
  ];
  // 学历信息（来自 profile，只读展示；如可编辑则进入 form）
  const educationFields = [
    { label: '学历', value: profile.education },
    { label: '毕业院校', value: profile.educationSchool },
    { label: '专业', value: profile.major },
    { label: '毕业时间', value: profile.graduationDate },
    { label: '职称', value: profile.professionalTitle },
    { label: '职称级别', value: profile.professionalLevel },
  ];

  const tabs = [
    { key: 'basic' as const, label: '📋 基本信息' },
    { key: 'education' as const, label: '🎓 学历信息' },
    { key: 'contact' as const, label: '📞 联系信息' },
    { key: 'security' as const, label: '🔒 账号安全' },
  ];

  function renderField(f: { key: string; label: string; type: string; options?: any[]; full?: boolean }) {
    const value = (form as any)[f.key] || '';
    const displayValue = f.type === 'select'
      ? (f.options || []).find((o: any) => o.v === value)?.l || value
      : value;
    return (
      <div key={f.key} className={f.full ? 'sm:col-span-2' : ''}>
        {editing ? (
          <div className="py-3">
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-500)' }}>{f.label}</label>
            {f.type === 'select' ? (
              <select value={value} onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                className="input text-sm w-full">
                {(f.options || []).map((o: any) => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
            ) : f.type === 'textarea' ? (
              <textarea value={value} onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                className="input text-sm w-full" rows={3} />
            ) : (
              <input value={value} onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                className="input text-sm w-full" />
            )}
          </div>
        ) : (
          <div className="flex items-center py-3.5 border-b" style={{ borderColor: 'var(--ink-50)' }}>
            <span className="text-xs w-24 flex-shrink-0" style={{ color: 'var(--ink-400)' }}>{f.label}</span>
            <span className="text-sm" style={{ color: displayValue ? 'var(--ink-700)' : 'var(--ink-200)' }}>
              {displayValue || '未设置'}
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-5">

        {/* ═══ 头部：头像 + 身份 + 操作按钮 ═══ */}
        <div className="card p-6" style={{ background: 'linear-gradient(135deg, #fdf8f3 0%, #f5ede4 100%)' }}>
          <div className="flex items-start gap-5">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div onClick={() => fileInputRef.current?.click()}
                className="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-bold cursor-pointer overflow-hidden transition-opacity hover:opacity-80"
                style={{ background: 'var(--fox-pale)', color: 'var(--fox)' }}>
                {profile.avatar ? (
                  <img src={profile.avatar} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-3xl">{profile.displayName?.[0] || '🦊'}</span>
                )}
              </div>
              <div onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 rounded-2xl flex items-end justify-center pb-1 text-[9px] cursor-pointer bg-black/0 hover:bg-black/30 hover:text-white transition-all">
                <span className="opacity-0 hover:opacity-100">📷</span>
              </div>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={handleAvatarUpload} />
              {uploading && <div className="absolute inset-0 rounded-2xl bg-black/40 flex items-center justify-center text-white text-xs">上传中…</div>}
            </div>

            {/* Identity */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <h1 className="text-xl font-bold" style={{ color: 'var(--ink-800)' }}>{profile.displayName || '未设置姓名'}</h1>
                  <p className="text-xs" style={{ color: 'var(--ink-400)' }}>
                    @{profile.username}
                    {profile.studentNumber && (
                      <span className="ml-2">· 学号 <strong style={{ color: 'var(--ink-500)' }}>{profile.studentNumber}</strong></span>
                    )}
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <span className="text-[10px] px-2.5 py-1 rounded-full font-medium"
                      style={{ background: 'var(--fox-glow)', color: 'var(--fox)' }}>
                      {roleName[firstRole] || firstRole}
                    </span>
                    {profile.orgName && (
                      <span className="text-[10px] px-2.5 py-1 rounded-full"
                        style={{ background: 'var(--ink-100)', color: 'var(--ink-500)' }}>
                        🏢 {profile.orgName}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => { setEditing(!editing); }}
                    className={`btn btn-xs ${editing ? 'btn-ghost' : 'btn-fox'}`}>
                    {editing ? '✕ 取消' : '✏️ 编辑'}
                  </button>
                  <button onClick={() => setActiveTab('security')}
                    className="btn btn-outline btn-xs">
                    🔒 密码
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ═══ Tab 切换 ═══ */}
        <div className="flex gap-1 p-0.5 rounded-lg flex-wrap" style={{ background: 'var(--paper-dark)', width: 'fit-content' }}>
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="px-3.5 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer"
              style={{
                background: activeTab === tab.key ? 'var(--paper-bright)' : 'transparent',
                color: activeTab === tab.key ? 'var(--fox)' : 'var(--ink-400)',
                boxShadow: activeTab === tab.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ═══ 基本信息 Tab ═══ */}
        {activeTab === 'basic' && (
          <div className="card p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-bold" style={{ color: 'var(--ink-700)' }}>📋 基本信息</h2>
              {editing && <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: '#f59e0b18', color: '#f59e0b' }}>编辑模式</span>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-0">
              {basicFields.map(f => renderField(f))}
            </div>
            {editing && (
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t" style={{ borderColor: 'var(--ink-100)' }}>
                <button onClick={() => setEditing(false)} className="btn btn-ghost btn-sm">取消</button>
                <button onClick={handleSave} disabled={saving} className="btn btn-fox btn-sm">
                  {saving ? '保存中…' : '💾 保存'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ═══ 学历信息 Tab ═══ */}
        {activeTab === 'education' && (
          <div className="card p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-bold" style={{ color: 'var(--ink-700)' }}>🎓 学历信息</h2>
              <span className="text-[10px]" style={{ color: 'var(--ink-300)' }}>如需修改请联系管理员</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-0">
              {educationFields.map(f => (
                <div key={f.label} className="flex items-center py-3.5 border-b" style={{ borderColor: 'var(--ink-50)' }}>
                  <span className="text-xs w-24 flex-shrink-0" style={{ color: 'var(--ink-400)' }}>{f.label}</span>
                  <span className="text-sm" style={{ color: f.value ? 'var(--ink-700)' : 'var(--ink-200)' }}>
                    {f.value || '未设置'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ 联系信息 Tab ═══ */}
        {activeTab === 'contact' && (
          <div className="card p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-bold" style={{ color: 'var(--ink-700)' }}>📞 联系信息</h2>
              {editing && <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: '#f59e0b18', color: '#f59e0b' }}>编辑模式</span>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-0">
              {contactFields.map(f => renderField(f))}
            </div>
            {editing && (
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t" style={{ borderColor: 'var(--ink-100)' }}>
                <button onClick={() => setEditing(false)} className="btn btn-ghost btn-sm">取消</button>
                <button onClick={handleSave} disabled={saving} className="btn btn-fox btn-sm">
                  {saving ? '保存中…' : '💾 保存'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ═══ 账号安全 Tab ═══ */}
        {activeTab === 'security' && (
          <div className="card p-6">
            <h2 className="text-sm font-bold mb-5" style={{ color: 'var(--ink-700)' }}>🔒 账号安全</h2>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-500)' }}>当前密码</label>
                  <input type="password" value={oldPwd} onChange={e => setOldPwd(e.target.value)}
                    className="input text-sm w-full" placeholder="输入当前密码" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-500)' }}>新密码</label>
                  <input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)}
                    className="input text-sm w-full" placeholder="至少8位，含大小写字母和数字" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-500)' }}>确认新密码</label>
                  <input type="password" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)}
                    className="input text-sm w-full" placeholder="再次输入新密码" />
                </div>
              </div>

              {/* Password strength */}
              {newPwd && (
                <div>
                  <div className="h-1.5 rounded-full" style={{ background: 'var(--ink-100)' }}>
                    <div className="h-full rounded-full transition-all" style={{
                      width: `${Math.min(100, newPwd.length * 16)}%`,
                      background: newPwd.length < 6 ? '#ef4444' : newPwd.length < 10 ? '#f59e0b' : '#2e7d32',
                    }} />
                  </div>
                  <div className="text-[10px] mt-0.5" style={{ color: 'var(--ink-300)' }}>
                    {newPwd.length < 6 ? '弱' : newPwd.length < 10 ? '中' : '强'}
                  </div>
                </div>
              )}

              <button onClick={handleChangePwd} className="btn btn-fox btn-sm">确认修改</button>
              {pwdMsg && <p className="text-xs mt-2" style={{ color: pwdMsg.includes('✅') ? '#2e7d32' : '#ef4444' }}>{pwdMsg}</p>}

              {/* Login info */}
              <div className="pt-5 mt-5 border-t grid grid-cols-2 gap-3 text-xs" style={{ borderColor: 'var(--ink-50)', color: 'var(--ink-400)' }}>
                <div>
                  <span className="block" style={{ color: 'var(--ink-300)' }}>上次登录</span>
                  {profile.lastLoginAt ? new Date(profile.lastLoginAt).toLocaleString('zh-CN') : '—'}
                </div>
                <div>
                  <span className="block" style={{ color: 'var(--ink-300)' }}>登录次数</span>
                  {profile.loginCount ?? 0} 次
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══ 固定底部保存按钮（编辑模式下显示）═══ */}
        {editing && (activeTab === 'basic' || activeTab === 'contact') && (
          <div
            className="sticky bottom-0 flex justify-end gap-3 py-3 px-4 -mx-0 border-t"
            style={{ borderColor: 'var(--ink-100)', background: 'var(--paper-bright)' }}
          >
            <button onClick={() => setEditing(false)} className="btn btn-ghost btn-sm">取消</button>
            <button onClick={handleSave} disabled={saving} className="btn btn-fox btn-sm">
              {saving ? '保存中…' : '💾 保存'}
            </button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
