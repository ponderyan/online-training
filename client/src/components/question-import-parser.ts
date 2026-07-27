/**
 * 批量导入试题 — Excel 解析与数据转换逻辑
 */
import * as XLSX from 'xlsx';
import { TYPE_NAMES, TYPE_SHEETS, DIFF_MAP, MAX_IMPORT_COUNT } from './question-import-config';
import type { ParsedRow } from './question-import-config';

export interface ParseResult {
  rows: ParsedRow[];
  error?: string;
}

/**
 * 解析上传的 Excel 文件，返回结构化行数据
 */
export function parseExcelFile(data: ArrayBuffer): ParseResult {
  const wb = XLSX.read(data);
  const parsed: ParsedRow[] = [];

  for (const sheetName of wb.SheetNames) {
    const typeKey = Object.entries(TYPE_NAMES).find(([, v]) => v === sheetName)?.[0];
    if (!typeKey || !TYPE_SHEETS[typeKey]) continue;

    const sheetDef = TYPE_SHEETS[typeKey];
    const ws = wb.Sheets[sheetName];
    const json: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

    let headerRow = -1;
    for (let i = 0; i < json.length; i++) {
      if (json[i]?.[0] === sheetDef.headers[0]) { headerRow = i; break; }
    }
    if (headerRow === -1) continue;

    for (let i = headerRow + 1; i < json.length; i++) {
      const r = json[i];
      if (!r || String(r[0] || '').trim() === '' || String(r[0]).startsWith('#')) continue;

      const row: ParsedRow = {
        sheetType: typeKey,
        content: '',
        options: ['', '', '', '', '', ''],
        correctAnswer: '',
        difficulty: '',
        chapterName: '',
        analysis: '',
        blankAnswers: '',
        subQuestions: '',
        subAnswers: '',
        errors: [],
      };

      sheetDef.colMap.forEach((col, idx) => {
        const val = String(r[idx] || '').trim();
        if (col === 'content') row.content = val;
        else if (col.startsWith('opt')) row.options[parseInt(col[3])] = val;
        else if (col === 'correct') row.correctAnswer = val;
        else if (col === 'difficulty') row.difficulty = val;
        else if (col === 'chapter') row.chapterName = val;
        else if (col === 'analysis') row.analysis = row.analysis || val;
        else if (col === 'extraAnalysis') { if (val && val !== row.analysis) row.analysis = row.analysis ? row.analysis + '\n解析：' + val : val; }
        else if (col === 'blankAnswers') row.blankAnswers = val;
        else if (col === 'subQuestions') row.subQuestions = val;
        else if (col === 'subAnswers') row.subAnswers = val;
      });

      if (!row.content) row.errors.push('题干不能为空');
      if (!DIFF_MAP[row.difficulty]) row.errors.push(`无效难度：${row.difficulty}（请使用 易/较易/较难/难）`);
      if (['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE'].includes(typeKey) && !row.correctAnswer) {
        row.errors.push('正确答案不能为空');
      }

      parsed.push(row);
    }
  }

  if (parsed.length === 0) {
    return { rows: [], error: '未解析到有效数据，请确认文件使用了本系统下载的模板' };
  }

  if (parsed.length > MAX_IMPORT_COUNT) {
    return { rows: [], error: `本次解析到 ${parsed.length} 道题目，超出单次上限（${MAX_IMPORT_COUNT} 道）。请拆分为多个文件分批导入。` };
  }

  return { rows: parsed };
}

/**
 * 将 ParsedRow[] 转换为后端 API 所需的 questions 数组
 */
export function buildQuestionsPayload(
  rows: ParsedRow[],
  selectedSubject: number,
  chapterMap: Record<string, number>,
) {
  return rows.filter(r => r.errors.length === 0).map(r => {
    const type = r.sheetType;
    const difficulty = DIFF_MAP[r.difficulty] || r.difficulty;

    const opts = ['SINGLE_CHOICE', 'MULTIPLE_CHOICE'].includes(type)
      ? r.options.filter(o => o).map((o, i) => ({
          label: String.fromCharCode(65 + i),
          content: o,
          isCorrect: type === 'SINGLE_CHOICE'
            ? String.fromCharCode(65 + i) === r.correctAnswer
            : r.correctAnswer.split(/[,，]/).map(x => x.trim()).includes(String.fromCharCode(65 + i)),
        }))
      : type === 'TRUE_FALSE'
        ? [
            { label: 'A', content: '正确', isCorrect: r.correctAnswer === '正确' || r.correctAnswer === 'A' },
            { label: 'B', content: '错误', isCorrect: r.correctAnswer === '错误' || r.correctAnswer === 'B' },
          ]
        : undefined;

    const blanks = type === 'FILL_BLANK' && r.blankAnswers
      ? r.blankAnswers.split(/[；;]/).filter(b => b).map(a => ({ answer: a.trim() }))
      : undefined;

    const subQuestions = type === 'CASE_STUDY' && r.subQuestions
      ? r.subQuestions.split('|').map((sq, i) => ({
          content: sq.trim(),
          answer: r.subAnswers?.split('|')[i]?.trim() || undefined,
        }))
      : undefined;

    return {
      subjectId: selectedSubject,
      chapterId: chapterMap[r.chapterName] || undefined,
      type,
      content: r.content,
      difficulty,
      analysis: r.analysis || undefined,
      source: 'BATCH_IMPORT',
      options: opts,
      blanks,
      subQuestions,
    };
  });
}

/**
 * 生成 Excel 模板文件
 */
export function generateTemplate(enabledTypes: string[], subjectCode: string, subjectName: string) {
  const wb = XLSX.utils.book_new();

  for (const type of enabledTypes) {
    const sheetDef = TYPE_SHEETS[type];
    if (!sheetDef) continue;

    const metaRow = [`${TYPE_NAMES[type]} · 科目：${subjectCode}（${subjectName}）`];
    const data = [metaRow, sheetDef.headers, sheetDef.sample];
    const ws = XLSX.utils.aoa_to_sheet(data);

    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: sheetDef.headers.length - 1 } }];

    const diffIdx = sheetDef.colMap.indexOf('difficulty');
    if (diffIdx !== -1) {
      const colLetter = String.fromCharCode(65 + diffIdx);
      ws['!dataValidations'] = {
        difficulty: {
          type: 'list',
          formula1: '"易,较易,较难,难"',
          ranges: [`${colLetter}3:${colLetter}1048576`],
          allowBlank: true,
        },
      };
    }

    ws['!cols'] = sheetDef.headers.map(h => ({
      wch: h === '题干' || h.startsWith('题干') || h === '子问题' ? 40
        : h === '解析' || h === '参考答案' ? 30
        : h.startsWith('选项') ? 16 : 14,
    }));

    XLSX.utils.book_append_sheet(wb, ws, TYPE_NAMES[type]);
  }

  XLSX.writeFile(wb, `试题导入-${subjectCode}.xlsx`);
}
