import katex from 'katex';
import 'katex/dist/katex.min.css';

export default function Formula({ source }: { source: string }) {
  try { return <div className="formula-preview" dangerouslySetInnerHTML={{ __html: katex.renderToString(source, { throwOnError: true, trust: false, displayMode: true, maxExpand: 300, maxSize: 5, strict: 'error' }) }} />; }
  catch { return <div className="formula-error">公式语法暂不支持，请检查 LaTeX 源码。</div>; }
}
