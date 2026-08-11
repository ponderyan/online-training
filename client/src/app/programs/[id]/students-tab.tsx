'use client';

// 学员名单 Tab：纯展示报名学员表格
export default function StudentsTab({ enrollments }: { enrollments: any[] }) {
  const feeStatusNames: Record<string, string> = { UNPAID: '未缴费', PAID: '已缴费', REFUNDED: '已退款', PARTIAL: '部分缴费' };
  const enrollStatusNames: Record<string, string> = { ENROLLED: '已报名', COMPLETED: '已完成', CANCELLED: '已取消', DROPPED: '已退学' };

  if (!enrollments || enrollments.length === 0) {
    return (
      <div className="card p-0 overflow-hidden">
        <div className="text-[var(--ink-300)] p-10 text-center text-xs">暂无学员报名</div>
      </div>
    );
  }

  return (
    <div className="card p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <div className="overflow-x-auto">
        <table className="list-table">
          <thead><tr>
            <th>序号</th>
            <th>姓名</th>
            <th>手机号</th>
            <th>推荐单位</th>
            <th>报名来源</th>
            <th>报名时间</th>
            <th>缴费金额</th>
            <th>缴费时间</th>
            <th>报名状态</th>
          </tr></thead>
          <tbody>{enrollments.map((e: any, i: number) => (
            <tr key={e.id}>
              <td className="text-[var(--ink-300)] text-xs font-mono">{i + 1}</td>
              <td className="font-medium">{e.student?.displayName || '—'}</td>
              <td>{e.student?.phone || '—'}</td>
              <td className="text-[var(--ink-400)] text-xs">{e.student?.organization || e.agency?.name || '—'}</td>
              <td className="text-xs">{e.enrollSource || '系统录入'}</td>
              <td className="text-[var(--ink-300)] text-xs">{e.createdAt ? new Date(e.createdAt).toLocaleDateString('zh-CN') : '—'}</td>
              <td>{e.feeAmount ? `¥${e.feeAmount.toLocaleString()}` : '—'}</td>
              <td className="text-[var(--ink-300)] text-xs">{e.paidAt ? new Date(e.paidAt).toLocaleDateString('zh-CN') : '—'}</td>
              <td>
                <span className="text-xs font-medium px-2 py-0.5 rounded" style={{
                  background: e.feeStatus === 'PAID' ? 'var(--cyan-glow)' : e.feeStatus === 'REFUNDED' ? 'var(--verm-glow)' : 'var(--fox-glow)',
                  color: e.feeStatus === 'PAID' ? 'var(--info)' : e.feeStatus === 'REFUNDED' ? 'var(--error)' : 'var(--ink-300)',
                }}>
                  {feeStatusNames[e.feeStatus] || e.feeStatus}
                </span>
              </td>
            </tr>
          ))}</tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
