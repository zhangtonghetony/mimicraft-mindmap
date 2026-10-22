import type { MapDocument } from './model';

export const LAYOUTS = { mindmap: '思维导图', logic: '逻辑图', brace: '括号图', org: '组织结构图', fishbone: '鱼骨图', timeline: '时间轴', tree: '树形图', table: '树型表格', matrix: '矩阵图', grid: '网格结构' } as const;
export type LayoutType = keyof typeof LAYOUTS;
export interface TextRun { text: string; bold?: boolean; italic?: boolean; underline?: boolean; strike?: boolean; color?: string }
export interface NodeStyle {
  fontSize?: number; fontFamily?: 'sans' | 'serif' | 'mono'; bold?: boolean; italic?: boolean; underline?: boolean; strike?: boolean;
  textColor?: string; fill?: string; borderColor?: string; borderWidth?: number;
  align?: 'left' | 'center' | 'right'; shape?: 'rounded' | 'pill' | 'rectangle' | 'underline'; width?: number;
  line?: 'curve' | 'elbow' | 'straight'; lineWidth?: number; dashed?: boolean;
}
export const MARKERS = { 'priority-1': '❶', 'priority-2': '❷', 'priority-3': '❸', 'priority-4': '❹', 'priority-5': '❺', flag: '🚩', star: '⭐', question: '❓', check: '✅', warning: '⚠️', idea: '💡', heart: '❤️', 'progress-0': '○', 'progress-1': '◔', 'progress-2': '◑', 'progress-3': '◕', 'progress-4': '●' } as const;
export type Marker = keyof typeof MARKERS;
export const ILLUSTRATIONS = ['idea', 'target', 'plant', 'book', 'chart', 'cloud', 'rocket', 'flag', 'puzzle', 'coffee', 'compass', 'heart'] as const;
export type Illustration = typeof ILLUSTRATIONS[number];
export interface TaskPlan { startDate?: string; dueDate?: string; assignee?: string; priority?: number; progress?: number; reminderAt?: string }
export interface MapPreferences {
  globalFont?: 'sans' | 'serif' | 'mono'; branchWidth?: number; numbering?: 'none' | 'decimal' | 'alpha' | 'roman';
  rainbow?: boolean; palette?: string[]; handDrawn?: boolean; layoutGap?: number; freeBranch?: boolean; alignSiblings?: boolean;
  zenTheme?: 'canvas' | 'paper' | 'night';
}
export interface Slide { id: string; nodeId: string; title: string; notes: string; hidden: boolean }
export interface PresentationSettings { theme: 'sage' | 'ink' | 'paper' | 'night'; fontScale: number; slides: Slide[] }
export interface EdgeStyle { color?: string; width?: number; dashed?: boolean; curve?: 'arc' | 'straight'; arrow?: 'end' | 'both' | 'none'; bend?: number }
export interface GroupStyle { color?: string; fill?: string; width?: number; dashed?: boolean }
export const PALETTES = [
  { name: '森林', colors: ['#4e8b77', '#c88752', '#8c7ab8', '#5d8da6', '#c06b7c', '#b2a04b'] },
  { name: '海岸', colors: ['#397b9a', '#3d9c9a', '#72b5a3', '#809ab6', '#b3b781', '#6296b2'] },
  { name: '日落', colors: ['#d8865b', '#c76569', '#b286a0', '#dfa15b', '#a97883', '#d6b674'] },
  { name: '浆果', colors: ['#8c609b', '#bc7291', '#7385b7', '#a974ab', '#b87075', '#7c78a6'] },
  { name: '粉彩', colors: ['#91aa81', '#be9f80', '#a297ba', '#88a6b2', '#c39ba7', '#b6b083'] },
  { name: '墨色', colors: ['#43524c', '#586862', '#6c7d75', '#526d68', '#87958c', '#738275'] },
];
export const FONTS = { sans: '"Segoe UI","Microsoft YaHei",sans-serif', serif: 'Georgia,"Songti SC",SimSun,serif', mono: 'Consolas,"Microsoft YaHei",monospace' };
export const TEMPLATE_CATALOG = [
  { id: 'blank', name: '空白画布', description: '一个中心主题，无限种可能。', tag: '从零开始', layout: 'mindmap', center: '中心主题', topics: [] },
  { id: 'mindmap', name: '灵感地图', description: '捕捉、连接，让零散想法成形。', tag: '推荐', layout: 'mindmap', center: '让想法，自由生长', topics: [] },
  { id: 'project', name: '项目计划', description: '从愿景到行动，把下一步想清楚。', tag: '有序推进', layout: 'mindmap', center: '下一个好项目', topics: [] },
  { id: 'study', name: '学习笔记', description: '概念、例子与疑问，建立知识连接。', tag: '学习', layout: 'tree', center: '理解一个新知识', topics: ['核心概念', '关键例子', '我的疑问', '练习与复盘'] },
  { id: 'swot', name: 'SWOT 分析', description: '从四个角度审视一项选择。', tag: '分析', layout: 'matrix', center: '我的策略', topics: ['优势 Strengths', '劣势 Weaknesses', '机会 Opportunities', '挑战 Threats'] },
  { id: 'meeting', name: '会议纪要', description: '让讨论留下清晰的行动线索。', tag: '协作', layout: 'table', center: '一次有效的会议', topics: ['会议目标', '议题讨论', '决定与共识', '后续行动'] },
  { id: 'timeline', name: '成长时间轴', description: '把一个过程里的里程碑串起来。', tag: '时间轴', layout: 'timeline', center: '从现在到未来', topics: ['探索', '尝试', '实践', '回顾'] },
  { id: 'organization', name: '团队结构', description: '清楚呈现团队和职责分工。', tag: '组织', layout: 'org', center: '我们的团队', topics: ['产品与设计', '研发与交付', '运营与支持'] },
  { id: 'fishbone', name: '原因分析', description: '沿着线索，找到问题背后的原因。', tag: '鱼骨图', layout: 'fishbone', center: '需要解决的问题', topics: ['人员与协作', '方法与流程', '工具与资源', '环境与条件'] },
  { id: 'goals', name: '目标拆解', description: '让愿景落到能执行的小步骤。', tag: '目标', layout: 'brace', center: '我想完成的事', topics: ['为什么做', '做到什么程度', '怎样开始', '如何坚持'] },
  { id: 'ideas', name: '创意看板', description: '用卡片收集和整理下一批好想法。', tag: '网格', layout: 'grid', center: '点子的集合', topics: ['新鲜想法', '值得尝试', '正在酝酿', '暂存灵感'] },
] as const;
const color = (value: unknown) => typeof value === 'string' && /^#[a-fA-F0-9]{6}$/.test(value);
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const fail = (): never => { throw new Error('样式、任务或视图数据无效'); };
function keys(value: Record<string, unknown>, allowed: string[]) { if (Object.keys(value).some(key => !allowed.includes(key))) throw new Error('文件包含此版本尚不支持的字段'); }
function number(value: unknown, min: number, max: number) { return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max; }
function optionalEnum(value: unknown, options: string[]) { return value === undefined || options.includes(value as string); }
function date(value: unknown) { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value; }
export function validNodeStyle(value: unknown): value is NodeStyle {
  if (!record(value)) return false;
  keys(value, ['fontSize', 'fontFamily', 'bold', 'italic', 'underline', 'strike', 'textColor', 'fill', 'borderColor', 'borderWidth', 'align', 'shape', 'width', 'line', 'lineWidth', 'dashed']);
  for (const key of ['textColor', 'fill', 'borderColor']) if (value[key] !== undefined && !color(value[key])) return false;
  for (const key of ['bold', 'italic', 'underline', 'strike', 'dashed']) if (value[key] !== undefined && typeof value[key] !== 'boolean') return false;
  for (const [key, min, max] of [['fontSize', 8, 48], ['width', 100, 600], ['borderWidth', 0, 8], ['lineWidth', 1, 8]] as const) if (value[key] !== undefined && !number(value[key], min, max)) return false;
  return optionalEnum(value.fontFamily, ['sans', 'serif', 'mono']) && optionalEnum(value.align, ['left', 'center', 'right']) && optionalEnum(value.shape, ['rounded', 'pill', 'rectangle', 'underline']) && optionalEnum(value.line, ['curve', 'elbow', 'straight']);
}
export function validateExtras(value: Record<string, unknown>) {
  const nodes = value.nodes as Record<string, Record<string, unknown>>;
  for (const node of Object.values(nodes)) {
    if (node.style !== undefined && !validNodeStyle(node.style)) fail();
    if (node.position !== undefined) { if (!record(node.position)) fail(); keys(node.position as Record<string, unknown>, ['x', 'y']); const pos = node.position as Record<string, unknown>; if (!number(pos.x, -100000, 100000) || !number(pos.y, -100000, 100000)) fail(); }
    if (node.z !== undefined && !number(node.z, -10000, 10000)) fail();
    const content = node.content as Record<string, unknown> | undefined;
    if (!content) continue;
    if (content.callout !== undefined && (typeof content.callout !== 'string' || content.callout.length > 1000)) fail();
    if (content.markers !== undefined && (!Array.isArray(content.markers) || content.markers.length > 20 || content.markers.some(marker => typeof marker !== 'string' || !Object.hasOwn(MARKERS, marker)))) fail();
    if (content.richText !== undefined) {
      if (!Array.isArray(content.richText) || content.richText.length > 2000) fail();
      let text = '';
      for (const run of content.richText as unknown[]) {
        if (!record(run)) fail();
        const item = run as Record<string, unknown>; keys(item, ['text', 'bold', 'italic', 'underline', 'strike', 'color']);
        if (typeof item.text !== 'string' || item.text.length > 10000 || (item.color !== undefined && !color(item.color))) fail();
        for (const key of ['bold', 'italic', 'underline', 'strike']) if (item[key] !== undefined && typeof item[key] !== 'boolean') fail();
        text += item.text;
      }
      if (text !== node.text) fail();
    }
    if (content.task !== undefined) {
      if (!record(content.task)) fail(); const task = content.task as Record<string, unknown>;
      keys(task, ['startDate', 'dueDate', 'assignee', 'priority', 'progress', 'reminderAt']);
      for (const key of ['startDate', 'dueDate']) if (task[key] !== undefined && !date(task[key])) fail();
      if (task.startDate && task.dueDate && String(task.startDate) > String(task.dueDate)) fail();
      if (task.assignee !== undefined && (typeof task.assignee !== 'string' || task.assignee.length > 100)) fail();
      if (task.priority !== undefined && (!number(task.priority, 0, 3) || !Number.isInteger(task.priority))) fail();
      if (task.progress !== undefined && !number(task.progress, 0, 100)) fail();
      if (task.reminderAt !== undefined && (typeof task.reminderAt !== 'string' || task.reminderAt.length > 40 || !Number.isFinite(Date.parse(task.reminderAt)))) fail();
    }
  }
  if (value.preferences !== undefined) {
    if (!record(value.preferences)) fail(); const p = value.preferences as Record<string, unknown>;
    keys(p, ['globalFont', 'branchWidth', 'numbering', 'rainbow', 'palette', 'handDrawn', 'layoutGap', 'freeBranch', 'alignSiblings', 'zenTheme']);
    if (!optionalEnum(p.globalFont, ['sans', 'serif', 'mono']) || !optionalEnum(p.numbering, ['none', 'decimal', 'alpha', 'roman']) || !optionalEnum(p.zenTheme, ['canvas', 'paper', 'night'])) fail();
    for (const key of ['rainbow', 'handDrawn', 'freeBranch', 'alignSiblings']) if (p[key] !== undefined && typeof p[key] !== 'boolean') fail();
    if ((p.branchWidth !== undefined && !number(p.branchWidth, 1, 8)) || (p.layoutGap !== undefined && !number(p.layoutGap, 12, 100))) fail();
    if (p.palette !== undefined && (!Array.isArray(p.palette) || p.palette.length < 1 || p.palette.length > 12 || p.palette.some(item => !color(item)))) fail();
  }
  for (const edge of value.relations as Record<string, unknown>[]) if (edge.style !== undefined) {
    if (!record(edge.style)) fail(); const style = edge.style as Record<string, unknown>; keys(style, ['color', 'width', 'dashed', 'curve', 'arrow', 'bend']);
    if ((style.color !== undefined && !color(style.color)) || (style.width !== undefined && !number(style.width, 1, 8)) || (style.dashed !== undefined && typeof style.dashed !== 'boolean') || (style.bend !== undefined && !number(style.bend, -300, 300)) || !optionalEnum(style.curve, ['arc', 'straight']) || !optionalEnum(style.arrow, ['end', 'both', 'none'])) fail();
  }
  for (const group of value.groups as Record<string, unknown>[]) if (group.style !== undefined) {
    if (!record(group.style)) fail(); const style = group.style as Record<string, unknown>; keys(style, ['color', 'fill', 'width', 'dashed']);
    if ((style.color !== undefined && !color(style.color)) || (style.fill !== undefined && !color(style.fill)) || (style.width !== undefined && !number(style.width, 1, 8)) || (style.dashed !== undefined && typeof style.dashed !== 'boolean')) fail();
  }
  if (value.presentation !== undefined) {
    if (!record(value.presentation)) fail(); const p = value.presentation as Record<string, unknown>; keys(p, ['theme', 'fontScale', 'slides']);
    if (!['sage', 'ink', 'paper', 'night'].includes(p.theme as string) || !number(p.fontScale, 0.7, 1.6) || !Array.isArray(p.slides) || p.slides.length > 5000) fail();
    if ((p.slides as unknown[]).length > 0 && (p.slides as { hidden?: boolean }[]).every(slide => slide.hidden)) fail();
    const ids = new Set<string>();
    for (const entry of p.slides as unknown[]) {
      if (!record(entry)) fail(); const s = entry as Record<string, unknown>; keys(s, ['id', 'nodeId', 'title', 'notes', 'hidden']);
      if (typeof s.id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(s.id) || ids.has(s.id) || typeof s.nodeId !== 'string' || !Object.hasOwn(nodes, s.nodeId) || typeof s.title !== 'string' || s.title.length > 1000 || typeof s.notes !== 'string' || s.notes.length > 10000 || typeof s.hidden !== 'boolean') fail();
      ids.add(s.id as string);
    }
  }
}
export function numbering(doc: MapDocument): Map<string, string> {
  const result = new Map<string, string>(); const mode = doc.preferences?.numbering ?? 'none';
  const roman = (n: number) => { let out = ''; for (const [value, letters] of [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']] as const) while (n >= value) { out += letters; n -= value; } return out; };
  const alpha = (n: number) => { let out = ''; while (n > 0) { n--; out = String.fromCharCode(65 + n % 26) + out; n = Math.floor(n / 26); } return out; };
  const walk = (id: string, prefix: number[]) => doc.nodes[id].children.forEach((child, i) => { const path = [...prefix, i + 1]; if (mode !== 'none') result.set(child, `${mode === 'decimal' ? path.join('.') : mode === 'alpha' ? path.map(alpha).join('.') : path.map(roman).join('.')} `); walk(child, path); });
  walk(doc.rootId, []); doc.freeRoots?.forEach(id => walk(id, [])); return result;
}
