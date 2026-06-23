'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [learningStats, setLearningStats] = useState<any>(null);
  const [certificates, setCertificates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const [form, setForm] = useState({
    displayName: '', phone: '', email: '', organization: '',
    title: '', gender: '', remark: '',
  });

  // Password change
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [pwdMsg, setPwdMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const userData = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}') : {};

  const load = async () => {
    try {
      const [profileRes, certRes] = await Promise.all([
        fetch('/api/user/profile', { headers }).then(r => r.json()),
        fetch('/api/learning-hours/stats', { headers }).then(r => r.json()).catch(() => null),
      ]);
      setProfile(profileRes);
      setLearningStats(certRes);
      setForm({
        displayName: profileRes.displayName || '',
        phone: profileRes.phone || '',
        email: profileRes.email || '',
        organization: profileRes.organization || '',
        title: profileRes.title || '',
        gender: profileRes.gender || '',
        remark: profileRes.remark || '',
      });
      // Load certificates
      const studentId = userData.id || profileRes.id;
      if (studentId) {
        const cRes = await fetch(`/api/certificates/my?studentId=${studentId}`, { headers });
        const cData = await cRes.json();
        setCertificates(Array.isArray(cData) ? cData : []);
      }
    } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('头像文件不能超过 5MB'); return; }
    if (!['image/jpeg', 'image/png'].includes(file.type)) { alert('仅支持 JPG/PNG 格式'); return; }
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
    } catch { alert('上传失败'); }
    setUploading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch('/api/user/profile', { method: 'PUT', headers, body: JSON.stringify(form) });
      setEditing(false);
      load();
    } catch (e: any) { alert('保存失败：' + e.message); }
    setSaving(false);
  };

  const handleChangePwd = async () => {
    if (!oldPwd || !newPwd) { setPwdMsg('请填写完整'); return; }
    if (newPwd.length < 8) { setPwdMsg('新密码至少8位'); return; }
    if (!/[A-Z]/.test(newPwd)) { setPwdMsg('新密码需包含大写字母'); return; }
    if (!/[a-z]/.test(newPwd)) { setPwdMsg('新密码需包含小写字母'); return; }
    if (!/\d/.test(newPwd)) { setPwdMsg('新密码需包含数字'); return; }
    try {
      const res = await fetch('/api/user/password', { method: 'POST', headers, body: JSON.stringify({ oldPassword: oldPwd, newPassword: newPwd }) });
      const data = await res.json();
      if (data.error) { setPwdMsg(data.error); return; }
      setPwdMsg('✅ 密码已修改'); setOldPwd(''); setNewPwd('');
    } catch (e: any) { setPwdMsg('修改失败：' + e.message); }
  };

  const downloadCert = async (id: number) => {
    try {
      const res = await fetch(`/api/certificates/${id}/pdf`, { headers });
      if (!res.ok) throw new Error('下载失败');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `certificate-${id}.pdf`;
      a.click(); URL.revokeObjectURL(url);
    } catch (e: any) { alert('下载失败'); }
  };

  if (loading) return <AppLayout><div className="text-center py-16" style={{ color: 'var(--ink-300)' }}>小狐狸正在加载… 🦊</div></AppLayout>;
  if (!profile) return <AppLayout><div className="text-center py-16" style={{ color: 'var(--ink-300)' }}>加载失败</div></AppLayout>;

  const roleName: Record<string, string> = { SUPER_ADMIN: '超级管理员', ORG_ADMIN: '机构管理员', LECTURER: '讲师', PROCTOR: '监考员', STUDENT: '学员' };
  const firstRole = (profile.roles || [profile.role || 'STUDENT'])[0];
  const isStudent = firstRole === 'STUDENT';
  const passedCount = profile.stats?.passedCount ?? 0;
  const examCount = profile.stats?.examCount ?? 0;
  const certCount = profile.stats?.certCount ?? certificates?.length ?? 0;
  const totalHours = learningStats?.totalHours ?? 0;
  const passRate = examCount > 0 ? Math.round((passedCount / examCount) * 100) : 0;

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-5">
        {/* Top Profile Card */}
        <div className="card p-6">
          <div className="flex items-start gap-6">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div onClick={() => fileInputRef.current?.click()}
                className="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-bold cursor-pointer overflow-hidden transition-opacity hover:opacity-80"
                style={{ background: 'var(--fox-pale)', color: 'var(--fox)' }}>
                {profile.avatar ? (
                  <img src={profile.avatar} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  profile.displayName?.[0] || '🦊'
                )}
              </div>
              <div onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 rounded-2xl flex items-end justify-center pb-1 text-[9px] cursor-pointer bg-black/0 hover:bg-black/30 hover:text-white transition-all">
                <span className="opacity-0 hover:opacity-100">📷</span>
              </div>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={handleAvatarUpload} />
              {uploading && <div className="absolute inset-0 rounded-2xl bg-black/40 flex items-center justify-center text-white text-xs">上传中…</div>}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold" style={{ color: 'var(--ink-700)' }}>{profile.displayName}</h2>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--ink-400)' }}>@{profile.username}</p>
                  <div className="flex gap-2 mt-1">
                    <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'var(--fox-glow)', color: 'var(--fox)' }}>
                      {roleName[firstRole] || firstRole}
                    </span>
                    {profile.orgName && <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'var(--ink-100)', color: 'var(--ink-400)' }}>{profile.orgName}</span>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setEditing(!editing)} className="btn btn-fox btn-xs">✏️ 编辑</button>
                  <button onClick={() => setShowPwd(!showPwd)} className="btn btn-outline btn-xs">🔑 密码</button>
                </div>
              </div>

              {/* Stats row */}
              {isStudent && (
                <div className="grid grid-cols-4 gap-3 mt-5">
                  {[
                    { value: `${totalHours}h`, label: '总学时', color: 'var(--fox)' },
                    { value: passedCount, label: '通过考试', color: '#2e7d32' },
                    { value: `${passRate}%`, label: '通过率', color: '#1565c0' },
                    { value: certCount, label: '证书', color: '#7b1fa2' },
                  ].map((s, i) => (
                    <div key={i} className="text-center p-3 rounded-xl" style={{ background: 'var(--paper)' }}>
                      <div className="text-xl font-bold" style={{ color: s.color }}>{s.value}</div>
                      <div className="text-[10px] mt-0.5" style={{ color: 'var(--ink-300)' }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Progress bars for students */}
              {isStudent && learningStats?.totalHours > 0 && (
                <div className="mt-4 space-y-2">
                  <div>
                    <div className="flex justify-between text-[10px] mb-1" style={{ color: 'var(--ink-400)' }}>
                      <span>学时进度</span><span>{totalHours}h</span>
                    </div>
                    <div className="h-2 rounded-full" style={{ background: 'var(--ink-100)' }}>
                      <div className="h-full rounded-full bg-[var(--fox)]" style={{ width: `${Math.min(100, totalHours / 2)}%` }} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Editable fields inline */}
        {editing && (
          <div className="card p-5">
            <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--ink-700)' }}>编辑资料</h3>
            <div className="grid grid-cols-2 gap-4">
              {[
                { key: 'displayName', label: '姓名', type: 'text' },
                { key: 'phone', label: '手机号', type: 'text' },
                { key: 'email', label: '邮箱', type: 'text' },
                { key: 'organization', label: '单位', type: 'text' },
                { key: 'title', label: '职务/职称', type: 'text' },
                { key: 'gender', label: '性别', type: 'select', options: [{ v: '', l: '—' }, { v: 'M', l: '男' }, { v: 'F', l: '女' }] },
                { key: 'remark', label: '个人简介', type: 'textarea', full: true },
              ].map((f: any) => (
                <div key={f.key} className={f.full ? 'col-span-2' : ''}>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>{f.label}</label>
                  {f.type === 'select' ? (
                    <select value={(form as any)[f.key]} onChange={e => setForm({...form, [f.key]: e.target.value})} className="input select">
                      {f.options.map((o: any) => <option key={o.v} value={o.v}>{o.l}</option>)}
                    </select>
                  ) : f.type === 'textarea' ? (
                    <textarea value={(form as any)[f.key]} onChange={e => setForm({...form, [f.key]: e.target.value})} className="input textarea" rows={3} />
                  ) : (
                    <input value={(form as any)[f.key]} onChange={e => setForm({...form, [f.key]: e.target.value})} className="input" />
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setEditing(false)} className="btn btn-ghost btn-sm">取消</button>
              <button onClick={handleSave} disabled={saving} className="btn btn-fox btn-sm">{saving ? '保存中…' : '💾 保存'}</button>
            </div>
          </div>
        )}

        {/* Certificates Section */}
        {isStudent && certificates.length > 0 && (
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold" style={{ color: 'var(--ink-700)' }}>🏅 我的证书（{certificates.length}）</h3>
              <button onClick={() => router.push('/my-certificates')} className="text-xs bg-transparent border-none cursor-pointer" style={{ color: 'var(--fox)' }}>查看全部 →</button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {certificates.slice(0, 6).map((cert: any) => (
                <div key={cert.id} className="p-4 rounded-xl text-center" style={{ background: 'var(--paper)', border: '1px solid var(--ink-100)' }}>
                  <div className="text-2xl mb-2">🏅</div>
                  <div className="text-xs font-medium" style={{ color: 'var(--ink-600)' }}>{cert.courseName}</div>
                  {cert.issueDate && <div className="text-[10px] mt-1" style={{ color: 'var(--ink-300)' }}>{new Date(cert.issueDate).toLocaleDateString('zh-CN')}</div>}
                  {cert.isRevoked ? (
                    <span className="text-[10px] inline-block mt-2 px-2 py-0.5 rounded-full" style={{ background: '#ef444418', color: '#ef4444' }}>已撤销</span>
                  ) : (
                    <button onClick={(e) => { e.stopPropagation(); downloadCert(cert.id); }} className="text-[10px] mt-2 bg-transparent border-none cursor-pointer" style={{ color: 'var(--fox)' }}>
                      📥 下载
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Security Settings */}
        {showPwd && (
          <div className="card p-5">
            <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--ink-700)' }}>🔒 安全设置</h3>
            <div className="space-y-4 max-w-sm">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>当前密码</label>
                <input type="password" value={oldPwd} onChange={e => setOldPwd(e.target.value)} className="input" placeholder="输入当前密码" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-500)' }}>新密码</label>
                <input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} className="input" placeholder="至少8位，需包含大小写字母和数字" />
                {/* Password strength bar */}
                <div className="mt-1 h-1 rounded-full" style={{ background: 'var(--ink-100)' }}>
                  <div className="h-full rounded-full transition-all" style={{
                    width: `${Math.min(100, newPwd.length * 16)}%`,
                    background: newPwd.length < 6 ? '#ef4444' : newPwd.length < 10 ? '#f59e0b' : '#2e7d32',
                  }} />
                </div>
                <div className="text-[10px] mt-0.5" style={{ color: 'var(--ink-300)' }}>
                  {newPwd.length === 0 ? '' : newPwd.length < 6 ? '弱' : newPwd.length < 10 ? '中' : '强'}
                </div>
              </div>
              <button onClick={handleChangePwd} className="btn btn-fox btn-sm">确认修改</button>
              {pwdMsg && <p className="text-xs" style={{ color: pwdMsg.includes('✅') ? 'var(--cyan)' : 'var(--verm)' }}>{pwdMsg}</p>}
            </div>

            {/* Login info */}
            <div className="mt-6 pt-4 border-t" style={{ borderColor: 'var(--ink-100)' }}>
              <h4 className="text-xs font-semibold mb-2" style={{ color: 'var(--ink-500)' }}>登录信息</h4>
              <div className="grid grid-cols-2 gap-3 text-xs" style={{ color: 'var(--ink-400)' }}>
                <div>上次登录：{profile.lastLoginAt ? new Date(profile.lastLoginAt).toLocaleString('zh-CN') : '—'}</div>
                <div>登录次数：{profile.loginCount ?? 0} 次</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
