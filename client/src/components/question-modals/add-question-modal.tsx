'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { TYPE_NAMES, DIFF_NAMES } from './question-modal-constants';
import QuestionBodyEditor from './question-body-editor';
import KpSelector from './kp-selector';

export function AddQuestionModal({ open, onClose, subjects, editQuestion }: { open: boolean; onClose: () => void; subjects: any[]; editQuestion?: any | null }) {
  const [type, setType] = useState('SINGLE_CHOICE');
  const [difficulty, setDifficulty] = useState('EASY');
  const [subjectId, setSubjectId] = useState((subjects && subjects[0]?.id) || 1);
  const [chapterId, setChapterId] = useState(0);
  const [content, setContent] = useState('');
  const [analysis, setAnalysis] = useState('');
  const [options, setOptions] = useState<string[]>(['', '', '', '']);
  const [correctAnswer, setCorrectAnswer] = useState('');
  const [correctAnswers, setCorrectAnswers] = useState<string[]>([]);
  const [blanks, setBlanks] = useState<string[]>(['']);
  const [minAnswerWords, setMinAnswerWords] = useState('');
  const [rubricItems, setRubricItems] = useState<{ description: string; points: number; type: 'add' | 'deduct' }[]>([]);
  const [subQuestions, setSubQuestions] = useState<{ content: string; answer: string }[]>([{ content: '', answer: '' }]);
  const [chapters, setChapters] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [kpTree, setKpTree] = useState<any[]>([]);
  const [selectedKPIds, setSelectedKPIds] = useState<number[]>([]);
  const [kpSearch, setKpSearch] = useState('');
  const [kpLoading, setKpLoading] = useState(false);

  useEffect(() => {
    if (subjectId) {
      // 走 api 封装（带 Authorization；裸 fetch 会被后端 401，章节列表恒空）
      api.chapters.list(subjectId).then(data => {
        if (Array.isArray(data)) {
          setChapters(data);
          // 新建时章节未选 → 自动默认首章（chapter_id 为必填字段，避免保存 400）
          if (!editQuestion) setChapterId(prev => prev || data[0]?.id || 0);
        }
      }).catch(() => {});
    }
  }, [subjectId, editQuestion]);

  // Populate fields when editing
  useEffect(() => {
    if (!editQuestion) return;
    setType(editQuestion.type);
    setDifficulty(editQuestion.difficulty);
    setSubjectId(editQuestion.subjectId || subjects[0]?.id || 1);
    setChapterId(editQuestion.chapterId || 0);
    setContent(editQuestion.content || '');
    setAnalysis(editQuestion.analysis || '');

    if (editQuestion.type === 'SINGLE_CHOICE' || editQuestion.type === 'MULTIPLE_CHOICE') {
      const opts = editQuestion.options?.map((o: any) => o.content) || [];
      while (opts.length < 4) opts.push('');
      setOptions(opts);
      if (editQuestion.type === 'SINGLE_CHOICE') {
        const correct = editQuestion.options?.find((o: any) => o.isCorrect);
        setCorrectAnswer(correct?.label || '');
      } else {
        setCorrectAnswers(editQuestion.options?.filter((o: any) => o.isCorrect).map((o: any) => o.label) || []);
      }
    } else {
      setOptions(['', '', '', '']);
      setCorrectAnswer('');
      setCorrectAnswers([]);
    }

    if (editQuestion.type === 'TRUE_FALSE') {
      const trueOpt = editQuestion.options?.find((o: any) => o.label === 'A');
      setCorrectAnswer(trueOpt?.isCorrect ? 'true' : 'false');
    }

    if (editQuestion.type === 'FILL_BLANK') {
      setBlanks(editQuestion.blanks?.map((b: any) => b.answer) || ['']);
    } else {
      setBlanks(['']);
    }

    if (editQuestion.type === 'CASE_STUDY') {
      setSubQuestions(editQuestion.subQuestions?.map((sq: any) => ({ content: sq.content || '', answer: sq.answer || '' })) || [{ content: '', answer: '' }]);
    } else {
      setSubQuestions([{ content: '', answer: '' }]);
    }

    // 论文题增强字段回填（2026-08-11）
    setMinAnswerWords(editQuestion.minAnswerWords ? String(editQuestion.minAnswerWords) : '');
    setRubricItems(Array.isArray(editQuestion.rubric)
      ? editQuestion.rubric.map((r: any) => ({ description: r.description || '', points: r.points || 1, type: r.type === 'deduct' ? 'deduct' : 'add' }))
      : []);
  }, [editQuestion]);

  // 新建模式打开时重置论文题增强字段
  useEffect(() => {
    if (open && !editQuestion) { setMinAnswerWords(''); setRubricItems([]); }
  }, [open, editQuestion]);

  // Load KP tree when modal opens（按当前科目过滤）
  useEffect(() => {
    if (!open) return;
    setKpLoading(true);
    setKpSearch('');
    setSelectedKPIds([]);
    api.knowledgePoints.getTree(subjectId || undefined)
      .then(data => {
        const flatten = (nodes: any[]): any[] => {
          const result: any[] = [];
          const walk = (list: any[]) => {
            for (const n of list) {
              result.push(n);
              if (n.children?.length) walk(n.children);
            }
          };
          walk(nodes);
          return result;
        };
        setKpTree(flatten(Array.isArray(data) ? data : []));
      })
      .catch(() => {})
      .finally(() => setKpLoading(false));
  }, [open, subjectId]);

  // Pre-select KPs when editing a question
  useEffect(() => {
    if (!editQuestion) return;
    api.knowledgePoints.getQuestionKPs(editQuestion.id)
      .then(data => setSelectedKPIds((data || []).map((kp: any) => kp.knowledgePointId)))
      .catch(() => {});
  }, [editQuestion]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const body: any = {
        subjectId, chapterId: chapterId || undefined,
        type, content, difficulty, analysis: analysis || undefined,
      };

      if (type === 'SINGLE_CHOICE') {
        body.options = options.filter(o => o).map((o, i) => ({
          label: String.fromCharCode(65 + i), content: o, isCorrect: String.fromCharCode(65 + i) === correctAnswer,
        }));
      } else if (type === 'MULTIPLE_CHOICE') {
        body.options = options.filter(o => o).map((o, i) => ({
          label: String.fromCharCode(65 + i), content: o, isCorrect: correctAnswers.includes(String.fromCharCode(65 + i)),
        }));
      } else if (type === 'TRUE_FALSE') {
        body.options = [
          { label: 'A', content: '正确', isCorrect: correctAnswer === 'true' },
          { label: 'B', content: '错误', isCorrect: correctAnswer === 'false' },
        ];
      } else if (type === 'SHORT_ANSWER' || type === 'ESSAY') {
        body.analysis = analysis || undefined;
        // 论文题增强：作答最低字数 + 评分标准（2026-08-11）
        const mw = parseInt(minAnswerWords, 10);
        body.minAnswerWords = Number.isFinite(mw) && mw > 0 ? mw : null;
        const cleanRubric = rubricItems.filter(r => r.description.trim() && r.points > 0);
        body.rubric = cleanRubric.length > 0 ? cleanRubric : null;
      } else if (type === 'FILL_BLANK') {
        body.blanks = blanks.filter(b => b).map(b => ({ answer: b }));
      } else if (type === 'CASE_STUDY') {
        body.subQuestions = subQuestions.filter(s => s.content).map(s => ({ content: s.content, answer: s.answer || undefined }));
      }

      // 统一走 api 封装（携带 Authorization，失败抛错不静默关闭）
      const saved = editQuestion
        ? await api.questions.update(editQuestion.id, body)
        : await api.questions.create(body);

      // Try to get saved question ID (needed for new questions)
      let savedId = editQuestion?.id ?? saved?.id;

      // Save KP associations（空数组=清空旧关联）
      if (savedId) {
        await api.knowledgePoints.setQuestionKPs(savedId, selectedKPIds).catch(() => {});
      }

      onClose();
    } catch (e: any) {
      alert('保存失败：' + (e?.message || '未知错误'));
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card animate-fadeSlide">
        <div className="modal-header">
          <h3 className="font-serif font-bold text-base">{editQuestion ? '编辑试题' : '录入试题'}</h3>
        </div>

        <div className="modal-body">
          <div className="grid grid-cols-2 gap-4 mb-1">
            <div>
              <label className="text-[var(--ink-500)] block text-xs font-medium mb-1.5">题型</label>
              <select value={type} onChange={e => setType(e.target.value)} className="input select">
                {Object.entries(TYPE_NAMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[var(--ink-500)] block text-xs font-medium mb-1.5">难度</label>
              <select value={difficulty} onChange={e => setDifficulty(e.target.value)} className="input select">
                {Object.entries(DIFF_NAMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-[var(--ink-500)] block text-xs font-medium mb-1.5">科目</label>
              <select value={subjectId} onChange={e => setSubjectId(Number(e.target.value))} className="input select">
                {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.code} ({s.name})</option>)}
              </select>
            </div>
            <div>
              <label className="text-[var(--ink-500)] block text-xs font-medium mb-1.5">章节</label>
              <select value={chapterId} onChange={e => setChapterId(Number(e.target.value))} className="input select">
                <option value={0}>不指定</option>
                {(chapters || []).map((ch: any) => <option key={ch.id} value={ch.id}>{ch.name}</option>)}
              </select>
            </div>
          </div>

          <div className="mb-4">
            <label className="text-[var(--ink-500)] block text-xs font-medium mb-1.5">题干</label>
            <textarea value={content} onChange={e => setContent(e.target.value)} rows={3}
              className="input textarea"
              placeholder={type === 'FILL_BLANK' ? '用 {{_}} 标记填空位置' : '输入试题题干…'} />
          </div>

          {/* Dynamic question body */}
          <QuestionBodyEditor
            type={type}
            options={options} setOptions={setOptions}
            correctAnswer={correctAnswer} setCorrectAnswer={setCorrectAnswer}
            correctAnswers={correctAnswers} setCorrectAnswers={setCorrectAnswers}
            blanks={blanks} setBlanks={setBlanks}
            analysis={analysis} setAnalysis={setAnalysis}
            minAnswerWords={minAnswerWords} setMinAnswerWords={setMinAnswerWords}
            rubricItems={rubricItems} setRubricItems={setRubricItems}
            subQuestions={subQuestions} setSubQuestions={setSubQuestions}
          />

          {/* 关联知识点 */}
          <KpSelector
            kpTree={kpTree} kpLoading={kpLoading}
            kpSearch={kpSearch} setKpSearch={setKpSearch}
            selectedKPIds={selectedKPIds} setSelectedKPIds={setSelectedKPIds}
          />
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost btn-sm">取消</button>
          <button onClick={handleSave} disabled={saving}
            className="btn btn-gold btn-sm">
            {saving ? '保存中…' : editQuestion ? '保存修改' : '保存试题'}
          </button>
        </div>
      </div>
    </div>
  );
}
