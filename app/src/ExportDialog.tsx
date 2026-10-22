import { useMemo, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import Dialog from './Dialog';
import type { MapDocument } from './model';
import { diagramSvg, downloadBlob, exportTargets, safeName, utf8, xml, type ExportFormat, type ExportOptions } from './export-core';
import { assetBytes, outputFiles, zipFiles } from './export-files';

export function printHtml(doc: MapDocument, options: ExportOptions): string {
  const pages = exportTargets(doc, options).map(target => `<section><h1>${xml(doc.title)} · ${xml(target.name)}</h1><img alt="${xml(target.name)}" src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(diagramSvg(target.doc).text)}"/></section>`).join('');
  return `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><title>${xml(doc.title)} · 打印</title><style>@page{size:${options.paper} ${options.landscape ? 'landscape' : 'portrait'};margin:12mm}*{box-sizing:border-box}body{margin:0;font-family:Arial,"Microsoft YaHei",sans-serif;color:#35443e;background:#eee}section{background:white;padding:10mm;margin:8mm auto;width:${options.landscape ? '260' : '185'}mm;height:${options.landscape ? '175' : '260'}mm;display:flex;flex-direction:column;break-after:page;page-break-after:always}section:last-child{break-after:auto;page-break-after:auto}h1{font-size:14pt;font-weight:500;margin:0 0 5mm}img{width:100%;height:0;flex:1;min-height:0;object-fit:contain}@media print{body{background:white}section{width:100%;height:${options.landscape ? '170' : '250'}mm;margin:0;padding:0}}</style></head><body>${pages}</body></html>`;
}
export default function ExportDialog({ doc, selectedId, onClose }: { doc: MapDocument; selectedId: string; onClose: () => void }) {
  const [format, setFormat] = useState<ExportFormat>('png'); const [options, setOptions] = useState<ExportOptions>({ scope: 'current', selectedId, scale: 1, folded: false, paper: 'a4', landscape: true });
  const [error, setError] = useState(''); const [working, setWorking] = useState(false); const [complete, setComplete] = useState(''); const [printPreview, setPrintPreview] = useState('');
  const targets = useMemo(() => { try { return exportTargets(doc, options); } catch { return []; } }, [doc, options]);
  const run = async () => {
    setWorking(true); setError(''); setComplete('');
    try {
      const files = await outputFiles(format, exportTargets(doc, options), options); const fileName = safeName(doc.title);
      if (files.length === 1) downloadBlob(new Blob([new Uint8Array(files[0].data).buffer], { type: files[0].mime }), `${fileName}.${files[0].name.split('.').at(-1)}`);
      else {
        files.push({ name: 'manifest.json', mime: 'application/json', data: utf8(JSON.stringify({ generator: 'Mimicraft', format, scope: options.scope, scale: options.scale, files: files.map(file => ({ path: file.name, mime: file.mime })), mapping: '图形以独立 SVG 渲染，公式为 LaTeX 源文；结构化文档的部分样式/关系由附带原始文件保留。' }, null, 2)) });
        downloadBlob(new Blob([zipFiles(files)], { type: 'application/zip' }), `${fileName}-${format}.${format === 'textbundle' && targets.length === 1 ? 'textpack' : 'zip'}`);
      }
      setComplete('已生成下载，请在浏览器下载列表中确认。');
    } catch (issue) { setError(`导出失败：${(issue as Error).message}`); } finally { setWorking(false); }
  };
  return <Dialog title="导出与打印" subtitle="所有格式免费，在此浏览器生成，不上传导图。" onClose={() => { if (!working) onClose(); }} wide>
    <div className="settings-grid"><label className="field-label">导出格式<select aria-label="导出格式" value={format} disabled={working} onChange={event => setFormat(event.target.value as ExportFormat)}>{[['png', 'PNG 图片'], ['jpeg', 'JPEG 图片'], ['svg', 'SVG 矢量图'], ['pdf', 'PDF 文档'], ['markdown', 'Markdown'], ['opml', 'OPML'], ['textbundle', 'TextBundle / TextPack'], ['docx', 'Word (.docx)'], ['xlsx', 'Excel (.xlsx)'], ['pptx', 'PowerPoint 演说 (.pptx)']].map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
    <label className="field-label">输出范围<select aria-label="导出范围" value={options.scope} disabled={working} onChange={event => setOptions({ ...options, scope: event.target.value as ExportOptions['scope'] })}><option value="current">当前画布</option><option value="all">全部画布</option><option value="selected">选中主题及其分支</option><option value="branches">按主分支分别输出</option></select></label>
    <label className="field-label">图片清晰度<select aria-label="导出倍数" value={options.scale} disabled={working} onChange={event => setOptions({ ...options, scale: Number(event.target.value) })}><option value="1">1 倍</option><option value="2">2 倍</option><option value="3">3 倍</option></select></label><label className="check-field"><input type="checkbox" aria-label="保留折叠状态" checked={options.folded} onChange={event => setOptions({ ...options, folded: event.target.checked })} />按当前折叠状态导出</label>
    <label className="field-label">PDF / 打印纸张<select aria-label="导出纸张" value={options.paper} onChange={event => setOptions({ ...options, paper: event.target.value as ExportOptions['paper'] })}><option value="a4">A4</option><option value="letter">Letter</option></select></label><label className="check-field"><input type="checkbox" aria-label="横向打印" checked={options.landscape} onChange={event => setOptions({ ...options, landscape: event.target.checked })} />横向页面</label></div>
    <div className="export-mapping"><strong>{targets.length} 个输出范围</strong><p>SVG / 图片保留树、文字、节点样式、图片、联系与分组。公式以 LaTeX 源码显示；笔记、附件、语音等完整数据不属于图像内容。PDF 是图像分页文档。</p><p>Markdown / OPML / Word / Excel / PowerPoint 为内容转换；可编辑结构与原有布局不完全相同。输出包附完整 .mimicraft 与资源。多文件统一打包下载，TextBundle 单画布为 .textpack。</p><p>导出默认展开折叠主题，不受查找筛选和屏幕缩放影响。倍数仅作用于图片及 PDF 图像；不加水印。</p></div>
    {!!doc.nodes[selectedId]?.content?.attachments?.some(asset => asset.kind === 'image') && <div className="export-image-list"><span>选中主题原图：</span>{doc.nodes[selectedId].content!.attachments!.filter(asset => asset.kind === 'image').map(asset => <button className="secondary-button" key={asset.id} onClick={() => { const ext = asset.dataUrl.slice(11, asset.dataUrl.indexOf(';')); downloadBlob(new Blob([new Uint8Array(assetBytes(asset.dataUrl)).buffer], { type: `image/${ext}` }), `${safeName(asset.name).replace(/\.[^.]+$/, '')}.${ext === 'jpeg' ? 'jpg' : ext}`); }}>另存图片 {asset.name}</button>)}</div>}
    {error && <p role="alert" className="content-error">{error}</p>}{complete && <p role="status" className="export-success">{complete}</p>}
    <div className="content-dialog-footer"><button className="secondary-button" disabled={working} onClick={() => { try { setPrintPreview(printHtml(doc, options)); setError(''); } catch (issue) { setError((issue as Error).message); } }}><Printer size={14} />打印预览</button><button className="primary-button" disabled={working} onClick={run}><Download size={14} />{working ? '正在生成…' : '生成并下载'}</button></div>
    {printPreview && <div className="print-preview-layer" role="dialog" aria-modal="true" aria-label="打印预览"><div className="print-preview-bar"><span>打印预览 · 每个范围单独一页</span><button className="secondary-button" onClick={() => setPrintPreview('')}>返回导出设置</button><button className="primary-button" onClick={async () => { const frame = document.getElementById('mimicraft-print') as HTMLIFrameElement; try { await Promise.all([...frame.contentDocument!.images].map(image => image.decode())); frame.contentWindow!.focus(); frame.contentWindow!.print(); } catch { setError('打印预览加载失败，请使用 PDF 下载。'); } }}>打开打印对话框</button></div><iframe id="mimicraft-print" title="独立打印页面" srcDoc={printPreview} /></div>}
  </Dialog>;
}
