import { parseDocument, type MapDocument } from './model';

const DB_NAME = 'mimicraft-local-v1';
let connection: Promise<IDBDatabase> | undefined;
let queue: Promise<unknown> = Promise.resolve();
function database(): Promise<IDBDatabase> {
  if (connection) return connection;
  connection = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      db.createObjectStore('documents', { keyPath: 'id' });
      db.createObjectStore('meta');
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => { db.close(); connection = undefined; };
      resolve(db);
    };
    request.onerror = () => { connection = undefined; reject(request.error ?? new Error('无法打开浏览器存储')); };
    request.onblocked = () => { connection = undefined; reject(new Error('本地存储升级被其他页面阻塞，请关闭其他 Mimicraft 页面后重试')); };
  }).catch(error => { connection = undefined; throw error; });
  return connection;
}
export async function loadWorkspace(): Promise<{ active: MapDocument | null; documents: MapDocument[] }> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['documents', 'meta'], 'readonly');
    const docs = tx.objectStore('documents').getAll();
    const active = tx.objectStore('meta').get('activeId');
    tx.oncomplete = () => {
      try {
        const documents: MapDocument[] = docs.result.map(value => parseDocument(JSON.stringify({ format: 'mimicraft-map', schemaVersion: value && 'relations' in value ? 4 : 1, document: value }), false));
        documents.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        resolve({ active: documents.find(doc => doc.id === active.result) ?? documents[0] ?? null, documents });
      } catch { reject(new Error('本地导图数据无法读取。已停止自动保存以保护原数据，请先下载备份或重试。')); }
    };
    tx.onerror = () => reject(tx.error ?? new Error('读取本地导图失败'));
    tx.onabort = () => reject(tx.error ?? new Error('读取已中断'));
  });
}
export async function loadTrash(): Promise<MapDocument[]> {
  const db = await database(); return new Promise((resolve, reject) => { const tx = db.transaction('meta', 'readonly'); const get = tx.objectStore('meta').get('trash'); tx.oncomplete = () => { try { resolve((get.result ?? []).map((document: MapDocument) => parseDocument(JSON.stringify({ format: 'mimicraft-map', schemaVersion: 4, document }), false))); } catch { reject(new Error('回收站数据无效，原数据未修改')); } }; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error); });
}
export async function moveTrash(doc: MapDocument, restore = false): Promise<void> {
  await queue.catch(() => {}); const db = await database(); return new Promise((resolve, reject) => {
    const tx = db.transaction(['documents', 'meta'], 'readwrite'); const meta = tx.objectStore('meta'); const get = meta.get('trash');
    get.onsuccess = () => { const entries = (get.result ?? []) as MapDocument[]; if (!Array.isArray(entries)) { tx.abort(); return; } meta.put(restore ? entries.filter(item => item.id !== doc.id) : [structuredClone(doc), ...entries.filter(item => item.id !== doc.id)], 'trash'); if (restore) tx.objectStore('documents').put(structuredClone(doc)); else tx.objectStore('documents').delete(doc.id); };
    tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error ?? new Error('回收站操作失败')); tx.onabort = () => reject(tx.error ?? new Error('回收站操作已取消'));
  });
}
export function saveDocument(doc: MapDocument): Promise<void> {
  const snapshot = structuredClone(doc);
  const task = queue.catch(() => {}).then(async () => {
    const db = await database();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['documents', 'meta'], 'readwrite');
      tx.objectStore('documents').put(snapshot);
      tx.objectStore('meta').put(snapshot.id, 'activeId');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('自动保存失败'));
      tx.onabort = () => reject(tx.error ?? new Error('自动保存被中断'));
    });
  });
  queue = task;
  return task;
}
export interface SavedTemplate { id: string; name: string; document: MapDocument }
export async function loadTemplates(): Promise<SavedTemplate[]> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('meta', 'readonly'); const request = tx.objectStore('meta').get('templates');
    tx.oncomplete = () => { try { const entries = (request.result ?? []) as SavedTemplate[]; if (!Array.isArray(entries)) throw new Error(); resolve(entries.map(item => ({ id: item.id, name: item.name, document: parseDocument(JSON.stringify({ format: 'mimicraft-map', schemaVersion: 3, document: item.document }), false) }))); } catch { reject(new Error('本地模板无法读取，原数据未修改')); } };
    tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
  });
}
export async function updateTemplates(update: (entries: SavedTemplate[]) => SavedTemplate[]): Promise<SavedTemplate[]> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('meta', 'readwrite'); const store = tx.objectStore('meta'); const get = store.get('templates'); let result: SavedTemplate[];
    get.onsuccess = () => { try { result = update(get.result ?? []); store.put(result, 'templates'); } catch { tx.abort(); } };
    tx.oncomplete = () => resolve(result); tx.onerror = () => reject(tx.error ?? new Error('保存模板失败')); tx.onabort = () => reject(tx.error ?? new Error('保存模板失败'));
  });
}
