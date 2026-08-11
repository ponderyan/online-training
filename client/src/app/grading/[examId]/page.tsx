'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppLayout from '@/components/app-layout';
import { useToast } from '@/components/Toast';
import Loading from '@/components/Loading';
import { api } from '@/lib/api';
import ReasonConfirmModal from '@/components/ReasonConfirmModal';
import ByQuestionGrading from './ByQuestionGrading';
import GradingProgress from './GradingProgress';
import GradingTab from './grading-tab';
import AppealsTab from './appeals-tab';

export default function GradingDetail() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const examId = parseInt(params.examId as string);
  const [exam, setExam] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [myAssignments, setMyAssignments] = useState<any[]>([]);
  const [assignedSessionIds, setAssignedSessionIds] = useState<Set<number>>(new Set());
  const [assignedQuestionIds, setAssignedQuestionIds] = useState<Set<number>>(new Set());
  const [viewFilter, setViewFilter] = useState<'mine' | 'all'>('mine');
  const [userRole, setUserRole] = useState<string>('');
  const [confirmModal, setConfirmModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [blind, setBlind] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [activeTab, setActiveTab] = useState<'grading' | 'byQuestion' | 'appeals' | 'progress'>('grading');

  useEffect(() => {
    Promise.all([
      api.exams.get(examId),
      api.exams.students(examId),
    ]).then(([e, s]) => {
      setExam(e);
      setStudents(s?.filter((st: any) => st.status === 'SUBMITTED') || []);
    }).catch((e: any) => {
      console.error('加载考试数据失败:', e);
      toast.error('加载考试数据失败：' + (e.message || '未知错误'));
    }).finally(() => setLoading(false));
  }, [examId]);

  // 获取当前用户角色 + 分派信息
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    setUserRole(user.role || '');
    const userId = user.id;
    const isOfficer = user.role === 'ORG_ADMIN' || user.role === 'SUPER_ADMIN';

    if (!isOfficer && examId) {
      fetch(`/api/grading-assignments/${examId}?graderId=${userId}`,
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      ).then(r => {
        if (!r.ok) throw new Error(`获取分派失败 (${r.status})`);
        return r.json();
      }).then(data => {
        const items = data.assignments || (Array.isArray(data) ? data : []);
        setMyAssignments(items);
        setAssignedSessionIds(new Set(items.filter((a: any) => a.sessionId !== null).map((a: any) => a.sessionId)));
        setAssignedQuestionIds(new Set(items.filter((a: any) => a.paperQuestionId !== null).map((a: any) => a.paperQuestionId)));
      }).catch(e => {
        console.error('获取分派信息失败:', e);
      });
    } else {
      setViewFilter('all');
    }
  }, [examId]);

  // 刷新学员列表（发布/确认锁存后调用）
  const reloadStudents = async () => {
    const d = await api.exams.students(examId);
    setStudents(d?.filter((st: any) => st.status === 'SUBMITTED') || []);
  };

  const handleConfirm = async () => {
    setConfirmModal(true);
  };

  const doConfirm = async (reason: string) => {
    if (!reason) return;
    setConfirming(true);
    setConfirmModal(false);
    try {
      const token = localStorage.getItem('token');
      await fetch(`/api/grading/${examId}/confirm`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      toast.success('成绩已确认锁存');
      await reloadStudents();
    } catch (e: any) { toast.error('操作失败：' + e.message); }
    setConfirming(false);
  };

  if (loading) return <AppLayout><Loading text="正在加载阅卷数据…" /></AppLayout>;

  const filteredStudents = viewFilter === 'mine' && assignedSessionIds.size > 0
    ? students.filter((s: any) => assignedSessionIds.has(s.id))
    : students;
  const allPub = students.length > 0 && students.every((s: any) => s.scoringStatus === 'PUBLISHED' || s.scoringStatus === 'CONFIRMED');
  const allConf = students.length > 0 && students.every((s: any) => s.scoringStatus === 'CONFIRMED');

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <button onClick={() => router.push('/grading')} className="text-xs bg-transparent border-none cursor-pointer text-[var(--fox)]" >← 返回</button>
            <h1 className="page-title">阅卷 · {exam?.title || ''}</h1>
            <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: blind ? 'var(--fox)' : 'var(--ink-300)' }}>
              <input type="checkbox" checked={blind} onChange={e => setBlind(e.target.checked)} className="accent-[var(--fox)]" /> 🎭 盲批
            </label>
            {/* 视图切换开关 — 仅考务员/管理员可切换全部视图，讲师固定为分派视图(G3) */}
            {(userRole === 'EXAM_OFFICER' || userRole === 'ORG_ADMIN' || userRole === 'SUPER_ADMIN') && (
              <div className="flex gap-1 ml-3" style={{ border: '1px solid var(--ink-200)', borderRadius: '8px', padding: '2px' }}>
                <button onClick={() => setViewFilter('mine')}
                  className="text-xs px-3 py-1 rounded-md transition-all cursor-pointer"
                  style={{ background: viewFilter === 'mine' ? 'var(--fox)' : 'transparent', color: viewFilter === 'mine' ? 'white' : 'var(--ink-400)' }}>
                  仅我的分派
                </button>
                <button onClick={() => setViewFilter('all')}
                  className="text-xs px-3 py-1 rounded-md transition-all cursor-pointer"
                  style={{ background: viewFilter === 'all' ? 'var(--fox)' : 'transparent', color: viewFilter === 'all' ? 'white' : 'var(--ink-400)' }}>
                  全部
                </button>
              </div>
            )}
          </div>
          <p className="page-subtitle">
            {viewFilter === 'mine'
              ? `分派给我 ${filteredStudents.length} 人 · 已批改 ${filteredStudents.filter(s => s.scoringStatus !== 'PENDING' && s.scoringStatus !== 'GRADING').length}`
              : `共 ${students.length} 人已提交 · 已批改 ${students.filter(s => s.scoringStatus !== 'PENDING' && s.scoringStatus !== 'GRADING').length} / 待批改 ${students.filter(s => s.scoringStatus === 'PENDING' || s.scoringStatus === 'GRADING').length}`}
            {allConf ? ' · 🔒 已确认' : allPub ? ' · ✅ 已全部发布' : ` · ${students.filter((s: any) => s.scoringStatus === 'PUBLISHED').length} 已发布`}
          </p>
        </div>
        <div className="flex gap-2">
          {(userRole === 'EXAM_OFFICER' || userRole === 'ORG_ADMIN' || userRole === 'SUPER_ADMIN') && (
            <button onClick={() => router.push(`/grading/${examId}/assign`)} className="btn btn-outline btn-sm">📋 阅卷指派</button>
          )}
          {allPub && !allConf && (userRole === 'EXAM_OFFICER' || userRole === 'ORG_ADMIN' || userRole === 'SUPER_ADMIN') && <button onClick={handleConfirm} disabled={confirming} className="btn btn-fox btn-sm">{confirming ? "确认中…" : "🔒 确认成绩"}</button>}
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 mb-5 p-0.5 rounded-lg bg-[var(--paper-dark)]" style={{  width: 'fit-content' }}>
        {[
          { key: 'grading', label: '📝 按人阅卷', icon: '' },
          { key: 'byQuestion', label: '📋 按题批阅', icon: '' },
          { key: 'progress', label: '📈 进度', icon: '' },
          { key: 'appeals', label: '⚖️ 申诉', icon: '' },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
            className="px-3.5 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer"
            style={{ background: activeTab === tab.key ? 'var(--paper)' : 'transparent', color: activeTab === tab.key ? 'var(--fox)' : 'var(--ink-400)', boxShadow: activeTab === tab.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Progress Tab */}
      {activeTab === 'progress' && (
        <GradingProgress examId={examId} exam={exam} students={students} />
      )}

      {/* Appeals Tab */}
      {activeTab === 'appeals' && (
        <AppealsTab examId={examId} />
      )}

      {/* 按题批阅 Tab */}
      {activeTab === 'byQuestion' && (
        <ByQuestionGrading examId={examId} exam={exam} blind={blind} />
      )}

      {/* Grading Tab */}
      {activeTab === 'grading' && (
        <GradingTab
          examId={examId}
          exam={exam}
          students={students}
          userRole={userRole}
          blind={blind}
          viewFilter={viewFilter}
          assignedSessionIds={assignedSessionIds}
          assignedQuestionIds={assignedQuestionIds}
          onStudentsReload={reloadStudents}
        />
      )}

      <ReasonConfirmModal
        open={confirmModal}
        title="🔒 确认锁存成绩"
        message="确认所有成绩？锁存后需解锁才能修改。"
        required
        presetReasons={['阅卷完成', '成绩已复核', '考试正常结束']}
        confirmText="确认锁存"
        onConfirm={doConfirm}
        onCancel={() => setConfirmModal(false)}
      />
    </AppLayout>
  );
}
