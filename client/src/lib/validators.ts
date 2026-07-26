/**
 * FoxLearn 前端表单校验工具库
 * 统一校验规则，供所有管理页面复用
 */

/** 手机号：11位数字，1开头 */
export const PHONE_REGEX = /^1[3-9]\d{9}$/;

/** 固话/通用电话：数字、+、-、空格，7-20位 */
export const TEL_REGEX = /^[\d+\-\s]{7,20}$/;

/** 邮箱：标准ASCII格式（禁止中文等非ASCII字符） */
export const EMAIL_REGEX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

/** 身份证：18位，末位可X/x */
export const ID_CARD_REGEX = /^\d{17}[\dXx]$/;

/** 组织编码：大写字母开头，仅允许大写字母、数字、连字符，2-20位 */
export const ORG_CODE_REGEX = /^[A-Z][A-Z0-9-]{1,19}$/;

// ─── 校验函数（返回错误信息或 null） ───

export function validatePhone(value: string, label = '手机号'): string | null {
  if (!value) return null;
  if (!PHONE_REGEX.test(value)) return `${label}格式不正确（需11位，1开头）`;
  return null;
}

export function validateTel(value: string, label = '联系电话'): string | null {
  if (!value) return null;
  if (!TEL_REGEX.test(value)) return `${label}格式不正确（仅允许数字、+、-）`;
  return null;
}

export function validateEmail(value: string, label = '邮箱'): string | null {
  if (!value) return null;
  if (!EMAIL_REGEX.test(value)) return `${label}格式不正确`;
  return null;
}

export function validateIdCard(value: string, label = '身份证号'): string | null {
  if (!value) return null;
  if (!ID_CARD_REGEX.test(value)) return `${label}格式不正确（需18位，末位可为X）`;
  return null;
}

export function validateOrgCode(value: string): string | null {
  if (!value) return '组织编码不能为空';
  if (!ORG_CODE_REGEX.test(value)) return '编码格式：大写字母开头，仅允许大写字母、数字、连字符，2-20位';
  return null;
}

// ─── 组织编码自动建议（Phase 2: 已迁移至后端 /api/org-codes/preview）───
