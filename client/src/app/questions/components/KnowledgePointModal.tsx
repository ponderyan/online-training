import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { flattenTree } from '../lib';

interface Props {
  question: any;
  kpTree: any[];
  kpSelected: Set<number>;
  kpLoading: boolean;
  kpSubjectId: number;
  subjects: any[];
  onClose: () => void;
  onSubjectChange: (subjectId: number) => void;
  onToggleKp: (id: number) => void;
}

export default function KnowledgePointModal({
  question, kpTree, kpSelected, kpLoading, kpSubjectId, subjects,
  onClose, onSubjectChange, onToggleKp,
}: Props) {
  const toast = useToast();

  const handleSave = async () => {
    if (!question) return;
    try {
      await api.knowledgePoints.setQuestionKPs(question.id, Array.from(kpSelected));
      onClose();
      toast.success('知识点已保存');
    } catch (e: any) { toast.error('保存失败：' + e.message); }
  };

  return (
    <Modal open={!!question} onClose={onClose}
      title={`标记知识点 — ${question?.content?.slice(0, 30) || ''}…`} width="lg"
      footer={<>
        <Button variant="ghost" size="sm" onClick={onClose}>取消</Button>
        <Button size="sm" onClick={handleSave}>保存</Button>
      </>}>
      {question && (<>
          {/* 科目选择器 */}
          <div className="flex items-center gap-2 mb-4 p-2 rounded-lg bg-[var(--paper)]">
            <span className="text-xs font-medium text-[var(--ink-400)] whitespace-nowrap">科目</span>
            <select value={kpSubjectId} onChange={e => onSubjectChange(Number(e.target.value))}
              className="input text-sm flex-1" style={{ padding: '6px 10px', height: '36px' }}>
              <option value={0}>请选择科目</option>
              {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.code} - {s.name}</option>)}
            </select>
          </div>
          <div className="max-h-[50vh] overflow-y-auto">
            {kpLoading ? (
              <div className="py-8 text-center text-xs text-[var(--ink-300)]">加载中…</div>
            ) : kpSubjectId === 0 ? (
              <div className="py-8 text-center text-xs text-[var(--ink-300)]">请先选择科目后查看知识点树</div>
            ) : kpTree.length === 0 ? (
              <div className="py-8 text-center text-xs text-[var(--ink-300)]">该科目暂无知识点</div>
            ) : (
              <div className="space-y-1">
                {flattenTree(kpTree).map(kp => (
                  <label key={kp.id} className="flex items-center gap-2 p-1.5 rounded cursor-pointer hover:bg-[var(--fox-glow)] transition-colors"
                    style={{ paddingLeft: `${12 + kp.depth * 20}px` }}>
                    <input type="checkbox" checked={kpSelected.has(kp.id)}
                      onChange={() => onToggleKp(kp.id)}
                      className="accent-[var(--fox)]" />
                    <span className={`text-xs text-[var(--ink-600)] ${kp.depth === 0 ? 'font-semibold' : ''}`}>{kp.name}</span>
                    {kp.code && <span className="text-xs ml-1 text-[var(--ink-300)]">({kp.code})</span>}
                  </label>
                ))}
              </div>
            )}
          </div>
      </>)}
    </Modal>
  );
}
