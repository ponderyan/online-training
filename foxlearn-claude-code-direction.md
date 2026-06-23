# FoxLearn 二期 — 给 Claude Code 的补充方向决策

> 本文档是对 `phase2-roadmap-review.md` 中提出的4个方向问题的最终决策，以及对其中不准确信息的纠正。请先阅读本文件，再开始编码。

---

## 一、纠正：学员端在线答题并未缺失

`phase2-roadmap-review.md` 中说"学员端在线答题，至今没动"——这个判断**不准确**。

学员端在线答题的代码已经存在，**不是原型**，是完整的可运行页面和服务端：

### 前端

| 文件 | 状态 | 说明 |
|------|------|------|
| `client/src/app/exam/page.tsx` | ✅ 已有（123行） | 学员端考试列表，对接 `/api/student/exams` |
| `client/src/app/exam/take/[id]/page.tsx` | ✅ 已有（362行） | 答题页：逐题作答、答题卡导航、计时器、标记、交卷确认 |
| `client/src/app/exam/result/[id]/page.tsx` | ✅ 已有 | 成绩结果页 |

### 后端

| 文件 | 状态 | 说明 |
|------|------|------|
| `server/src/modules/exams/student-exam.controller.ts` | ✅ 已有（43行） | 5个完整接口 |

```
GET  /api/student/exams              → 考试列表
GET  /api/student/exams/:id           → 开始考试（获取题目）
POST /api/student/exams/:id/submit   → 交卷
POST /api/student/exams/:id/heartbeat → 心跳保持
GET  /api/student/exams/:id/result   → 成绩结果
```

### 真正缺的是什么

**学员端入口断掉了**——并非答题功能没做，而是：

1. **导航**：当前侧边栏只配置了管理员视角的菜单项，学员登录后看不到 `/exam` 和 `/my-certificates` 的入口
2. **登录重定向**：当前登录后统一跳到 `/dashboard`（管理员工作台），学员不应该跳到那里
3. **角色分流**：学员和管理员共用同一个侧边栏，没有按角色过滤

---

## 二、四个方向决策（最终决定）

### 决策1：在线答题 — 切屏检测

**做最轻量的版本：记而不罚，可配置开关。**

具体方案：

1. 在 `exam/take/[id]/page.tsx` 中增加切屏监听：

```typescript
// 在答题页面组件中
const [tabSwitchLog, setTabSwitchLog] = useState<{time: string, duration: number}[]>([]);
const tabSwitchStartRef = useRef<number | null>(null);

useEffect(() => {
  const handleVisibility = () => {
    if (document.hidden) {
      // 切出去了，记录开始时间
      tabSwitchStartRef.current = Date.now();
    } else if (tabSwitchStartRef.current !== null) {
      // 切回来了，计算持续时间
      const duration = Math.round((Date.now() - tabSwitchStartRef.current) / 1000);
      setTabSwitchLog(prev => [...prev, {
        time: new Date(tabSwitchStartRef.current!).toISOString(),
        duration,
      }]);
      tabSwitchStartRef.current = null;
    }
  };
  document.addEventListener('visibilitychange', handleVisibility);
  window.addEventListener('blur', () => {
    if (tabSwitchStartRef.current === null) tabSwitchStartRef.current = Date.now();
  });
  window.addEventListener('focus', () => {
    if (tabSwitchStartRef.current !== null) {
      const duration = Math.round((Date.now() - tabSwitchStartRef.current) / 1000);
      setTabSwitchLog(prev => [...prev, { time: new Date(tabSwitchStartRef.current).toISOString(), duration }]);
      tabSwitchStartRef.current = null;
    }
  });
  return () => {
    document.removeEventListener('visibilitychange', handleVisibility);
    window.removeEventListener('blur', () => {});
    window.removeEventListener('focus', () => {});
  };
}, []);
```

2. 交卷时将 `tabSwitchLog` 随答案一起提交到后端
3. 后端存入 `ExamSession` 或 `ExamSessionStudent` 的 `tabSwitchLog` 字段（JSON 类型）
4. **不做自动警告和强制交卷**——协会场景学员多为在职人员，切屏查资料是真实需求
5. 如果需要配置开关，在 `Exam` 模型加 `tabSwitchConfig` 字段：`{enabled: boolean, maxTimes?: number}`
6. 阅卷详情页展示切屏记录供人工参考

### 决策2：导航方案

**统一侧边栏 + 按角色过滤。不改两套 layout。**

具体做法：

修改 `client/src/components/sidebar.tsx`，给 `navItems` 加角色元数据：

```typescript
const navItems = [
  // 管理员+讲师
  { path: '/dashboard', label: '工作台', icon: '📋', roles: ['SUPER_ADMIN','ORG_ADMIN','LECTURER','PROCTOR'] },
  { path: '/questions', label: '题库管理', icon: '📝', roles: ['SUPER_ADMIN','ORG_ADMIN','LECTURER'] },
  { path: '/materials', label: '教材出题', icon: '📖', roles: ['SUPER_ADMIN','ORG_ADMIN','LECTURER'] },
  { path: '/generate', label: '智能组卷', icon: '✨', roles: ['SUPER_ADMIN','ORG_ADMIN','LECTURER'] },
  { path: '/papers', label: '试卷管理', icon: '📄', roles: ['SUPER_ADMIN','ORG_ADMIN','LECTURER'] },
  { path: '/exams', label: '考试管理', icon: '📋', roles: ['SUPER_ADMIN','ORG_ADMIN'] },
  { path: '/grading', label: '阅卷中心', icon: '📊', roles: ['SUPER_ADMIN','ORG_ADMIN','LECTURER'] },
  { path: '/certificates', label: '证书管理', icon: '🏅', roles: ['SUPER_ADMIN','ORG_ADMIN'] },
  { path: '/students', label: '学员管理', icon: '👥', roles: ['SUPER_ADMIN','ORG_ADMIN'] },
  { path: '/settings', label: '系统设置', icon: '⚙️', roles: ['SUPER_ADMIN','ORG_ADMIN'] },
  // 学员专属
  { path: '/exam', label: '我的考试', icon: '📋', roles: ['STUDENT'] },
  { path: '/my-certificates', label: '我的证书', icon: '🎓', roles: ['STUDENT'] },
];
```

然后在 Sidebar 组件中根据当前用户的 role 过滤：

```typescript
const filteredItems = navItems.filter(item => item.roles.includes(user?.role));
```

**不改两套 layout 的理由**：当前 `AppLayout + Sidebar` 结构足够好；拆两套意味重复的用户认证逻辑、重复的 logout 逻辑、未来角色扩展时两倍维护成本。

### 决策3：工作台仪表盘

**同一 `/dashboard` 路由，按角色渲染不同内容。**

具体做法：

1. 在 `dashboard/page.tsx` 中根据 `user.role` 做条件分支：

```typescript
if (user?.role === 'STUDENT') return <StudentDashboard />;
return <AdminDashboard />;
```

2. 管理员看到的跟现在一样：统计卡片 + 快速操作 + 最近试卷
3. 学员看到的是：待参加的考试数、最近一次考试成绩、待阅卷的主观题进度
4. **二期可以先只做管理员的仪表盘**——学员入口 `/exam` 已经够用，学员仪表盘可以留到三期完善

### 决策4：权限管理 UI

**二期不做完整的角色-权限编辑页。在系统设置页加一个只读展示。**

具体做法：

在 `settings/page.tsx` 中加一个区块，读取当前用户的角色和权限并展示：

- 展示当前用户的角色名称和角色描述
- 展示该角色拥有的权限列表（分组展示，如系统管理、题库、试卷、考试等）
- **只读，不可编辑**——编辑功能放到三期

理由：后端权限系统已经完整（5 角色 × 30 权限点），二期开发和测试阶段以 Super Admin 身份运行即可，不需要 UI 来切换角色。只读展示是为了让用户知道自己有什么权限，方便调试。

---

## 三、二期真正该补的缺口（优先级排序）

请按此优先级执行，先跑通核心链路，再搞周边设施：

| 优先级 | 任务 | 说明 |
|--------|------|------|
| **P0** | 侧边栏按角色过滤 | 给 navItems 加 roles 字段，按 user.role 过滤。把 `/exam` 和 `/my-certificates` 放进学员视图 |
| **P0** | 登录重定向 | 登录成功后，STUDENT 角色跳转到 `/exam`，其他角色跳转到 `/dashboard` |
| **P0** | 核心联调链路 | 考试→答题→交卷→自动判分→人工阅卷→成绩发布→证书生成的**完整数据流**走通一遍 |
| **P1** | submit 防重复+超时校验 | 后端 submit 接口检查：是否已交卷？是否超时？是否有权提交？ |
| **P1** | 切屏检测（轻量版） | 前端监听 visibilitychange+blur，记录切屏日志；交卷时一并提交 |
| **P2** | 答卷自动保存 | 在答题页加 localStorage 缓存，防止意外关闭页面丢答案 |
| **P2** | 网络错误重试 | 交卷时如果网络失败，提示用户重试而不是丢数据 |
| **P3** | 权限管理只读页 | 系统设置里展示当前角色拥有的权限 |
| **P3** | 学员工作台 | 简化版学员仪表盘，三期再完善 |

---

## 四、技术注意事项

1. **后端子mit接口**：当前 `POST /api/student/exams/:id/submit` 需要确认是否包含防重复提交检查。如果没有，加以下逻辑：
   - 检查 `examSession.status` 是否为 `ACTIVE`（或 `ASSIGNED` 且已到开考时间）
   - 检查 `studentExam.status` 是否已为 `SUBMITTED`（防止重复提交）
   - 检查当前时间是否超过考试结束时间（超时自动交卷）

2. **角色字段**：当前 `user` 对象中的 role 字段路径需要确认。检查 JWT payload 和 localStorage 中的 `user` 对象是否包含 `role` 字段（如 `SUPER_ADMIN`）

3. **原型转正**：`/prototypes/student-exams` 和 `/prototypes/online-exam` 是高保真原型，里面的 UI 细节（状态标签、卡片布局、计时器等）可以参考，但不要当成代码直接复制。真实页面已经在 `/exam` 和 `/exam/take/[id]` 下了

---
🦊 小狐狸 · 审毕
