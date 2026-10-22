import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, ChevronDown, ChevronRight, GitBranch, X } from 'lucide-react';
import type { MapDocument } from './model';
import { getSlides } from './Planning';

export function Outline({ doc, selected, onSelect, onEdit, onClose }: { doc: MapDocument; selected: string[]; onSelect: (id: string) => void; onEdit: (id: string) => void; onClose: () => void }) {
  const render = (id: string, depth = 0) => {
    const node = doc.nodes[id];
    return <div key={id}><button className={`outline-node ${selected.includes(id) ? 'selected' : ''}`} style={{ paddingLeft: 12 + depth * 16 }} onClick={() => onSelect(id)} onDoubleClick={() => onEdit(id)}><span>{node.children.length ? <ChevronDown size={12} /> : <span className="outline-dot" />}</span><span>{node.content?.sticker}{node.text || '空主题'}</span>{node.content?.todo && <small>{node.content.todo === 'done' ? '✓' : '□'}</small>}</button>{node.children.map(child => render(child, depth + 1))}</div>;
  };
  return <section className="outline-panel floating-panel" aria-label="大纲视图"><div className="section-heading"><h3><GitBranch size={16} />导图大纲</h3><button className="icon-button" aria-label="关闭大纲" onClick={onClose}><X size={16} /></button></div><p>点击定位 · 双击编辑 · 与画布同步</p><div className="outline-tree">{render(doc.rootId)}{doc.freeRoots?.map(id => render(id))}</div></section>;
}
export function Presentation({ doc, onClose }: { doc: MapDocument; onClose: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => { containerRef.current?.focus(); }, []);
  const slides = getSlides(doc).filter(slide => !slide.hidden);
  if (!slides.length) slides.push({ id: doc.rootId, nodeId: doc.rootId, title: '', notes: '', hidden: false });
  const [index, setIndex] = useState(0);
  const slide = slides[index] ?? slides[0]; const current = doc.nodes[slide.nodeId]; const isIntro = slide.nodeId === doc.rootId; const scale = doc.presentation?.fontScale ?? 1;
  const change = (value: number) => { const next = Math.max(0, Math.min(slides.length - 1, value)); setIndex(next); };
  const branchText = (id: string): ReactNode => {
    const node = doc.nodes[id];
    return <li key={id}><div><span className="slide-bullet" style={{ background: node.color }} /><span>{node.content?.sticker} {node.text || '空主题'}</span>{node.content?.todo && <small>{node.content.todo === 'done' ? '已完成' : '待完成'}</small>}{node.content?.tags?.map(tag => <small key={tag}>#{tag}</small>)}</div>{node.children.length > 0 && <ul>{node.children.map(child => branchText(child))}</ul>}</li>;
  };
  return <div ref={containerRef} className={`presentation theme-${doc.presentation?.theme ?? 'sage'}`} role="dialog" aria-modal="true" aria-label="演说模式" tabIndex={-1} onKeyDown={event => {
    if (event.key === 'Escape') { event.stopPropagation(); onClose(); }
    if (event.key === 'ArrowRight' || event.key === ' ') { event.preventDefault(); change(index + 1); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); change(index - 1); }
    if (event.key === 'Tab') { const buttons = containerRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'); if (!buttons?.length) return; if (event.shiftKey && (document.activeElement === buttons[0] || document.activeElement === containerRef.current)) { event.preventDefault(); buttons[buttons.length - 1].focus(); } else if (!event.shiftKey && (document.activeElement === buttons[buttons.length - 1] || document.activeElement === containerRef.current)) { event.preventDefault(); buttons[0].focus(); } }
  }}><div className="presentation-header"><span>Mimicraft<span> / 演说</span></span><button className="icon-button" aria-label="退出演说" onClick={onClose}><X size={20} /></button></div><div className="slide" style={{ '--presentation-scale': scale } as React.CSSProperties}><span className="slide-kicker">{isIntro ? 'THE BIG PICTURE' : `PART ${String(index).padStart(2, '0')}`}</span><h1 style={{ fontSize: `${Math.round(48 * scale)}px` }}>{current.content?.sticker} {slide.title || current.text || doc.title}</h1><div className="slide-rule" /><ul className={`slide-branches ${isIntro ? 'intro' : ''}`}>{current.children.map(child => isIntro ? <li key={child}><div><span className="slide-bullet" style={{ background: doc.nodes[child].color }} /><span>{doc.nodes[child].text}</span><ChevronRight size={16} /></div></li> : branchText(child))}</ul>{!current.children.length && <p className="empty-slide">{current.content?.note || '给这个想法一点空间。'}</p>}{slide.notes && <p className="slide-notes">{slide.notes}</p>}</div><div className="presentation-footer"><span>{doc.title}</span><div><button className="icon-button" aria-label="上一张" disabled={index === 0} onClick={() => change(index - 1)}><ArrowLeft size={18} /></button><span aria-live="polite">{index + 1} / {slides.length}</span><button className="icon-button" aria-label="下一张" disabled={index === slides.length - 1} onClick={() => change(index + 1)}><ArrowRight size={18} /></button></div><span>← → 翻页 · Esc 退出</span></div></div>;
}
