/**
 * 应用版本号（唯一事实来源）
 *
 * ★ 发版纪律：每次打 git tag（vX.Y.Z）时，同步更新此常量，
 *   否则 /api/health 返回的版本号会与发布版本漂移（历史教训：v0.9.4 停滞到 v0.9.9）。
 */
export const APP_VERSION = '0.9.13';
