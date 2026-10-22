import { useEffect, useRef, useState } from 'react';
import { Check, File, ImagePlus, Mic, Paperclip, Square, SquareCheck, Trash2, Upload } from 'lucide-react';
import Formula from './Formula';
import Dialog from './Dialog';
import { MARKERS, type Marker, type TaskPlan } from './extended';
import { ILLUSTRATION_ICONS, ILLUSTRATION_LABELS } from './visuals';
import RichTextField from './RichTextField';
import { editNode, setContent, type Attachment, type MapDocument, type MapNode, type NodeContent } from './model';

export type ContentTab = 'note' | 'tags' | 'todo' | 'link' | 'equation' | 'sticker' | 'media' | 'callout' | 'markers' | 'task' | 'rich';
const tabs: { id: ContentTab; name: string }[] = [{ id: 'note', name: '笔记' }, { id: 'tags', name: '标签' }, { id: 'todo', name: '待办' }, { id: 'link', name: '链接' }, { id: 'equation', name: '方程' }, { id: 'sticker', name: '贴纸与插画' }, { id: 'media', name: '媒体与附件' }, { id: 'callout', name: '标注' }, { id: 'markers', name: '标记' }, { id: 'task', name: '计划任务' }, { id: 'rich', name: '富文本' }];
const stickers = ['💡', '✨', '🎯', '✅', '🚀', '🌿', '🔥', '📌', '💬', '❤️', '⭐', '🧩', '📚', '🌈', '🧭', '💪', '🌱', '🎨', '☕', '🎉', '📝', '🔍', '🛠️', '⏰', '💎', '🌻', '📊', '🏁', '🧠', '🌍'];
export default function ContentEditor({ doc, node, initialTab, onSave, onClose }: { doc: MapDocument; node: MapNode; initialTab: ContentTab; onSave: (doc: MapDocument) => void; onClose: () => void }) {
  const [tab, setTab] = useState(initialTab);
  const [draft, setDraft] = useState<NodeContent>(() => structuredClone(node.content ?? {}));
  const [tagsText, setTagsText] = useState(node.content?.tags?.join('，') ?? '');
  const [error, setError] = useState('');
  const [recording, setRecording] = useState(false);
  const [reading, setReading] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const live = useRef(true);
  const requesting = useRef(false);
  useEffect(() => {
    live.current = true;
    return () => { live.current = false; if (recorder.current?.state === 'recording') recorder.current.stop(); stream.current?.getTracks().forEach(track => track.stop()); };
  }, []);
  const addFile = async (file: globalThis.File, kind: Attachment['kind']) => {
    if (file.size > 2 * 1024 * 1024) { setError('每个资源最多 2 MB，请选择更小的文件。'); return; }
    if (kind === 'image' && !/^image\/(png|jpeg|gif|webp)$/.test(file.type)) { setError('图片支持 PNG、JPEG、GIF 和 WebP。'); return; }
    if (kind === 'audio' && !/^audio\/(webm|ogg|mpeg|mp4|wav|x-wav|aac|flac)(;|$)/.test(file.type)) { setError('暂不支持此音频类型，请使用 WebM、MP3、WAV、OGG 或 M4A。'); return; }
    setReading(true); setError('');
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(reader.result as string); reader.onerror = () => reject(new Error('读取文件失败'));
        reader.readAsDataURL(kind === 'file' ? new Blob([file], { type: 'application/octet-stream' }) : file);
      });
      if (!live.current) return;
      setDraft(previous => {
        if ((previous.attachments?.length ?? 0) >= 10) { setError('每个主题最多添加 10 个资源。'); return previous; }
        return { ...previous, attachments: [...(previous.attachments ?? []), { id: crypto.randomUUID(), name: file.name.slice(0, 200), kind, dataUrl: dataUrl.replace(/;codecs=[^;]+(?=;base64)/, '') }] };
      });
    } catch { if (live.current) setError('无法读取文件，请重试。'); }
    finally { if (live.current) setReading(false); }
  };
  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { setError('此浏览器不支持录音，可以上传已有音频。'); return; }
    if (requesting.current) return;
    requesting.current = true; setError('');
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!live.current) { media.getTracks().forEach(track => track.stop()); return; }
      stream.current = media;
      const recordingDevice = new MediaRecorder(media); recorder.current = recordingDevice;
      const chunks: Blob[] = []; let bytes = 0; let overflow = false;
      recordingDevice.ondataavailable = event => {
        bytes += event.data.size;
        if (bytes > 2 * 1024 * 1024) { overflow = true; if (recordingDevice.state === 'recording') recordingDevice.stop(); }
        else chunks.push(event.data);
      };
      recordingDevice.onerror = () => { media.getTracks().forEach(track => track.stop()); if (live.current) { setRecording(false); setError('录音失败，请使用音频上传。'); } };
      recordingDevice.onstop = () => {
        media.getTracks().forEach(track => track.stop());
        if (!live.current) return;
        setRecording(false);
        if (overflow) { setError('录音超过 2 MB，未添加；请缩短录音后重试。'); return; }
        const type = recordingDevice.mimeType.split(';')[0];
        const extension = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm';
        const file = new globalThis.File(chunks, `语音备注.${extension}`, { type }); void addFile(file, 'audio');
      };
      recordingDevice.start(1000); setRecording(true);
    } catch { stream.current?.getTracks().forEach(track => track.stop()); if (live.current) setError('无法使用麦克风，请检查权限或上传已有音频。'); }
    finally { requesting.current = false; }
  };
  const save = () => {
    const content: NodeContent = structuredClone(draft);
    const tags = [...new Set(tagsText.split(/[,，\n]/).map(tag => tag.trim()).filter(Boolean))];
    if (tags.length) content.tags = tags; else delete content.tags;
    if (!content.note) delete content.note;
    if (!content.equation) delete content.equation;
    if (!content.sticker) delete content.sticker;
    if (!content.callout) delete content.callout;
    if (!content.markers?.length) delete content.markers;
    if (content.task) {
      for (const key of Object.keys(content.task) as (keyof TaskPlan)[]) if (content.task[key] === '' || content.task[key] === undefined) delete content.task[key];
      if (!Object.keys(content.task).length) delete content.task;
      else {
        if (content.task.startDate && content.task.dueDate && content.task.startDate > content.task.dueDate) { setError('开始日期不能晚于截止日期。'); return; }
        if (content.task.progress === 100) content.todo = 'done';
        else if (!content.todo || content.todo === 'done') content.todo = 'open';
      }
    }
    if (!content.attachments?.length) delete content.attachments;
    if (!content.link?.value.trim()) delete content.link;
    else content.link.value = content.link.value.trim();
    if (content.link?.kind === 'web') {
      try { if (!['http:', 'https:'].includes(new URL(content.link.value).protocol)) throw new Error(); }
      catch { setError('请输入以 https:// 或 http:// 开头的有效网页地址。'); return; }
    }
    try { const base = content.richText ? editNode(doc, node.id, content.richText.map(run => run.text).join('')) : doc; const next = setContent(base, node.id, content); onSave(next); onClose(); }
    catch (issue) { setError(`无法保存内容：${(issue as Error).message}`); }
  };
  return <Dialog title="为想法添些细节" subtitle={`当前主题：${node.text || '空主题'} · 内容随导图一起保存在本地`} onClose={onClose} wide>
    <div className="content-tabs" role="tablist" aria-label="主题内容类型">{tabs.map(item => <button key={item.id} role="tab" aria-selected={tab === item.id} className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}>{item.name}</button>)}</div>
    <div className="content-pane" role="tabpanel">
      {tab === 'note' && <label className="field-label">笔记<textarea aria-label="主题笔记" maxLength={10000} rows={9} value={draft.note ?? ''} placeholder="补充解释、记录背景，或者先放下一个还没想清楚的念头…" onChange={event => setDraft({ ...draft, note: event.target.value })} /><small>纯文本笔记，不会执行 HTML。</small></label>}
      {tab === 'tags' && <><label className="field-label">标签<input aria-label="主题标签" value={tagsText} onChange={event => setTagsText(event.target.value)} placeholder="灵感，重要，待讨论" /><small>使用中文或英文逗号分隔，最多 30 个标签，保存时自动去重。</small></label><div className="tag-preview">{[...new Set(tagsText.split(/[,，]/).map(tag => tag.trim()).filter(Boolean))].map(tag => <span key={tag}># {tag}</span>)}</div></>}
      {tab === 'todo' && <div className="todo-options"><button className={!draft.todo ? 'chosen' : ''} onClick={() => { const next = { ...draft }; delete next.todo; delete next.task; setDraft(next); }}><Square size={23} /><strong>普通主题</strong><span>移除待办及计划信息</span></button><button className={draft.todo === 'open' ? 'chosen' : ''} onClick={() => setDraft({ ...draft, todo: 'open', ...(draft.task ? { task: { ...draft.task, progress: 0 } } : {}) })}><Square size={23} /><strong>待完成</strong><span>下一步，就从这里开始</span></button><button className={draft.todo === 'done' ? 'chosen' : ''} onClick={() => setDraft({ ...draft, todo: 'done', ...(draft.task ? { task: { ...draft.task, progress: 100 } } : {}) })}><SquareCheck size={23} /><strong>已完成</strong><span>记下每一次小小的进展</span></button></div>}
      {tab === 'link' && <><label className="field-label">链接类型<select aria-label="链接类型" value={draft.link?.kind ?? 'web'} onChange={event => setDraft({ ...draft, link: { kind: event.target.value as 'web' | 'path' | 'topic', value: '' } })}><option value="web">网页链接</option><option value="path">本地文件 / 文件夹路径</option><option value="topic">此导图中的主题</option></select></label>{draft.link?.kind === 'topic' ? <label className="field-label">目标主题<select aria-label="目标主题" value={draft.link.value} onChange={event => setDraft({ ...draft, link: { kind: 'topic', value: event.target.value } })}><option value="">选择主题</option>{Object.values(doc.nodes).map(item => <option key={item.id} value={item.id}>{item.text || '空主题'}</option>)}</select></label> : <label className="field-label">{draft.link?.kind === 'path' ? '本地路径' : '网页地址'}<input aria-label="链接地址" maxLength={2000} value={draft.link?.value ?? ''} placeholder={draft.link?.kind === 'path' ? 'D:\\文档\\项目计划' : 'https://example.com'} onChange={event => setDraft({ ...draft, link: { kind: draft.link?.kind ?? 'web', value: event.target.value } })} /><small>{draft.link?.kind === 'path' ? '浏览器不会直接打开任意磁盘路径；保存后可以复制路径。需要随文件携带内容时，请添加附件。' : '仅支持 http:// 与 https://。清空地址即可移除链接。'}</small></label>}</>}
      {tab === 'equation' && <><label className="field-label">LaTeX 源码<textarea aria-label="方程源码" maxLength={2000} rows={4} value={draft.equation ?? ''} placeholder="E = mc^2" onChange={event => setDraft({ ...draft, equation: event.target.value })} /></label><div className="equation-area">{draft.equation ? <Formula source={draft.equation} /> : <span>在上方输入公式，这里会显示预览。</span>}</div></>}
      {tab === 'sticker' && <><label className="field-label">贴纸<small>使用系统 emoji，在不同设备上的外观可能略有差异。</small></label><div className="sticker-grid">{stickers.map(sticker => <button aria-label={`贴纸 ${sticker}`} className={draft.sticker === sticker ? 'chosen' : ''} key={sticker} onClick={() => setDraft({ ...draft, sticker: draft.sticker === sticker ? '' : sticker })}>{sticker}</button>)}</div><label className="field-label">图标插画</label><div className="illustration-options">{Object.entries(ILLUSTRATION_ICONS).map(([id, Icon]) => <button className={draft.illustration === id ? 'chosen' : ''} key={id} onClick={() => { const next = { ...draft }; if (next.illustration === id) delete next.illustration; else next.illustration = id as NonNullable<NodeContent['illustration']>; setDraft(next); }}><Icon size={35} strokeWidth={1.2} /><span>{ILLUSTRATION_LABELS[id as keyof typeof ILLUSTRATION_LABELS]}</span></button>)}</div></>}
      {tab === 'rich' && <RichTextField text={node.text} runs={draft.richText} onChange={runs => setDraft(previous => ({ ...previous, richText: runs }))} />}
      {tab === 'callout' && <label className="field-label">标注文字<textarea aria-label="主题标注" maxLength={1000} rows={5} value={draft.callout ?? ''} onChange={event => setDraft({ ...draft, callout: event.target.value })} placeholder="显示在主题旁的简短提示…" /><small>标注与主题文字、笔记分别保存；清空即可移除。</small></label>}
      {tab === 'markers' && <><p className="media-hint">优先级、状态和符号可组合使用，也可按标记筛选。</p><div className="marker-grid">{Object.entries(MARKERS).map(([id, symbol]) => <button aria-label={`标记 ${id}`} className={draft.markers?.includes(id as Marker) ? 'chosen' : ''} key={id} onClick={() => setDraft({ ...draft, markers: draft.markers?.includes(id as Marker) ? draft.markers.filter(value => value !== id) : [...(draft.markers ?? []), id as Marker] })}>{symbol}</button>)}</div><button className="secondary-button" onClick={() => { const next = { ...draft }; delete next.markers; setDraft(next); }}>清除标记</button></>}
      {tab === 'task' && <><div className="settings-grid"><label className="field-label">开始日期<input aria-label="任务开始日期" type="date" value={draft.task?.startDate ?? ''} onChange={event => setDraft({ ...draft, task: { ...draft.task, startDate: event.target.value } })} /></label><label className="field-label">截止日期<input aria-label="任务截止日期" type="date" value={draft.task?.dueDate ?? ''} onChange={event => setDraft({ ...draft, task: { ...draft.task, dueDate: event.target.value } })} /></label><label className="field-label">负责人<input aria-label="任务负责人" maxLength={100} value={draft.task?.assignee ?? ''} onChange={event => setDraft({ ...draft, task: { ...draft.task, assignee: event.target.value } })} /></label><label className="field-label">优先级<select aria-label="任务优先级" value={draft.task?.priority ?? 0} onChange={event => setDraft({ ...draft, task: { ...draft.task, priority: Number(event.target.value) } })}><option value="0">普通</option><option value="1">低</option><option value="2">中</option><option value="3">高</option></select></label><label className="field-label">进度 {draft.task?.progress ?? 0}%<input aria-label="任务进度" type="range" min="0" max="100" step="10" value={draft.task?.progress ?? 0} onChange={event => setDraft({ ...draft, task: { ...draft.task, progress: Number(event.target.value) } })} /></label><label className="field-label">提醒时间<input aria-label="任务提醒时间" type="datetime-local" value={draft.task?.reminderAt ? new Date(new Date(draft.task.reminderAt).getTime() - new Date(draft.task.reminderAt).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''} onChange={event => { const value = event.target.value; setDraft({ ...draft, task: { ...draft.task, reminderAt: value && Number.isFinite(new Date(value).getTime()) ? new Date(value).toISOString() : '' } }); }} /></label></div><p className="media-hint">网页打开时检查到期提醒；关闭网页不会后台提醒。进度达到 100% 自动标为完成。</p><button className="secondary-button" onClick={() => { const next = { ...draft }; delete next.task; setDraft(next); }}>移除计划信息</button></>}
      {tab === 'media' && <><div className="media-upload-buttons"><label><ImagePlus size={17} />添加图片<input aria-label="添加图片文件" hidden type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={event => { if (event.target.files?.[0]) void addFile(event.target.files[0], 'image'); event.target.value = ''; }} /></label><label><Paperclip size={17} />添加附件<input aria-label="添加附件文件" hidden type="file" onChange={event => { if (event.target.files?.[0]) void addFile(event.target.files[0], 'file'); event.target.value = ''; }} /></label><label><Upload size={17} />上传音频<input aria-label="添加音频文件" hidden type="file" accept="audio/*" onChange={event => { if (event.target.files?.[0]) void addFile(event.target.files[0], 'audio'); event.target.value = ''; }} /></label><button className={recording ? 'recording' : ''} onClick={() => { if (recording) recorder.current?.stop(); else void startRecording(); }}><Mic size={17} />{recording ? '停止录音' : '开始录音'}</button></div><p className="media-hint">每个资源最多 2 MB，每主题最多 10 个。资源随文件打包，原文件不会上传到服务器。</p><div className="attachment-list">{draft.attachments?.map(asset => <div className="attachment-row" key={asset.id}>{asset.kind === 'image' ? <img src={asset.dataUrl} alt={asset.name} /> : <File size={22} />}<div><strong>{asset.name}</strong>{asset.kind === 'audio' ? <audio controls src={asset.dataUrl} /> : <a href={asset.dataUrl} download={asset.name}>下载此资源</a>}</div><button aria-label={`移除资源 ${asset.name}`} onClick={() => setDraft({ ...draft, attachments: draft.attachments?.filter(item => item.id !== asset.id) })}><Trash2 size={15} /></button></div>)}{!draft.attachments?.length && <div className="empty-assets">图片、文件和语音，让想法更完整。</div>}</div></>}
    </div>
    {error && <p className="content-error" role="alert">{error}</p>}
    <div className="content-dialog-footer"><button className="secondary-button" onClick={onClose}>取消</button><button className="primary-button" onClick={save} disabled={recording || reading}><Check size={15} />{reading ? '正在读取…' : '保存内容'}</button></div>
  </Dialog>;
}
