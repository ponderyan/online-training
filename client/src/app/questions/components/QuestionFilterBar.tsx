import { Search } from 'lucide-react';
import { TYPE_LABELS, DIFF_LABELS } from '../lib';

interface Props {
  keyword: string;
  setKeyword: (v: string) => void;
  filterSubject: string;
  setFilterSubject: (v: string) => void;
  filterType: string;
  setFilterType: (v: string) => void;
  filterDifficulty: string;
  setFilterDifficulty: (v: string) => void;
  filterStatus: string;
  setFilterStatus: (v: string) => void;
  filterMaterial: string;
  setFilterMaterial: (v: string) => void;
  filterMatChapter: string;
  setFilterMatChapter: (v: string) => void;
  subjects: any[];
  materials: any[];
  matChapters: any[];
  setPage: (p: number) => void;
}

export default function QuestionFilterBar({
  keyword, setKeyword,
  filterSubject, setFilterSubject,
  filterType, setFilterType,
  filterDifficulty, setFilterDifficulty,
  filterStatus, setFilterStatus,
  filterMaterial, setFilterMaterial,
  filterMatChapter, setFilterMatChapter,
  subjects, materials, matChapters, setPage,
}: Props) {
  return (
    <div className="flex items-center gap-3 mb-5 flex-wrap">
      <div className="relative flex-1 min-w-[200px]">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-300)] pointer-events-none" />
        <input value={keyword} onChange={e => { setKeyword(e.target.value); setPage(1); }}
          placeholder="搜索题干…" className="input" style={{ paddingLeft: '32px' }} />
      </div>
      <select value={filterSubject} onChange={e => { setFilterSubject(e.target.value); setPage(1); }}
        className="input select" style={{ width: '120px' }}>
        <option value="">全部科目</option>
        {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.code}</option>)}
      </select>
      <select value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1); }}
        className="input select" style={{ width: '100px' }}>
        <option value="">全部题型</option>
        {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      <select value={filterDifficulty} onChange={e => { setFilterDifficulty(e.target.value); setPage(1); }}
        className="input select" style={{ width: '100px' }}>
        <option value="">全部难度</option>
        {Object.entries(DIFF_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
      </select>
      <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
        className="input select" style={{ width: '100px' }}>
        <option value="">全部状态</option>
        <option value="PUBLISHED">启用</option>
        <option value="ARCHIVED">已停用</option>
      </select>
      <select value={filterMaterial} onChange={e => { setFilterMaterial(e.target.value); setPage(1); }}
        className="input select" style={{ width: '140px' }}>
        <option value="">全部教材</option>
        {materials.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
      </select>
      {filterMaterial && (
        <select value={filterMatChapter} onChange={e => { setFilterMatChapter(e.target.value); setPage(1); }}
          className="input select" style={{ width: '140px' }}>
          <option value="">全部章节</option>
          {matChapters.map((ch: any) => <option key={ch.id} value={ch.id}>{ch.title}</option>)}
        </select>
      )}
    </div>
  );
}
