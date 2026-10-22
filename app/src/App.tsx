import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownRight, CalendarDays, ClipboardPaste, Scissors, SlidersHorizontal, Flag, MessageSquare, Type, ArrowUpLeft, BookOpen, Braces, Check, CheckCheck, ChevronDown, ChevronRight, CircleHelp, CloudOff, Copy, Download, Expand, FilePlus2, Focus, FolderOpen, GitBranch, LayoutTemplate, Link2, ListTree, LoaderCircle, Maximize, Minus, MousePointer2, PanelRightClose, PanelRightOpen, Paperclip, Plus, Presentation as PresentationIcon, RectangleHorizontal, Redo2, Search, Sigma, Smile, Sparkles, SquareCheck, StickyNote, Tag, Trash2, Undo2, X, type LucideIcon } from 'lucide-react';
import { COLORS, MAX_FILE_BYTES, addGroup, addNode, addRelation, changeLevel, commit, createDocument, deleteNodes, descendants, duplicateBranch, editNode, layoutDocument, moveNode, parentOf, parseDocument, recolor, redo, serializeDocument, startHistory, toggleCollapse, undo, type DropMode, type History, type MapDocument } from './model';
import { loadWorkspace, moveTrash, saveDocument } from './storage';
import { orderedCanvases, switchCanvas, addCanvas } from './workbook';
import { decryptWorkbook, encryptWorkbook, isEncrypted } from './encrypted';
import Dialog from './Dialog';
import type { ContentTab } from './ContentEditor';
const ContentEditor = lazy(() => import('./ContentEditor'));
const Formula = lazy(() => import('./Formula'));
import Adornments, { type EntityEdit } from './Adornments';
import { Outline, Presentation } from './Views';
import { FONTS, LAYOUTS, MARKERS, numbering, type Marker, type NodeStyle } from './extended';
import { addFreeNode, alignFree, applyStyle, copySelection, detachBranch, pasteSelection, positionNode, resetStyles, setLayer, type Alignment } from './operations';
import { connectionPath } from './layouts';
import { ILLUSTRATION_ICONS } from './visuals';
import { PresentationEditor, TaskList, useTaskReminders } from './Planning';
const AdvancedPanel = lazy(() => import('./AdvancedPanel'));
const TemplatesDialog = lazy(() => import('./TemplatesDialog'));
const ExportDialog = lazy(() => import('./ExportDialog'));
const FileManager = lazy(() => import('./FileManager'));

type Editing = { id: string; value: string };
type Modal = 'templates' | 'help' | null;
type SaveState = 'loading' | 'saving' | 'saved' | 'error' | 'temporary';
type Drop = { id: string; mode: DropMode };

function Tool({ icon: Icon, label, hint, onClick, disabled, className = '' }: { icon: LucideIcon; label: string; hint?: string; onClick: () => void; disabled?: boolean; className?: string }) {
  return <button type="button" className={`tool ${className}`} aria-label={label} title={hint ? `${label} · ${hint}` : label} onClick={onClick} disabled={disabled}><Icon size={18} strokeWidth={1.7} /><span>{label}</span></button>;
}
function IconButton({ icon: Icon, label, onClick, disabled, active = false }: { icon: LucideIcon; label: string; onClick: () => void; disabled?: boolean; active?: boolean }) {
  return <button type="button" className={`icon-button ${active ? 'active' : ''}`} aria-label={label} title={label} onClick={onClick} disabled={disabled}><Icon size={18} strokeWidth={1.7} /></button>;
}
export default function App() {
  const [history, setHistory] = useState<History>(() => startHistory(createDocument()));
  const historyRef = useRef(history);
  const doc = history.present;
  const [selected, setSelected] = useState<string[]>([doc.rootId]);
  const [editing, setEditing] = useState<Editing | null>(null);
  const editingRef = useRef<Editing | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('loading');
  const [ready, setReady] = useState(false);
  const [recoveryError, setRecoveryError] = useState('');
  const [temporary, setTemporary] = useState(false);
  const [documents, setDocuments] = useState<MapDocument[]>([]);
  const [modal, setModal] = useState<Modal>(null);
  const [library, setLibrary] = useState(false);
  const [query, setQuery] = useState('');
  const [inspector, setInspector] = useState(true);
  const [view, setView] = useState({ x: 0, y: 0, zoom: 0.85 });
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const [drop, setDrop] = useState<Drop | null>(null);
  const [panning, setPanning] = useState(false);
  const [context, setContext] = useState<{ x: number; y: number; id: string } | null>(null);
  const [titleDraft, setTitleDraft] = useState(doc.title);
  const [downloadedAt, setDownloadedAt] = useState('');
  const [relationFrom, setRelationFrom] = useState<string | null>(null);
  const [entityEdit, setEntityEdit] = useState<EntityEdit | null>(null);
  const [contentEdit, setContentEdit] = useState<{ id: string; tab: ContentTab } | null>(null);
  const [insertMenu, setInsertMenu] = useState(false);
  const [outline, setOutline] = useState(false);
  const [zen, setZen] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const [focusedBranch, setFocusedBranch] = useState<string | null>(null);
  const [tagFilter, setTagFilter] = useState('');
  const [markerFilter, setMarkerFilter] = useState('');
  const [advanced, setAdvanced] = useState(false);
  const [editMenu, setEditMenu] = useState(false);
  const [taskList, setTaskList] = useState(false);
  const [presentationEditor, setPresentationEditor] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [fileManager, setFileManager] = useState(false);
  const [pendingEncrypted, setPendingEncrypted] = useState('');
  const [openPassword, setOpenPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSet, setPasswordSet] = useState(false);
  const downloadPassword = useRef('');
  const clipboard = useRef('');
  const styleClipboard = useRef<{ style: NodeStyle; color: string } | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const panRef = useRef<{ x: number; y: number; originX: number; originY: number } | null>(null);
  const revision = useRef(0);
  const readyRef = useRef(false);
  const temporaryRef = useRef(false);
  const points = useMemo(() => {
    const layout = layoutDocument(doc);
    if (!focusedBranch || !doc.nodes[focusedBranch]) return layout;
    const visible = new Set(descendants(doc, focusedBranch));
    return layout.filter(point => visible.has(point.id));
  }, [doc, focusedBranch]);
  const pointById = useMemo(() => new Map(points.map(p => [p.id, p])), [points]);
  const single = selected.length === 1 ? doc.nodes[selected[0]] : undefined;
  const selectedId = single?.id ?? doc.rootId;
  const nodeCount = Object.keys(doc.nodes).length;
  const numbered = useMemo(() => numbering(doc), [doc]);
  const parents = useMemo(() => new Map(Object.values(doc.nodes).flatMap(node => node.children.map(child => [child, node.id] as const))), [doc]);
  const canDelete = selected.some(id => id !== doc.rootId);

  const notify = useCallback((text: string) => setMessage(text), []);
  useTaskReminders(doc, notify);
  useEffect(() => { if (message) { const timer = setTimeout(() => setMessage(''), 4500); return () => clearTimeout(timer); } }, [message]);
  useEffect(() => { setTitleDraft(doc.title); }, [doc.title]);
  useEffect(() => { document.title = `${doc.title || '未命名导图'} · Mimicraft`; }, [doc.title]);
  useEffect(() => {
    let alive = true;
    loadWorkspace().then(workspace => {
      if (!alive) return;
      if (workspace.active) {
        const next = startHistory(workspace.active); historyRef.current = next; setHistory(next); setSelected([workspace.active.rootId]);
      }
      setDocuments(workspace.documents); readyRef.current = true; setReady(true); setRecoveryError('');
    }).catch(error => { if (alive) { setRecoveryError(String(error instanceof Error ? error.message : error)); setSaveState('error'); } });
    return () => { alive = false; };
  }, []);
  const updateDocumentList = useCallback((snapshot: MapDocument) => {
    setDocuments(list => [snapshot, ...list.filter(item => item.id !== snapshot.id)].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
  }, []);
  useEffect(() => {
    if (!ready || temporary) return;
    setSaveState('saving');
    const ticket = ++revision.current;
    const timer = setTimeout(() => {
      if (ticket !== revision.current) return;
      saveDocument(doc).then(() => {
        updateDocumentList(doc);
        if (ticket === revision.current) setSaveState('saved');
      }).catch(() => { if (ticket === revision.current) setSaveState('error'); });
    }, 350);
    return () => { clearTimeout(timer); revision.current++; };
  }, [doc, ready, temporary, updateDocumentList]);

  const apply = (nextDoc: MapDocument) => {
    const next = commit(historyRef.current, nextDoc);
    historyRef.current = next; setHistory(next);
    setSelected(ids => ids.filter(id => !!next.present.nodes[id]));
  };
  const finishEdit = (cancel = false): MapDocument => {
    const draft = editingRef.current;
    editingRef.current = null; setEditing(null);
    if (draft && !cancel) {
      try { apply(editNode(historyRef.current.present, draft.id, draft.value)); } catch (error) { notify((error as Error).message); }
    }
    return historyRef.current.present;
  };
  const beginEdit = (id: string) => {
    finishEdit();
    const value = historyRef.current.present.nodes[id]?.text;
    if (value === undefined) return;
    const draft = { id, value }; editingRef.current = draft; setEditing(draft); setSelected([id]); setContext(null);
  };
  const add = (child: boolean) => {
    const current = finishEdit();
    try {
      const result = addNode(current, child && selected.length === 1 ? selected[0] : current.rootId, child ? '细分主题' : '分支主题');
      apply(result.doc); setSelected([result.id]);
      if (!child) setFocusedBranch(null);
      const draft = { id: result.id, value: result.doc.nodes[result.id].text }; editingRef.current = draft; setEditing(draft);
    } catch (error) { notify((error as Error).message); }
  };
  const createGroup = (kind: 'summary' | 'boundary') => {
    const current = finishEdit();
    try {
      const next = addGroup(current, selected, kind); apply(next);
      const group = next.groups.at(-1); if (group) setEntityEdit({ id: group.id, kind: 'group', text: group.text });
    } catch (error) { notify((error as Error).message); }
  };
  const openContent = (tab: ContentTab, id = selectedId) => { finishEdit(); setInsertMenu(false); setContentEdit({ id, tab }); };
  const saveEntity = (removeEntity = false) => {
    if (!entityEdit) return;
    const next = structuredClone(historyRef.current.present);
    if (entityEdit.kind === 'relation') next.relations = removeEntity ? next.relations.filter(edge => edge.id !== entityEdit.id) : next.relations.map(edge => edge.id === entityEdit.id ? { ...edge, text: entityEdit.text, ...(entityEdit.style ? { style: entityEdit.style } : {}), from: entityEdit.from ?? edge.from, to: entityEdit.to ?? edge.to } : edge);
    else next.groups = removeEntity ? next.groups.filter(group => group.id !== entityEdit.id) : next.groups.map(group => group.id === entityEdit.id ? { ...group, text: entityEdit.text, ...(entityEdit.style ? { style: entityEdit.style } : {}) } : group);
    try { serializeDocument(next); apply(next); setEntityEdit(null); } catch (error) { notify(`无法修改元素：${(error as Error).message}`); }
  };
  const remove = (keepChildren = false, ids = selected) => {
    const current = finishEdit();
    const parent = ids.map(id => parentOf(current, id)).find(Boolean) ?? current.rootId;
    const next = deleteNodes(current, ids, keepChildren); apply(next);
    setSelected([next.nodes[parent] ? parent : next.rootId]); if (focusedBranch && !next.nodes[focusedBranch]) setFocusedBranch(null); setContext(null); boardRef.current?.focus();
  };
  const travel = (direction: 'undo' | 'redo') => {
    finishEdit();
    const next = direction === 'undo' ? undo(historyRef.current) : redo(historyRef.current);
    historyRef.current = next; setHistory(next);
    setSelected(ids => { const valid = ids.filter(id => next.present.nodes[id]); return valid.length ? valid : [next.present.rootId]; });
  };
  const changeHierarchy = (direction: 'promote' | 'demote') => {
    const current = finishEdit(); apply(changeLevel(current, selectedId, direction));
  };
  const duplicate = (id: string) => {
    const current = finishEdit(); const parentId = parentOf(current, id);
    if (!parentId) { try { const result = pasteSelection(current, null, copySelection(current, [id])); apply(result.doc); setSelected(result.ids); } catch (error) { notify((error as Error).message); } setContext(null); return; }
    try { const result = duplicateBranch(current, id); apply(result.doc); setSelected([result.id]); } catch (error) { notify((error as Error).message); }
    setContext(null);
  };
  const worldAt = (x: number, y: number) => {
    const rect = boardRef.current!.getBoundingClientRect();
    return { x: (x - rect.left - rect.width / 2 - view.x) / view.zoom, y: (y - rect.top - rect.height * 0.49 - view.y) / view.zoom };
  };
  const newFree = (position = { x: -view.x / view.zoom + (((doc.freeRoots?.length ?? 0) % 3) - 1) * 260, y: -view.y / view.zoom + 180 + Math.floor((doc.freeRoots?.length ?? 0) / 3) * 180 }) => {
    try { const result = addFreeNode(finishEdit(), position); apply(result.doc); setSelected([result.id]); setFocusedBranch(null); setContext(null); setEditMenu(false); const draft = { id: result.id, value: '自由主题' }; editingRef.current = draft; setEditing(draft); } catch (error) { notify((error as Error).message); }
  };
  const copy = async (cut = false) => {
    const current = finishEdit();
    if (cut && selected.includes(current.rootId)) { notify('中心主题不能剪切，请选择分支或自由主题'); return; }
    try {
      const text = copySelection(current, selected); clipboard.current = text; let external = false;
      try { await navigator.clipboard.writeText(text); external = true; } catch { /* App clipboard remains available. */ }
      if (cut && historyRef.current.present.id === current.id) { apply(deleteNodes(historyRef.current.present, selected)); setSelected([current.rootId]); }
      setContext(null); setEditMenu(false); notify(`${cut ? '已剪切' : '已复制'}${external ? '到剪贴板' : '到应用内剪贴板（系统权限不可用）'}`);
    } catch (error) { notify((error as Error).message); }
  };
  const paste = async (free = false) => {
    finishEdit();
    try {
      let text = clipboard.current;
      try { const external = await navigator.clipboard.readText(); if (external) text = external; } catch { /* Use the app clipboard if browser access is denied. */ }
      const current = historyRef.current.present; const target = free ? null : current.nodes[selectedId] ? selectedId : current.rootId;
      const result = pasteSelection(current, target, text); apply(result.doc); setSelected(result.ids); setFocusedBranch(null); setContext(null); setEditMenu(false);
      notify(result.droppedLinks ? `已粘贴；${result.droppedLinks} 个选区外主题链接未复制` : '已粘贴主题');
    } catch (error) { notify(`无法粘贴：${(error as Error).message}`); }
  };
  const copyStyle = () => { const node = finishEdit().nodes[selectedId]; if (node) { styleClipboard.current = { style: structuredClone(node.style ?? {}), color: node.color }; notify('已拷贝主题样式'); } setContext(null); setEditMenu(false); };
  const pasteStyle = () => {
    const style = styleClipboard.current; if (!style) { notify('请先拷贝一个主题的样式'); return; }
    const next = applyStyle(finishEdit(), selected, style.style, false, true); selected.forEach(id => { if (next.nodes[id]) next.nodes[id].color = style.color; }); apply(next); setContext(null); setEditMenu(false);
  };
  const clearText = () => { let next = finishEdit(); selected.forEach(id => { next = editNode(next, id, ''); }); apply(next); setContext(null); setEditMenu(false); };
  const align = (mode: Alignment) => { apply(alignFree(finishEdit(), selected, mode)); setEditMenu(false); };
  const expandAll = () => { const next = structuredClone(finishEdit()); const ids = selected.length ? selected.flatMap(id => descendants(next, id)) : Object.keys(next.nodes); ids.forEach(id => { next.nodes[id].collapsed = false; }); apply(next); setContext(null); setEditMenu(false); };
  const layer = (front: boolean) => { apply(setLayer(finishEdit(), selected, front)); setContext(null); setEditMenu(false); };
  const commitTitleDraft = () => {
    const active = document.activeElement;
    if (active instanceof HTMLInputElement && active.getAttribute('aria-label') === '导图名称') active.blur();
  };
  const persistCurrent = async () => {
    commitTitleDraft();
    const current = finishEdit();
    if (temporaryRef.current) { updateDocumentList(current); return current; }
    if (!readyRef.current) throw new Error('本地存储尚未就绪');
    setSaveState('saving');
    await saveDocument(current); updateDocumentList(current); return current;
  };
  const activate = async (nextDoc: MapDocument) => {
    if (busy) return;
    revision.current++;
    setBusy(true);
    try {
      await persistCurrent();
      if (!temporaryRef.current) await saveDocument(nextDoc);
      updateDocumentList(nextDoc);
      const next = startHistory(nextDoc); historyRef.current = next; setHistory(next);
      setSelected([nextDoc.rootId]); setView({ x: 0, y: 0, zoom: 0.85 }); setDownloadedAt('');
      setLibrary(false); setModal(null); setContext(null);
      setRelationFrom(null); setInsertMenu(false); setContentEdit(null); setEntityEdit(null);
      setFocusedBranch(null); setTagFilter(''); setMarkerFilter(''); setQuery(''); setEditMenu(false);
      downloadPassword.current = ''; setPasswordSet(false);
    } catch (error) { setSaveState('error'); notify(`切换前保存失败，当前导图已保留：${(error as Error).message}`); }
    finally { setBusy(false); }
  };
  const download = async () => {
    if (busy) return;
    commitTitleDraft();
    setBusy(true);
    try {
      const current = finishEdit();
      const content = downloadPassword.current ? await encryptWorkbook(current, downloadPassword.current) : serializeDocument(current);
      const url = URL.createObjectURL(new Blob([content], { type: 'application/octet-stream' }));
      const anchor = document.createElement('a'); anchor.href = url;
      anchor.download = `${current.title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').trim() || '未命名导图'}.mimicraft`;
      anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 30000);
      setDownloadedAt(new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }));
      notify('已发起文件下载，请在浏览器下载列表中确认');
    } catch (error) { notify((error as Error).message); } finally { setBusy(false); }
  };
  const openFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES * 1.4 + 2000) { notify('文件过大，暂不支持打开'); return; }
    try { const text = await file.text(); if (isEncrypted(text)) { setPendingEncrypted(text); setOpenPassword(''); setPasswordError(''); return; } const imported = parseDocument(text); await activate(imported); }
    catch (error) { notify((error as Error).message); }
  };
  const applyCanvas = (next: MapDocument) => { apply(next); setSelected([next.rootId]); setFocusedBranch(null); setQuery(''); setTagFilter(''); setMarkerFilter(''); setView({ x: 0, y: 0, zoom: .85 }); };
  const trashDocument = async (item: MapDocument) => {
    if (temporaryRef.current) throw new Error('临时模式不能修改本地文件');
    if (item.id === historyRef.current.present.id) { await activate(documents.find(other => other.id !== item.id) ?? createDocument('blank')); }
    if (item.id === historyRef.current.present.id) throw new Error('切换前保存失败，未移动当前文件');
    await moveTrash(item); setDocuments(list => list.filter(other => other.id !== item.id));
  };
  const restoreDocument = async (item: MapDocument) => { await moveTrash(item, true); updateDocumentList(item); };
  const retrySave = async () => {
    if (!ready) {
      setSaveState('loading');
      try {
        const workspace = await loadWorkspace();
        if (workspace.active) { const next = startHistory(workspace.active); historyRef.current = next; setHistory(next); setSelected([workspace.active.rootId]); }
        setDocuments(workspace.documents); setRecoveryError(''); readyRef.current = true; setReady(true);
      } catch (error) { setRecoveryError((error as Error).message); setSaveState('error'); }
      return;
    }
    try { await persistCurrent(); setSaveState('saved'); notify('已重新保存在此浏览器'); }
    catch { setSaveState('error'); notify('仍无法自动保存，请下载文件备份'); }
  };

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const input = !!target.closest('input, textarea, select, [contenteditable=true]');
      if (modal || contentEdit || entityEdit || advanced || taskList || presentationEditor || presenting || recoveryError || busy || exportOpen || fileManager || pendingEncrypted) return;
      if (event.key === 'Escape') { setRelationFrom(null); setInsertMenu(false); setEditMenu(false); setZen(false); }
      const mod = event.ctrlKey || event.metaKey;
      if (mod && event.key.toLowerCase() === 's') { event.preventDefault(); download(); return; }
      if (input) return;
      if (mod && event.key.toLowerCase() === 'p') { event.preventDefault(); finishEdit(); setExportOpen(true); return; }
      if (mod && event.key.toLowerCase() === 'z') { event.preventDefault(); travel(event.shiftKey ? 'redo' : 'undo'); }
      else if (mod && event.key.toLowerCase() === 'y') { event.preventDefault(); travel('redo'); }
      else if (mod && event.key.toLowerCase() === 'o') { event.preventDefault(); fileRef.current?.click(); }
      else if (mod && event.altKey && event.key.toLowerCase() === 'c') { event.preventDefault(); copyStyle(); }
      else if (mod && event.altKey && event.key.toLowerCase() === 'v') { event.preventDefault(); pasteStyle(); }
      else if (mod && event.altKey && event.key === '0') { event.preventDefault(); apply(resetStyles(finishEdit(), selected)); }
      else if (mod && event.altKey && event.key === 'ArrowUp') { event.preventDefault(); layer(true); }
      else if (mod && event.altKey && event.key === 'ArrowDown') { event.preventDefault(); layer(false); }
      else if (mod && event.altKey && event.key.toLowerCase() === 'n') { event.preventDefault(); finishEdit(); setModal('templates'); }
      else if (mod && event.shiftKey && event.key.toLowerCase() === 'r' && single) { event.preventDefault(); setRelationFrom(selectedId); }
      else if (mod && event.key.toLowerCase() === 'c') { event.preventDefault(); void copy(); }
      else if (mod && event.key.toLowerCase() === 'x') { event.preventDefault(); void copy(true); }
      else if (mod && event.key.toLowerCase() === 'v') { event.preventDefault(); void paste(); }
      else if (mod && event.key.toLowerCase() === 'd' && single) { event.preventDefault(); duplicate(selectedId); }
      else if (mod && event.key.toLowerCase() === 'a' && target === boardRef.current) { event.preventDefault(); setSelected(points.map(point => point.id)); }
      else if (target.closest('button, a')) return;
      else if (event.key === 'Tab' && selected.length === 1 && target === boardRef.current) { event.preventDefault(); add(true); }
      else if (event.key === 'Enter' && target === boardRef.current) { event.preventDefault(); add(false); }
      else if (event.key === ' ' && single && target === boardRef.current) { event.preventDefault(); apply(toggleCollapse(finishEdit(), selectedId)); }
      else if (event.key.startsWith('Arrow') && single && target === boardRef.current) {
        event.preventDefault(); const parent = parentOf(doc, selectedId); const siblings = parent ? doc.nodes[parent].children : [doc.rootId, ...(doc.freeRoots ?? [])]; const index = siblings.indexOf(selectedId);
        const targetId = event.key === 'ArrowLeft' ? parent : event.key === 'ArrowRight' ? single.children[0] : event.key === 'ArrowUp' ? siblings[Math.max(0, index - 1)] : siblings[Math.min(siblings.length - 1, index + 1)];
        if (targetId) locate(targetId);
      }
      else if ((event.key === 'Delete' || event.key === 'Backspace') && target === boardRef.current) { event.preventDefault(); remove(event.ctrlKey || event.metaKey); }
      else if (event.key === 'F2' && selected.length === 1) { event.preventDefault(); beginEdit(selected[0]); }
      else if (event.key === 'Escape') { setContext(null); setLibrary(false); }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });
  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;
    const wheel = (event: WheelEvent) => {
      if ((event.target as HTMLElement).closest('textarea')) return;
      event.preventDefault();
      if (event.ctrlKey || event.metaKey) {
        const rect = board.getBoundingClientRect();
        const x = event.clientX - rect.left - rect.width / 2; const y = event.clientY - rect.top - rect.height / 2;
        setView(previous => { const zoom = Math.min(2, Math.max(0.2, previous.zoom * Math.exp(-event.deltaY * 0.006))); const ratio = zoom / previous.zoom; return { zoom, x: x - (x - previous.x) * ratio, y: y - (y - previous.y) * ratio }; });
      } else setView(previous => ({ ...previous, x: previous.x - event.deltaX, y: previous.y - event.deltaY }));
    };
    board.addEventListener('wheel', wheel, { passive: false });
    return () => board.removeEventListener('wheel', wheel);
  }, []);
  const fit = () => {
    const board = boardRef.current; if (!board) return;
    const minX = Math.min(...points.map(p => p.x - p.width / 2)); const maxX = Math.max(...points.map(p => p.x + p.width / 2));
    const minY = Math.min(...points.map(p => p.y - p.height / 2)) - (doc.relations.length ? 85 : 0); const maxY = Math.max(...points.map(p => p.y + p.height / 2));
    const right = maxX + (doc.groups.some(group => group.kind === 'summary') ? 170 : 0);
    const zoom = Math.min(1.15, Math.max(0.2, Math.min((board.clientWidth - 120) / (right - minX), (board.clientHeight - 140) / (maxY - minY))));
    setView({ zoom, x: -(right + minX) / 2 * zoom, y: -(maxY + minY) / 2 * zoom });
  };
  const selectNode = (id: string, multi: boolean) => {
    if (relationFrom) {
      try {
        const current = finishEdit(); const next = addRelation(current, relationFrom, id);
        if (next === current) { notify('不能联系自身，或同向联系已经存在'); return; }
        apply(next); setRelationFrom(null); const edge = next.relations.at(-1)!; setEntityEdit({ id: edge.id, kind: 'relation', text: edge.text });
      } catch (error) { notify((error as Error).message); }
      return;
    }
    if (editingRef.current?.id !== id) finishEdit();
    setSelected(previous => multi ? previous.includes(id) ? previous.filter(key => key !== id) : [...previous, id] : [id]);
    setContext(null); if (!editingRef.current) boardRef.current?.focus();
  };
  const locate = (id: string) => {
    const current = finishEdit(); const next = structuredClone(current);
    let ancestor = parentOf(next, id);
    while (ancestor) { next.nodes[ancestor].collapsed = false; ancestor = parentOf(next, ancestor); }
    apply(next); setFocusedBranch(null); setSelected([id]);
    const point = layoutDocument(next).find(item => item.id === id);
    if (point) setView(previous => ({ ...previous, x: -point.x * previous.zoom, y: -point.y * previous.zoom }));
  };
  const dropOn = (event: React.DragEvent, id: string) => {
    event.preventDefault(); event.stopPropagation();
    const moving = dragging;
    if (moving && drop) {
      const current = finishEdit(); const next = moveNode(current, moving, id, drop.mode);
      if (next === current) notify('无法移动到这里：不能移入自身或后代节点');
      else apply(next);
    }
    setDragging(null); setDrop(null);
  };
  const editActions = [
    { label: '剪切主题', icon: Scissors, run: () => void copy(true), disabled: !selected.length || selected.includes(doc.rootId) },
    { label: '复制主题', icon: Copy, run: () => void copy(), disabled: !selected.length },
    { label: '粘贴主题', icon: ClipboardPaste, run: () => void paste(context?.id === ''), disabled: false },
    { label: '拷贝样式', icon: Copy, run: copyStyle, disabled: !single },
    { label: '粘贴样式', icon: ClipboardPaste, run: pasteStyle, disabled: !selected.length },
    { label: '重设样式', icon: SlidersHorizontal, run: () => { apply(resetStyles(finishEdit(), selected)); setContext(null); setEditMenu(false); }, disabled: !selected.length },
    { label: '清空文本', icon: Type, run: clearText, disabled: !selected.length },
    { label: '置于顶层', icon: ArrowUpLeft, run: () => layer(true), disabled: !selected.length },
    { label: '置于底层', icon: ArrowDownRight, run: () => layer(false), disabled: !selected.length },
    { label: '展开所有次级分支', icon: Expand, run: expandAll, disabled: false },
    { label: '选择全部主题', icon: MousePointer2, run: () => { setSelected(points.map(point => point.id)); setContext(null); setEditMenu(false); }, disabled: false },
    { label: '选择当前分支', icon: GitBranch, run: () => { setSelected(descendants(doc, selectedId)); setContext(null); setEditMenu(false); }, disabled: !single },
  ];
  const savedLabel = { loading: '正在读取本地导图…', saving: '正在保存…', saved: '已保存在此浏览器', error: '自动保存失败 · 点击重试', temporary: '临时模式 · 请下载备份' }[temporary ? 'temporary' : saveState];

  return <div className={`app-shell ${zen ? `zen-mode zen-${doc.preferences?.zenTheme ?? 'canvas'}` : ''} ${doc.preferences?.handDrawn ? 'hand-drawn' : ''} layout-${doc.layout}`} style={{ fontFamily: FONTS[doc.preferences?.globalFont ?? 'sans'] }}>
    <header className="app-header">
      <div className="brand" aria-label="Mimicraft"><span className="brand-mark"><GitBranch size={22} strokeWidth={2} /></span><span>Mimicraft<span className="brand-dot">.</span></span></div>
      <span className="header-divider" />
      <div className="document-meta">
        <input aria-label="导图名称" className="document-title" value={titleDraft} maxLength={200} disabled={!ready || busy} onChange={event => setTitleDraft(event.target.value)} onBlur={event => { const title = event.currentTarget.value.trim() || '未命名导图'; setTitleDraft(title); apply({ ...historyRef.current.present, title }); }} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') { event.currentTarget.value = doc.title; setTitleDraft(doc.title); event.currentTarget.blur(); } }} />
        <button className={`save-status ${saveState === 'error' || temporary ? 'error' : ''}`} onClick={() => { if (saveState === 'error') void retrySave(); else notify('导图仅保存在此浏览器。建议定期下载文件备份。'); }} aria-label={savedLabel}>
          {saveState === 'saving' || saveState === 'loading' ? <LoaderCircle className="spin" size={12} /> : temporary || saveState === 'error' ? <CloudOff size={12} /> : <CheckCheck size={12} />}<span role="status">{savedLabel}</span>
        </button>
      </div>
      <div className="header-actions"><span className="local-badge"><span /> 本地优先，安心创作</span><button className="secondary-button file-header-button" onClick={() => { finishEdit(); setFileManager(true); }} disabled={!ready || busy}>文件管理</button><button className="secondary-button file-header-button" onClick={() => { commitTitleDraft(); finishEdit(); setExportOpen(true); }} disabled={!ready || busy}>导出与打印</button><button className="primary-button" onClick={() => void download()} disabled={!ready || busy}><Download size={15} />下载导图</button><IconButton icon={CircleHelp} label="使用帮助" onClick={() => setModal('help')} /></div>
    </header>

    <div className="toolbar" aria-label="编辑工具栏">
      <div className="toolbar-group"><Tool icon={FilePlus2} label="新建" hint="选择模板" onClick={() => { finishEdit(); setModal('templates'); }} disabled={!ready || busy} /><Tool icon={FolderOpen} label="打开" hint=".mimicraft 文件" onClick={() => fileRef.current?.click()} disabled={!ready || busy} /></div>
      <span className="toolbar-divider" />
      <div className="toolbar-group compact"><IconButton icon={Undo2} label="撤销" onClick={() => travel('undo')} disabled={!history.past.length || busy} /><IconButton icon={Redo2} label="重做" onClick={() => travel('redo')} disabled={!history.future.length || busy} /></div>
      <div className="insert-menu-wrap"><Tool icon={Scissors} label="编辑操作" onClick={() => { finishEdit(); setEditMenu(!editMenu); setInsertMenu(false); }} disabled={!ready || busy} />{editMenu && <div className="insert-menu edit-actions-menu" role="menu" aria-label="编辑操作菜单">{editActions.map(action => <button role="menuitem" key={action.label} disabled={action.disabled} onClick={action.run}><action.icon size={14} />{action.label}</button>)}<hr /><button role="menuitem" onClick={() => newFree()}>插入自由主题</button>{single && single.id !== doc.rootId && <button role="menuitem" onClick={() => { apply(detachBranch(finishEdit(), selectedId)); setEditMenu(false); }}>转换为自由主题</button>}{(['left', 'right', 'top', 'bottom', 'center-x', 'center-y', 'distribute-x', 'distribute-y'] as const).map((mode, i) => <button role="menuitem" key={mode} onClick={() => align(mode)}>{['自由主题左对齐', '自由主题右对齐', '自由主题顶部对齐', '自由主题底部对齐', '自由主题水平中心对齐', '自由主题垂直中心对齐', '自由主题水平等距', '自由主题垂直等距'][i]}</button>)}</div>}</div>
      <span className="toolbar-divider" />
      <div className="toolbar-group"><Tool icon={GitBranch} label="主题" hint="Enter · 添加根级分支" onClick={() => add(false)} disabled={!ready || busy} /><Tool icon={Plus} label="细分主题" hint="Tab · 添加子节点" onClick={() => add(true)} disabled={!ready || !single || busy} /></div>
      <span className="toolbar-divider" />
      <div className="toolbar-group"><Tool icon={Link2} label="联系" hint="选择另一个主题" onClick={() => { finishEdit(); setRelationFrom(selectedId); }} disabled={!ready || !single || busy} className={relationFrom ? 'active' : ''} /><Tool icon={Braces} label="概要" onClick={() => createGroup('summary')} disabled={!ready || !selected.length || busy} /><Tool icon={RectangleHorizontal} label="外框" onClick={() => createGroup('boundary')} disabled={!ready || !selected.length || busy} /><div className="insert-menu-wrap"><Tool icon={Plus} label="插入" onClick={() => { finishEdit(); setInsertMenu(!insertMenu); setEditMenu(false); }} disabled={!ready || !single || busy} />{insertMenu && <div className="insert-menu">{[{ tab: 'note' as const, icon: StickyNote, text: '笔记' }, { tab: 'tags' as const, icon: Tag, text: '标签' }, { tab: 'todo' as const, icon: SquareCheck, text: '待办事项' }, { tab: 'link' as const, icon: Link2, text: '链接' }, { tab: 'equation' as const, icon: Sigma, text: '数学方程' }, { tab: 'sticker' as const, icon: Smile, text: '贴纸与插画' }, { tab: 'media' as const, icon: Paperclip, text: '图片 / 附件 / 语音' }, { tab: 'callout' as const, icon: MessageSquare, text: '标注' }, { tab: 'markers' as const, icon: Flag, text: '标记' }, { tab: 'task' as const, icon: CalendarDays, text: '计划任务' }, { tab: 'rich' as const, icon: Type, text: '富文本' }].map(item => <button key={item.tab} onClick={() => openContent(item.tab)}><item.icon size={15} />{item.text}</button>)}</div>}</div><Tool icon={Trash2} label="删除" hint="Delete · 删除子树" onClick={() => remove()} disabled={!ready || !canDelete || busy} /></div>
      <div className="toolbar-spacer" />
      <Tool icon={SlidersHorizontal} label="样式布局" onClick={() => { finishEdit(); setAdvanced(true); }} disabled={!ready || busy} /><IconButton icon={inspector ? PanelRightClose : PanelRightOpen} label={inspector ? '收起属性面板' : '展开属性面板'} onClick={() => setInspector(!inspector)} />
    </div>

    <div className="workspace">
      <nav className="rail" aria-label="工作区导航"><IconButton icon={MousePointer2} label="编辑画布" active={!library && !outline} onClick={() => { setLibrary(false); setOutline(false); boardRef.current?.focus(); }} /><IconButton icon={FolderOpen} label="本地导图" active={library} onClick={() => { setLibrary(!library); setOutline(false); }} /><IconButton icon={LayoutTemplate} label="模板库" onClick={() => setModal('templates')} /><IconButton icon={ListTree} label="导图大纲" active={outline} onClick={() => { setOutline(!outline); setLibrary(false); }} /><IconButton icon={Focus} label="ZEN 专注模式" onClick={() => { finishEdit(); setLibrary(false); setOutline(false); setZen(true); }} /><IconButton icon={PresentationIcon} label="开始演说" onClick={() => { finishEdit(); setPresenting(true); }} /><IconButton icon={CalendarDays} label="任务面板" onClick={() => { finishEdit(); setTaskList(true); }} /><IconButton icon={SlidersHorizontal} label="演说编排" onClick={() => { finishEdit(); setPresentationEditor(true); }} /><div className="rail-spacer" /><span className="rail-local" title="全部功能免费，无账号与云端上传"><CloudOff size={17} /></span><IconButton icon={CircleHelp} label="快捷操作说明" onClick={() => setModal('help')} /></nav>

      <main className={`canvas-wrap ${panning ? 'panning' : ''}`} ref={boardRef} tabIndex={0} aria-label="思维导图画布" onContextMenu={event => { if (!(event.target as HTMLElement).closest('.map-node, button, .floating-panel')) { event.preventDefault(); finishEdit(); setSelected([]); setContext({ x: Math.min(event.clientX, window.innerWidth - 230), y: Math.min(event.clientY, window.innerHeight - 350), id: '' }); } }}
        onDoubleClick={event => { if (!(event.target as HTMLElement).closest('.map-node, button, .floating-panel, .canvas-controls')) newFree(worldAt(event.clientX, event.clientY)); }}
        onDragOver={event => { if (dragging && (doc.freeRoots?.includes(dragging) || doc.preferences?.freeBranch)) event.preventDefault(); }}
        onDrop={event => { if (!dragging) return; event.preventDefault(); const position = worldAt(event.clientX, event.clientY); apply(positionNode(finishEdit(), dragging, position.x, position.y)); setDragging(null); setDrop(null); }}
        onPointerDown={event => {
          if (event.button !== 0 || (event.target as HTMLElement).closest('.map-node, button, .floating-panel, .canvas-controls, .relation-curve')) return;
          finishEdit(); setContext(null); setInsertMenu(false); setEditMenu(false); if (!relationFrom) setSelected([]); event.currentTarget.focus();
          panRef.current = { x: event.clientX, y: event.clientY, originX: view.x, originY: view.y };
          event.currentTarget.setPointerCapture(event.pointerId); setPanning(true);
        }}
        onPointerMove={event => { const pan = panRef.current; if (pan) setView(previous => ({ ...previous, x: pan.originX + event.clientX - pan.x, y: pan.originY + event.clientY - pan.y })); }}
        onPointerUp={() => { panRef.current = null; setPanning(false); }} onPointerCancel={() => { panRef.current = null; setPanning(false); }}>
        <div className="canvas-caption"><span className="eyebrow">YOUR SPACE TO THINK</span><span>好想法，从这里生长。</span></div>
        <div className="scene" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }}>
          <Adornments doc={doc} points={points} onEdit={setEntityEdit} />
          <svg className="connections" width="1" height="1" aria-hidden="true">
            <defs><filter id="sketch-lines"><feTurbulence type="fractalNoise" baseFrequency="0.025" numOctaves="2" seed="4" result="noise" /><feDisplacementMap in="SourceGraphic" in2="noise" scale="1.7" /></filter></defs>
            {!['matrix', 'table', 'grid'].includes(doc.layout) && points.flatMap(point => doc.nodes[point.id].children.map(child => {
              const end = pointById.get(child); if (!end) return null;
              const style = doc.nodes[child].style;
              return <path key={child} d={connectionPath(doc, point, end)} fill="none" stroke={end.color} strokeWidth={style?.lineWidth ?? doc.preferences?.branchWidth ?? (point.id === doc.rootId ? 2.5 : 1.7)} strokeDasharray={style?.dashed ? '7 4' : undefined} filter={doc.preferences?.handDrawn ? 'url(#sketch-lines)' : undefined} strokeOpacity="0.7" />;
            }))}
          </svg>
          {points.map(point => {
            const node = doc.nodes[point.id]; const root = node.id === doc.rootId; const Illustration = node.content?.illustration ? ILLUSTRATION_ICONS[node.content.illustration] : null; const chosen = selected.includes(node.id);
            const mode = drop?.id === node.id && dragging ? drop.mode : null;
            const match = query && `${node.text} ${node.content?.tags?.join(' ') ?? ''}`.toLowerCase().includes(query.toLowerCase());
            return <div key={node.id} data-node-id={node.id} data-node-text={node.text} data-parent-text={parents.has(node.id) ? doc.nodes[parents.get(node.id)!].text : ''} className={`map-node ${root ? 'root-node' : ''} ${chosen ? 'selected' : ''} ${editing?.id === node.id ? 'editing' : ''} ${dragging === node.id ? 'dragging' : ''} ${mode ? `drop-${mode}` : ''} ${match ? 'search-match' : ''} ${tagFilter && !node.content?.tags?.includes(tagFilter) || markerFilter && !node.content?.markers?.includes(markerFilter as Marker) ? 'filter-dimmed' : ''} ${doc.freeRoots?.includes(node.id) ? 'free-node' : ''} shape-${node.style?.shape ?? 'rounded'}`} style={{ left: point.x - point.width / 2, top: point.y - point.height / 2, width: point.width, height: point.height, '--node-color': node.color, zIndex: node.z === undefined ? undefined : 3 + node.z, fontSize: node.style?.fontSize, lineHeight: node.style?.fontSize ? `${Math.ceil(node.style.fontSize * 1.65)}px` : undefined, fontFamily: node.style?.fontFamily ? FONTS[node.style.fontFamily] : undefined, fontWeight: node.style?.bold ? 700 : node.style?.bold === false ? 400 : undefined, fontStyle: node.style?.italic ? 'italic' : undefined, textDecoration: [node.style?.underline ? 'underline' : '', node.style?.strike ? 'line-through' : ''].join(' '), color: node.style?.textColor, background: node.style?.fill, borderColor: node.style?.borderColor, borderWidth: node.style?.borderWidth, textAlign: node.style?.align } as React.CSSProperties}
              draggable={!root && !editing} role="treeitem" aria-label={`节点：${node.text || '空主题'}`} aria-selected={chosen} aria-expanded={node.children.length ? !node.collapsed : undefined}
              onClick={event => { event.stopPropagation(); selectNode(node.id, event.shiftKey); }}
              onDoubleClick={event => { event.stopPropagation(); beginEdit(node.id); }}
              onContextMenu={event => { event.preventDefault(); event.stopPropagation(); finishEdit(); setSelected(previous => previous.includes(node.id) ? previous : [node.id]); setContext({ x: Math.min(event.clientX, window.innerWidth - 230), y: Math.min(event.clientY, window.innerHeight - 320), id: node.id }); }}
              onDragStart={event => { finishEdit(); setDragging(node.id); setSelected([node.id]); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', node.id); }}
              onDragEnd={() => { setDragging(null); setDrop(null); }}
              onDragOver={event => {
                if (!dragging) return; event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = 'move';
                const rect = event.currentTarget.getBoundingClientRect(); const ratio = (event.clientY - rect.top) / rect.height;
                setDrop({ id: node.id, mode: root ? 'child' : ratio < 0.25 ? 'before' : ratio > 0.75 ? 'after' : 'child' });
              }} onDrop={event => dropOn(event, node.id)}>
              {editing?.id === node.id ? <textarea autoFocus aria-label="编辑节点文字" maxLength={10000} value={editing.value} style={{ height: Math.max(point.height, 74) }}
                onFocus={event => event.currentTarget.select()} onClick={event => event.stopPropagation()} onDoubleClick={event => event.stopPropagation()}
                onChange={event => { const draft = { id: node.id, value: event.target.value }; editingRef.current = draft; setEditing(draft); }}
                onBlur={() => finishEdit()} onKeyDown={event => {
                  event.stopPropagation();
                  if (event.nativeEvent.isComposing || event.keyCode === 229) return;
                  if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); finishEdit(); boardRef.current?.focus(); }
                  if (event.key === 'Escape') { event.preventDefault(); finishEdit(true); boardRef.current?.focus(); }
                }} /> : <>{doc.layout === 'grid' && parents.has(node.id) && <small className="grid-parent">↳ {doc.nodes[parents.get(node.id)!].text}</small>}<span className={`node-label ${!node.text ? 'placeholder' : ''}`}>{node.content?.sticker && <span className="node-sticker">{node.content.sticker} </span>}{Illustration && <Illustration size={18} />}{numbered.get(node.id)}{node.content?.richText ? node.content.richText.map((run, i) => <span key={i} style={{ fontWeight: run.bold ? 700 : undefined, fontStyle: run.italic ? 'italic' : undefined, textDecoration: [run.underline ? 'underline' : '', run.strike ? 'line-through' : ''].join(' '), color: run.color }}>{run.text}</span>) : node.text || '空主题'}</span>{node.content?.callout && <button className="node-callout" aria-label={`标注 ${node.text}`} onClick={event => { event.stopPropagation(); openContent('callout', node.id); }}>{node.content.callout}</button>}{node.content?.attachments?.find(asset => asset.kind === 'image') && <img className="node-thumbnail" src={node.content.attachments.find(asset => asset.kind === 'image')!.dataUrl} alt="主题图片" />}{node.content?.equation && <div className="node-formula"><Suspense fallback={<span>正在排版公式…</span>}><Formula source={node.content.equation} /></Suspense></div>}{node.content && Object.keys(node.content).length > 0 && <span className="node-badges">
                  {node.content.todo && <button className={node.content.todo === 'done' ? 'todo-done' : ''} aria-label={`待办 ${node.text}`} onClick={event => { event.stopPropagation(); const next = structuredClone(doc); next.nodes[node.id].content!.todo = node.content!.todo === 'done' ? 'open' : 'done'; if (next.nodes[node.id].content!.task) next.nodes[node.id].content!.task!.progress = next.nodes[node.id].content!.todo === 'done' ? 100 : 0; apply(next); }}><SquareCheck size={13} />{node.content.todo === 'done' ? '完成' : '待办'}</button>}
                  {node.content.markers?.length ? <button aria-label={`标记 ${node.text}`} onClick={event => { event.stopPropagation(); openContent('markers', node.id); }}>{node.content.markers.slice(0, 4).map(marker => MARKERS[marker]).join('')}</button> : null}
                  {node.content.task && <button aria-label={`计划 ${node.text}`} onClick={event => { event.stopPropagation(); openContent('task', node.id); }}><CalendarDays size={13} />{node.content.task.dueDate?.slice(5) ?? `${node.content.task.progress ?? 0}%`}</button>}
                  {node.content.note && <button aria-label={`笔记 ${node.text}`} onClick={event => { event.stopPropagation(); openContent('note', node.id); }}><StickyNote size={13} /></button>}
                  {node.content.tags?.length ? <button aria-label={`标签 ${node.text}`} onClick={event => { event.stopPropagation(); openContent('tags', node.id); }}>#{node.content.tags[0]}{node.content.tags.length > 1 ? ` +${node.content.tags.length - 1}` : ''}</button> : null}
                  {node.content.equation && <button aria-label={`方程 ${node.text}`} onClick={event => { event.stopPropagation(); openContent('equation', node.id); }}><Sigma size={13} /></button>}
                  {node.content.link && <button aria-label={`链接 ${node.text}`} onClick={event => {
                    event.stopPropagation(); const link = node.content!.link!;
                    if (link.kind === 'web') window.open(link.value, '_blank', 'noopener,noreferrer');
                    else if (link.kind === 'path') { if (navigator.clipboard) void navigator.clipboard.writeText(link.value).then(() => notify('已复制本地路径')).catch(() => notify(`本地路径：${link.value}`)); else notify(`本地路径：${link.value}`); }
                    else { const target = pointById.get(link.value); if (target) { setSelected([target.id]); setView(previous => ({ ...previous, x: -target.x * previous.zoom, y: -target.y * previous.zoom })); } else notify('目标主题位于折叠分支中，请先展开'); }
                  }}><Link2 size={13} /></button>}
                  {node.content.attachments?.length ? <button aria-label={`资源 ${node.text}`} onClick={event => { event.stopPropagation(); openContent('media', node.id); }}><Paperclip size={13} />{node.content.attachments.length}</button> : null}
                </span>}</>}
              {!!node.children.length && !editing && <button className={`collapse-button ${point.side}`} aria-label={node.collapsed ? `展开 ${node.text}` : `折叠 ${node.text}`} onClick={event => { event.stopPropagation(); apply(toggleCollapse(historyRef.current.present, node.id)); if (!node.collapsed) setSelected(ids => ids.filter(id => id === node.id || !descendants(doc, node.id).includes(id))); }}>{node.collapsed ? <span>{node.children.length}</span> : <Minus size={10} />}</button>}
            </div>;
          })}
        </div>
        {relationFrom && <div className="connect-hint floating-panel"><Link2 size={15} /><span>点击另一个主题建立联系</span><button onClick={() => setRelationFrom(null)}>取消 <kbd>Esc</kbd></button></div>}
        {query && <div className="search-result floating-panel"><Search size={14} /><span>{points.filter(p => `${doc.nodes[p.id].text} ${doc.nodes[p.id].content?.tags?.join(' ') ?? ''}`.toLowerCase().includes(query.toLowerCase())).length} 个可见主题匹配“{query}”</span><button aria-label="清除查找" onClick={() => setQuery('')}><X size={14} /></button></div>}
        {focusedBranch && <button className="branch-reset floating-panel" onClick={() => setFocusedBranch(null)}><ChevronRight size={14} />返回完整导图</button>}
        {zen && <button className="zen-exit floating-panel" onClick={() => setZen(false)}><Focus size={15} />退出专注 <kbd>Esc</kbd></button>}
        {outline && <Outline doc={doc} selected={selected} onSelect={locate} onEdit={id => { locate(id); beginEdit(id); }} onClose={() => setOutline(false)} />}
        <div className="canvas-hint"><MousePointer2 size={13} />双击编辑<span>·</span>拖动节点整理思路<span>·</span>Shift 多选</div>
        <div className="canvas-controls"><IconButton icon={Minus} label="缩小" onClick={() => setView(previous => ({ ...previous, zoom: Math.max(0.2, previous.zoom - 0.1) }))} /><button className="zoom-value" onClick={() => setView(previous => ({ ...previous, zoom: 1 }))} title="恢复 100%">{Math.round(view.zoom * 100)}%</button><IconButton icon={Plus} label="放大" onClick={() => setView(previous => ({ ...previous, zoom: Math.min(2, previous.zoom + 0.1) }))} /><span /><IconButton icon={Expand} label="适应画布" onClick={fit} /><IconButton icon={Maximize} label="回到中心主题" onClick={() => setView(previous => ({ ...previous, x: 0, y: 0 }))} /></div>

        {library && <section className="library floating-panel" aria-label="本地导图列表"><div className="section-heading"><h3>我的导图 <span>{documents.length}</span></h3><IconButton icon={X} label="关闭本地导图" onClick={() => setLibrary(false)} /></div><p>{temporary ? '临时模式：仅保留在此页面，请下载备份。' : '仅在当前浏览器保存，不会上传。'}</p><button className="new-map-button" onClick={() => setModal('templates')} disabled={busy}><Plus size={16} />新建一张导图</button><div className="library-items">{documents.length ? documents.map(item => <button key={item.id} className={`document-item ${item.id === doc.id ? 'current' : ''}`} disabled={busy} onClick={() => { if (item.id !== doc.id) void activate(item); else setLibrary(false); }}><span className="document-icon"><GitBranch size={19} /></span><span><strong>{item.title}</strong><small>{Object.keys(item.nodes).length} 个主题 · {new Date(item.updatedAt).toLocaleDateString('zh-CN')}</small></span>{item.id === doc.id && <Check size={15} />}</button>) : <div className="empty-list">保存后，导图会出现在这里。</div>}</div><div className="library-note"><Download size={14} /><span>定期下载文件，给想法多一份备份。</span></div></section>}
      </main>

      {inspector && <aside className="inspector" aria-label="属性面板">
        <div className="inspector-tabs"><span className="active">属性</span><button onClick={() => { finishEdit(); setAdvanced(true); }}>完整设置</button><span className="tiny-badge">本地</span></div>
        <div className="inspector-content">
          <div className="selection-info"><span className="selection-icon"><GitBranch size={19} /></span><div><strong>{selected.length > 1 ? `已选择 ${selected.length} 个主题` : single ? single.id === doc.rootId ? '中心主题' : '分支主题' : '你的思考空间'}</strong><small>{single ? '让每个想法清晰可见' : selected.length ? '批量整理你的想法' : '选择一个主题以进行编辑'}</small></div></div>
          {single && <div className="inspector-section"><div className="section-label">主题内容<button aria-label="编辑选中主题" onClick={() => beginEdit(single.id)}>编辑 <ChevronRight size={12} /></button></div><button className="text-preview" onClick={() => beginEdit(single.id)}>{single.text || '空主题'}</button></div>}
          {single && <div className="inspector-section"><div className="section-label">附加内容<button aria-label="编辑附加内容" onClick={() => openContent('note')}>管理 <ChevronRight size={12} /></button></div><div className="content-shortcuts"><button onClick={() => openContent('note')}><StickyNote size={14} />笔记</button><button onClick={() => openContent('todo')}><SquareCheck size={14} />待办</button><button onClick={() => openContent('media')}><Paperclip size={14} />资源</button></div></div>}
          {single && single.id !== doc.rootId && <button className="focus-branch-button" onClick={() => { finishEdit(); setFocusedBranch(single.id); const point = pointById.get(single.id); if (point) setView(previous => ({ ...previous, x: -point.x * previous.zoom, y: -point.y * previous.zoom })); }}><Focus size={14} />仅显示该分支</button>}
          {!!selected.length && <div className="inspector-section"><div className="section-label">分支颜色<span>含子主题</span></div><div className="swatches">{COLORS.map(color => <button key={color} aria-label={`分支颜色 ${color}`} className={single?.color === color ? 'chosen' : ''} style={{ background: color }} onClick={() => apply(recolor(finishEdit(), selected, color))}>{single?.color === color && <Check size={14} />}</button>)}</div></div>}
          {single && <div className="inspector-section"><div className="section-label">组织结构</div><div className="hierarchy-buttons"><button disabled={!parentOf(doc, single.id) || parentOf(doc, single.id) === doc.rootId} onClick={() => changeHierarchy('promote')}><ArrowUpLeft size={15} />提升层级</button><button disabled={!parentOf(doc, single.id) || doc.nodes[parentOf(doc, single.id)!].children.indexOf(single.id) === 0} onClick={() => changeHierarchy('demote')}><ArrowDownRight size={15} />降低层级</button></div>{single.children.length > 0 && <button className="full-line-button" onClick={() => apply(toggleCollapse(finishEdit(), single.id))}>{single.collapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}{single.collapsed ? '展开子主题' : '折叠子主题'}<span>{single.children.length}</span></button>}{single.id !== doc.rootId && <button className="full-line-button subtle-danger" onClick={() => remove(true)}><Trash2 size={14} />仅删除此节点<span title="其子节点提升一层">保留子主题</span></button>}</div>}
          <div className="inspector-section"><div className="section-label">导图布局</div><select className="tag-filter" aria-label="导图结构" value={doc.layout} onChange={event => apply({ ...finishEdit(), layout: event.target.value as MapDocument['layout'] })}>{Object.entries(LAYOUTS).map(([id, title]) => <option key={id} value={id}>{title}</option>)}</select><button className="full-line-button" onClick={() => { finishEdit(); setAdvanced(true); }}><SlidersHorizontal size={14} />字体、配色与高级布局</button></div>
          <div className="inspector-section"><div className="section-label">画布背景</div><div className="background-options">{[{ color: '#f7f8f5', name: '雾白' }, { color: '#f8f5ef', name: '暖纸' }, { color: '#eef5f2', name: '浅苔' }, { color: '#f0f2f8', name: '淡蓝' }].map(bg => <button aria-label={`背景 ${bg.name}`} key={bg.color} style={{ background: bg.color }} className={doc.background === bg.color ? 'chosen' : ''} onClick={() => apply({ ...finishEdit(), background: bg.color })}>{doc.background === bg.color && <Check size={13} />}</button>)}</div></div>
          <div className="inspector-section search-section"><div className="section-label">查找主题</div><label className="search-input"><Search size={14} /><input aria-label="查找主题" placeholder="输入关键词…" value={query} onChange={event => setQuery(event.target.value)} /></label></div>
          {Object.values(doc.nodes).some(node => node.content?.tags?.length) && <div className="inspector-section"><div className="section-label">按标签筛选</div><select className="tag-filter" aria-label="标签筛选" value={tagFilter} onChange={event => setTagFilter(event.target.value)}><option value="">显示全部主题</option>{[...new Set(Object.values(doc.nodes).flatMap(node => node.content?.tags ?? []))].map(tag => <option key={tag} value={tag}>{tag}</option>)}</select></div>}
          {Object.values(doc.nodes).some(node => node.content?.markers?.length) && <div className="inspector-section"><div className="section-label">按标记筛选</div><select className="tag-filter" aria-label="标记筛选" value={markerFilter} onChange={event => setMarkerFilter(event.target.value)}><option value="">显示全部主题</option>{Object.entries(MARKERS).map(([id, symbol]) => <option key={id} value={id}>{symbol} {id}</option>)}</select></div>}
          <div className="gentle-card"><Sparkles size={18} /><strong>留一点空间，给新想法。</strong><p>不必一次想清楚。先记下来，<br />再慢慢找到它们之间的连接。</p></div>
        </div>
        <div className="inspector-footer"><span className="status-dot" />所有功能免费 · 无云端上传</div>
      </aside>}
    </div>

    <div className="canvas-tabs" role="tablist" aria-label="导图画布">{orderedCanvases(doc).map(canvas => <button role="tab" aria-selected={canvas.id === (doc.canvasId ?? 'main')} key={canvas.id} onClick={() => { try { applyCanvas(switchCanvas(finishEdit(), canvas.id)); } catch (error) { notify((error as Error).message); } }}>{canvas.name}</button>)}<button aria-label="新增画布" onClick={() => { try { applyCanvas(addCanvas(finishEdit())); } catch (error) { notify((error as Error).message); } }}><Plus size={14} /></button></div>
    <footer className="statusbar"><span><span className="status-dot" />{LAYOUTS[doc.layout]}<ChevronDown size={12} /></span><span>{nodeCount} 个主题<span className="status-divider">|</span>{selected.length ? `已选 ${selected.length} 个` : '未选择'}<span className="status-divider">|</span>{downloadedAt ? `${downloadedAt} 已发起下载` : '浏览器自动保存 + 文件备份'}</span><span className="footer-signature">Made for your next idea.</span></footer>
    <input ref={fileRef} type="file" aria-label="打开导图文件" accept=".mimicraft,application/json" hidden onChange={event => { void openFile(event.target.files?.[0]); event.target.value = ''; }} />
    {exportOpen && <Suspense fallback={<div className="initial-loader">正在打开导出设置…</div>}><ExportDialog doc={doc} selectedId={selectedId} onClose={() => setExportOpen(false)} /></Suspense>}
    {fileManager && <Suspense fallback={<div className="initial-loader">正在打开文件管理…</div>}><FileManager doc={doc} documents={documents} passwordSet={passwordSet} temporary={temporary} onApply={applyCanvas} onActivate={activate} onTrash={trashDocument} onRestore={restoreDocument} onPassword={password => { downloadPassword.current = password; setPasswordSet(!!password); notify(password ? '已启用文件加密下载；浏览器副本不加密' : '后续下载不再加密'); }} onClose={() => setFileManager(false)} /></Suspense>}
    {pendingEncrypted && <Dialog title="打开密码保护文件" subtitle="密码仅用于本次解密，不会保存或上传。" onClose={() => { if (!busy) { setPendingEncrypted(''); setOpenPassword(''); } }}><label className="field-label">文件密码<input type="password" autoFocus aria-label="打开文件密码" value={openPassword} maxLength={1000} onChange={event => setOpenPassword(event.target.value)} /></label>{passwordError && <p role="alert" className="content-error">{passwordError}</p>}<div className="content-dialog-footer"><button className="secondary-button" disabled={busy} onClick={() => { setPendingEncrypted(''); setOpenPassword(''); }}>取消</button><button className="primary-button" disabled={busy} onClick={async () => { try { setBusy(true); const imported = await decryptWorkbook(pendingEncrypted, openPassword); setBusy(false); await activate(imported); setPendingEncrypted(''); setOpenPassword(''); } catch (error) { setBusy(false); setPasswordError((error as Error).message); } }}>解密并打开</button></div></Dialog>}
    {contentEdit && doc.nodes[contentEdit.id] && <Suspense fallback={<div className="initial-loader">正在打开内容编辑器…</div>}><ContentEditor doc={doc} node={doc.nodes[contentEdit.id]} initialTab={contentEdit.tab} onSave={apply} onClose={() => setContentEdit(null)} /></Suspense>}
    {presenting && <Presentation doc={doc} onClose={() => setPresenting(false)} />}
    {advanced && <Suspense fallback={<div className="initial-loader">正在打开样式面板…</div>}><AdvancedPanel doc={doc} selected={selected} onSave={apply} onClose={() => setAdvanced(false)} /></Suspense>}
    {taskList && <TaskList doc={doc} onClose={() => setTaskList(false)} onEdit={id => { setTaskList(false); locate(id); openContent('task', id); }} />}
    {presentationEditor && <PresentationEditor doc={doc} onSave={apply} onClose={() => setPresentationEditor(false)} />}
    {entityEdit && <Dialog title={entityEdit.kind === 'relation' ? '编辑联系' : '编辑概要 / 外框'} subtitle="文字与节点引用将随导图一起保存。" onClose={() => setEntityEdit(null)}><label className="field-label">显示文字<textarea aria-label="结构元素文字" autoFocus maxLength={1000} rows={3} value={entityEdit.text} onChange={event => setEntityEdit({ ...entityEdit, text: event.target.value })} /></label><div className="settings-grid"><label className="field-label">线条颜色<input aria-label="元素线条颜色" type="color" value={entityEdit.style?.color ?? '#8d9b7c'} onChange={event => setEntityEdit({ ...entityEdit, style: { ...entityEdit.style, color: event.target.value } })} /></label><label className="field-label">粗细<input aria-label="元素线条粗细" type="range" min="1" max="8" value={entityEdit.style?.width ?? 2} onChange={event => setEntityEdit({ ...entityEdit, style: { ...entityEdit.style, width: Number(event.target.value) } })} /></label><label className="check-field"><input aria-label="元素虚线" type="checkbox" checked={entityEdit.style?.dashed ?? (entityEdit.kind === 'relation' || doc.groups.find(group => group.id === entityEdit.id)?.kind === 'boundary')} onChange={event => setEntityEdit({ ...entityEdit, style: { ...entityEdit.style, dashed: event.target.checked } })} />虚线</label>{entityEdit.kind === 'group' ? <label className="field-label">填充颜色<input aria-label="元素填充颜色" type="color" value={entityEdit.style?.fill ?? '#f5f9ed'} onChange={event => setEntityEdit({ ...entityEdit, style: { ...entityEdit.style, fill: event.target.value } })} /></label> : <><label className="field-label">联系线型<select aria-label="联系线型" value={entityEdit.style?.curve ?? 'arc'} onChange={event => setEntityEdit({ ...entityEdit, style: { ...entityEdit.style, curve: event.target.value as 'arc' | 'straight' } })}><option value="arc">弧线</option><option value="straight">直线</option></select></label><label className="field-label">箭头<select aria-label="联系箭头" value={entityEdit.style?.arrow ?? 'end'} onChange={event => setEntityEdit({ ...entityEdit, style: { ...entityEdit.style, arrow: event.target.value as 'end' | 'both' | 'none' } })}><option value="end">单向</option><option value="both">双向</option><option value="none">无箭头</option></select></label><label className="field-label">弧度调整<input aria-label="联系弧度" type="range" min="-300" max="300" value={entityEdit.style?.bend ?? 0} onChange={event => setEntityEdit({ ...entityEdit, style: { ...entityEdit.style, bend: Number(event.target.value) } })} /></label>{(['from', 'to'] as const).map((key, i) => <label className="field-label" key={key}>{i ? '目标主题' : '来源主题'}<select aria-label={i ? '联系目标主题' : '联系来源主题'} value={entityEdit[key] ?? doc.relations.find(edge => edge.id === entityEdit.id)?.[key]} onChange={event => setEntityEdit({ ...entityEdit, [key]: event.target.value })}>{Object.values(doc.nodes).map(node => <option value={node.id} key={node.id}>{node.text || '空主题'}</option>)}</select></label>)}</>}</div><div className="content-dialog-footer"><button className="secondary-button danger" onClick={() => saveEntity(true)}><Trash2 size={14} />删除此元素</button><button className="secondary-button" onClick={() => setEntityEdit(null)}>取消</button><button className="primary-button" onClick={() => saveEntity()}>保存文字</button></div></Dialog>}

    {context && <><div className="context-dismiss" onClick={() => setContext(null)} /><div className="context-menu" role="menu" style={{ left: context.x, top: context.y }}>
      {context.id ? <><button role="menuitem" onClick={() => beginEdit(context.id)}><BookOpen size={15} />编辑文字<span>F2</span></button><button role="menuitem" onClick={() => { setContext(null); add(true); }}><Plus size={15} />添加细分主题<span>Tab</span></button><button role="menuitem" onClick={() => { setContext(null); add(false); }}><GitBranch size={15} />添加根级主题<span>Enter</span></button><hr /><button role="menuitem" disabled={context.id === doc.rootId} onClick={() => duplicate(context.id)}><Copy size={15} />复制分支</button><button role="menuitem" disabled={context.id === doc.rootId} onClick={() => remove(true, [context.id])}><Trash2 size={15} />仅删除此节点</button><button role="menuitem" className="danger" disabled={context.id === doc.rootId} onClick={() => remove(false, [context.id])}><Trash2 size={15} />删除整个分支<span>Delete</span></button><button role="menuitem" disabled={context.id === doc.rootId} onClick={() => { apply(detachBranch(finishEdit(), context.id)); setContext(null); }}>转换为自由主题</button></> : <button role="menuitem" onClick={() => newFree(worldAt(context.x, context.y))}>插入自由主题</button>}<hr />{editActions.map(action => <button key={action.label} role="menuitem" disabled={action.disabled} onClick={action.run}><action.icon size={14} />{action.label}</button>)}
    </div></>}
    {modal === 'templates' && <Suspense fallback={<div className="initial-loader">正在打开模板图库…</div>}><TemplatesDialog doc={doc} busy={busy} onUse={next => void activate(next)} onClose={() => setModal(null)} /></Suspense>}
    {modal === 'help' && <Dialog title="让思考更顺手" subtitle="几种简单操作，帮你专注在想法本身。" onClose={() => setModal(null)}><div className="shortcut-list">{[['双击主题 / F2', '编辑主题文字'], ['Enter / Shift + Enter', '编辑时提交 / 换行'], ['Escape', '取消本次文字编辑'], ['Tab（画布聚焦）', '添加细分主题'], ['Enter（画布聚焦）', '添加根级主题'], ['Shift + 点击', '选择多个主题'], ['Delete / Ctrl + Delete', '删除分支 / 仅删除节点'], ['Ctrl / ⌘ + Z', '撤销（文本输入框使用原生撤销）'], ['Ctrl / ⌘ + Y 或 Ctrl / ⌘ + Shift + Z', '重做'], ['Ctrl / ⌘ + S', '下载当前导图文件'], ['Ctrl / ⌘ + C / X / V', '复制 / 剪切 / 粘贴主题'], ['Ctrl / ⌘ + D', '复制当前分支'], ['Ctrl / ⌘ + A', '选择可见主题'], ['Ctrl / ⌘ + Alt + C / V / 0', '拷贝 / 粘贴 / 重设样式'], ['Ctrl / ⌘ + Alt + ↑ / ↓', '置于顶层 / 底层'], ['Ctrl / ⌘ + Shift + R', '建立联系'], ['Ctrl / ⌘ + Alt + N', '打开模板新建'], ['方向键 / 空格', '导航主题 / 折叠展开'], ['双击画布空白', '在该处新建自由主题'], ['拖动空白 / 滚轮', '平移画布'], ['Ctrl / ⌘ + 滚轮', '以指针为中心缩放']].map(([keys, text]) => <div key={keys}><span>{text}</span><kbd>{keys}</kbd></div>)}</div><div className="help-note"><CloudOff size={17} /><p>自动保存只属于当前浏览器，不会覆盖下载过的文件。清理浏览器数据前请先下载备份。当前支持 <strong>.mimicraft</strong> 文件，其他产品的原生格式暂不兼容。</p></div></Dialog>}
    {recoveryError && <Dialog title="暂时无法读取本地导图" onClose={() => {}}><p className="recovery-description">{recoveryError}</p><p className="recovery-description">为保护原数据，自动保存已暂停。你可以重试，或进入临时模式；临时模式的内容请下载文件保存。</p><div className="recovery-actions"><button className="secondary-button" onClick={() => { temporaryRef.current = true; setTemporary(true); readyRef.current = true; setReady(true); setSaveState('temporary'); setRecoveryError(''); }}>进入临时模式</button><button className="primary-button" onClick={() => void retrySave()}>重新读取</button></div></Dialog>}
    {message && <div className="toast" role="alert"><Check size={16} /><span>{message}</span><button aria-label="关闭消息" onClick={() => setMessage('')}><X size={14} /></button></div>}
    {!ready && !recoveryError && <div className="initial-loader"><LoaderCircle className="spin" size={24} /><span>正在打开你的思考空间…</span></div>}
    <style>{`.canvas-wrap { --canvas-bg: ${doc.background}; }`}</style>
  </div>;
}
