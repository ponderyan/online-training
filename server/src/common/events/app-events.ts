import { EventEmitter } from 'events';

/**
 * 全局进程内事件总线（轻量解耦）
 * 用途：业务服务 → 监考大屏 WebSocket 实时推送
 * 约定事件：'exam:changed' (examId: number)
 */
export const appEvents = new EventEmitter();
appEvents.setMaxListeners(100);

/** 通知某场考试的数据发生变化（心跳/交卷/监考操作等），由 WS 网关防抖后推送大屏 */
export function emitExamChanged(examId: number) {
  appEvents.emit('exam:changed', examId);
}
