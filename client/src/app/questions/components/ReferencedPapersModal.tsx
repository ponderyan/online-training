import { useRouter } from 'next/navigation';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';

interface Props {
  data: any;
  loading: boolean;
  onClose: () => void;
}

export default function ReferencedPapersModal({ data, loading, onClose }: Props) {
  const router = useRouter();

  return (
    <Modal open={data !== null} onClose={onClose} title="引用详情" width="md"
      footer={<Button variant="secondary" size="sm" onClick={onClose}>关闭</Button>}>
      {data !== null && (<>
            <p className="text-xs mb-4 text-[var(--ink-400)]">
              该试题已被引用 <strong>{data?.count || 0}</strong> 次，共出现在以下试卷中：
            </p>
            {loading ? (
              <p className="text-sm text-center py-4 text-[var(--ink-300)]">查询中…</p>
            ) : data?.papers?.length > 0 ? (
              <div className="space-y-2">
                {data.papers.map((p: any, i: number) => (
                  <div key={i}
                    onClick={() => { onClose(); router.push(`/papers/${p.paperId}`); }}
                    className="flex items-center justify-between p-3 rounded-lg text-sm cursor-pointer transition-colors bg-[var(--paper)] hover:bg-[var(--fox-pale)]">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-[var(--ink-700)]">{p.name}</p>
                      <p className="text-xs mt-0.5 text-[var(--ink-300)]">{p.paperNumber}</p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                      <span className="text-xs text-[var(--ink-400)]">{p.score}分</span>
                      <span className={`tag ${
                        p.status === 'OFFICIAL' ? 'tag-verm' :
                        p.status === 'FINALIZED' ? 'tag-cyan' : 'tag-ink'
                      }`}>
                        {p.status === 'OFFICIAL' ? '正式' : p.status === 'FINALIZED' ? '定稿' : '草稿'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[var(--ink-300)] text-sm text-center py-4">
                该试题暂未被任何试卷引用
              </p>
            )}
      </>)}
    </Modal>
  );
}
