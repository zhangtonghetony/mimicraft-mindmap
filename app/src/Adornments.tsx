import type { MapDocument, PlacedNode } from './model';
import type { EdgeStyle, GroupStyle } from './extended';

export type EntityEdit = { id: string; kind: 'relation' | 'group'; text: string; style?: EdgeStyle & GroupStyle; from?: string; to?: string };
export default function Adornments({ doc, points, onEdit }: { doc: MapDocument; points: PlacedNode[]; onEdit: (entity: EntityEdit) => void }) {
  const byId = new Map(points.map(point => [point.id, point]));
  return <>
    {doc.groups.map(group => {
      const members = group.nodeIds.map(id => byId.get(id)).filter((point): point is PlacedNode => !!point);
      if (!members.length) return null;
      const left = Math.min(...members.map(point => point.x - point.width / 2)) - 15;
      const right = Math.max(...members.map(point => point.x + point.width / 2)) + 15;
      const top = Math.min(...members.map(point => point.y - point.height / 2)) - 15;
      const bottom = Math.max(...members.map(point => point.y + point.height / 2)) + 15;
      const edit = () => onEdit({ id: group.id, kind: 'group', text: group.text, style: group.style });
      return group.kind === 'boundary' ? <div className="group-boundary" data-group-id={group.id} key={group.id} style={{ left, top, width: right - left, height: bottom - top, borderColor: group.style?.color, background: group.style?.fill, borderWidth: group.style?.width, borderStyle: group.style?.dashed === false ? 'solid' : 'dashed' }}><button aria-label={`编辑外框：${group.text}`} onClick={edit} onDoubleClick={edit}>{group.text || '外框'}</button></div>
        : <div className="group-summary" data-group-id={group.id} key={group.id} style={{ left: right + 8, top, height: bottom - top }}><svg width="22" height={bottom - top} aria-hidden="true"><path d={`M 1 0 Q 14 0 14 12 L 14 ${(bottom - top) / 2 - 10} Q 14 ${(bottom - top) / 2} 22 ${(bottom - top) / 2} Q 14 ${(bottom - top) / 2} 14 ${(bottom - top) / 2 + 10} L 14 ${bottom - top - 12} Q 14 ${bottom - top} 1 ${bottom - top}`} fill="none" stroke={group.style?.color ?? '#8d9b7c'} strokeWidth={group.style?.width ?? 1.5} strokeDasharray={group.style?.dashed ? '6 4' : undefined} /></svg><button aria-label={`编辑概要：${group.text}`} style={{ background: group.style?.fill, borderColor: group.style?.color }} onClick={edit} onDoubleClick={edit}>{group.text || '概要'}</button></div>;
    })}
    <svg className="connections relation-lines" width="1" height="1" aria-hidden="true"><defs>{doc.relations.map(edge => <marker key={edge.id} id={`relation-arrow-${edge.id}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill={edge.style?.color ?? '#a392b9'} /></marker>)}</defs>
      {doc.relations.map(edge => {
        const source = byId.get(edge.from); const target = byId.get(edge.to); if (!source || !target) return null;
        const cx = (source.x + target.x) / 2; const cy = Math.min(source.y - source.height / 2, target.y - target.height / 2) - 85 + (edge.style?.bend ?? 0);
        const d = edge.style?.curve === 'straight' ? `M ${source.x} ${source.y - source.height / 2} L ${target.x} ${target.y - target.height / 2 - 5}` : `M ${source.x} ${source.y - source.height / 2} Q ${cx} ${cy} ${target.x} ${target.y - target.height / 2 - 5}`;
        return <path key={edge.id} className="relation-curve" data-relation-id={edge.id} d={d} stroke={edge.style?.color ?? '#a392b9'} strokeWidth={edge.style?.width ?? 1.7} strokeDasharray={edge.style?.dashed === false ? undefined : '6 4'} fill="none" markerEnd={edge.style?.arrow === 'none' ? undefined : `url(#relation-arrow-${edge.id})`} markerStart={edge.style?.arrow === 'both' ? `url(#relation-arrow-${edge.id})` : undefined} onDoubleClick={event => { event.stopPropagation(); onEdit({ id: edge.id, kind: 'relation', text: edge.text, style: edge.style, from: edge.from, to: edge.to }); }} />;
      })}
    </svg>
    {doc.relations.map(edge => {
      const source = byId.get(edge.from); const target = byId.get(edge.to); if (!source || !target) return null;
      const startY = source.y - source.height / 2; const endY = target.y - target.height / 2 - 5;
      const controlY = Math.min(startY, endY + 5) - 85 + (edge.style?.bend ?? 0);
      const x = (source.x + target.x) / 2; const y = edge.style?.curve === 'straight' ? (startY + endY) / 2 : startY / 4 + controlY / 2 + endY / 4;
      return <button className="relation-label" key={edge.id} aria-label={`编辑联系：${edge.text}`} style={{ left: x, top: y, color: edge.style?.color }} onClick={() => onEdit({ id: edge.id, kind: 'relation', text: edge.text, style: edge.style, from: edge.from, to: edge.to })}>{edge.text || '联系'}</button>;
    })}
  </>;
}
