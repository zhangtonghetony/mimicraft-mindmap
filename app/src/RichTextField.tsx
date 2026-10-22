import { useEffect, useRef } from 'react';
import { Bold, Italic, Strikethrough, Underline, RemoveFormatting } from 'lucide-react';
import type { TextRun } from './extended';

const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function toHTML(runs: TextRun[]) {
  return runs.map(run => `<span style="${run.bold ? 'font-weight:700;' : ''}${run.italic ? 'font-style:italic;' : ''}${run.underline || run.strike ? `text-decoration:${run.underline ? 'underline ' : ''}${run.strike ? 'line-through' : ''};` : ''}${run.color && /^#[a-fA-F0-9]{6}$/.test(run.color) ? `color:${run.color};` : ''}">${escape(run.text).replace(/\n/g, '<br>')}</span>`).join('');
}
export function readRichText(element: HTMLElement): TextRun[] {
  const runs: TextRun[] = [];
  const push = (text: string, style: Omit<TextRun, 'text'>) => { if (!text) return; const item = { ...style, text: text.replace(/\u00a0/g, ' ') }; runs.push(item); };
  const walk = (node: Node, style: Omit<TextRun, 'text'> = {}) => {
    if (node.nodeType === Node.TEXT_NODE) { push(node.textContent ?? '', style); return; }
    if (!(node instanceof HTMLElement)) return;
    if (node.tagName === 'BR') { push('\n', style); return; }
    if (['DIV', 'P'].includes(node.tagName) && runs.length && !runs.at(-1)!.text.endsWith('\n')) push('\n', style);
    const next = { ...style };
    if (['B', 'STRONG'].includes(node.tagName) || Number(node.style.fontWeight) >= 600) next.bold = true;
    if (['I', 'EM'].includes(node.tagName) || node.style.fontStyle === 'italic') next.italic = true;
    if (node.tagName === 'U' || node.style.textDecoration.includes('underline')) next.underline = true;
    if (['S', 'STRIKE'].includes(node.tagName) || node.style.textDecoration.includes('line-through')) next.strike = true;
    const rawColor = node.style.color || node.getAttribute('color');
    if (rawColor) { const rgb = rawColor.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/); const color = rgb ? `#${rgb.slice(1).map(value => Number(value).toString(16).padStart(2, '0')).join('')}` : rawColor; if (/^#[a-fA-F0-9]{6}$/.test(color)) next.color = color; }
    node.childNodes.forEach(child => walk(child, next));
  };
  element.childNodes.forEach(child => walk(child));
  const merged: TextRun[] = [];
  runs.forEach(run => { const previous = merged.at(-1); const { text: _text, ...style } = run; const { text: _prior, ...priorStyle } = previous ?? { text: '' }; if (previous && JSON.stringify(style) === JSON.stringify(priorStyle)) previous.text += run.text; else merged.push(run); });
  return merged;
}
export default function RichTextField({ text, runs, onChange }: { text: string; runs?: TextRun[]; onChange: (runs: TextRun[]) => void }) {
  const ref = useRef<HTMLDivElement>(null); const range = useRef<Range | null>(null);
  useEffect(() => { if (ref.current) ref.current.innerHTML = toHTML(runs ?? [{ text }]); }, []);
  const remember = () => { const selection = window.getSelection(); if (selection?.rangeCount && ref.current?.contains(selection.anchorNode)) range.current = selection.getRangeAt(0).cloneRange(); };
  const read = () => { if (ref.current) { onChange(readRichText(ref.current)); remember(); } };
  const format = (command: string, value?: string) => { ref.current?.focus(); const selection = window.getSelection(); if (range.current && selection) { selection.removeAllRanges(); selection.addRange(range.current); } document.execCommand(command, false, value); read(); };
  return <><div className="rich-toolbar">{[{ command: 'bold', icon: Bold, label: '加粗文字' }, { command: 'italic', icon: Italic, label: '斜体文字' }, { command: 'underline', icon: Underline, label: '下划线文字' }, { command: 'strikeThrough', icon: Strikethrough, label: '删除线文字' }, { command: 'removeFormat', icon: RemoveFormatting, label: '清除局部格式' }].map(item => <button key={item.command} aria-label={item.label} title={item.label} onMouseDown={event => event.preventDefault()} onClick={() => format(item.command)}><item.icon size={16} /></button>)}<label>文字颜色<input aria-label="富文本颜色" type="color" defaultValue="#4e8b77" onChange={event => format('foreColor', event.target.value)} /></label></div><div className="rich-editor" ref={ref} role="textbox" aria-label="富文本编辑区" aria-multiline="true" contentEditable suppressContentEditableWarning onInput={read} onKeyUp={remember} onMouseUp={remember} onPaste={event => { event.preventDefault(); document.execCommand('insertText', false, event.clipboardData.getData('text/plain')); read(); }} /><p className="media-hint">选择一段文字后格式化；也可使用 Ctrl+B / I / U。外部粘贴按纯文本接收。</p></>;
}
