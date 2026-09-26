import { defineStore } from 'pinia'
import { db } from './db'

export const blobToDataURL = (blob) =>
  new Promise((resolve, reject) => {
    if (!blob) return resolve(null)
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })

export const dataURLToBlob = (dataURL) => {
  if (!dataURL) return null
  const [meta, base64] = dataURL.split(',')
  const mime = (meta.match(/data:(.*?);/) || [])[1] || 'image/png'
  const bin = atob(base64)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return new Blob([arr], { type: mime })
}

const now = () => Date.now()

export const useStore = defineStore('main', {
  state: () => ({
    books: []
  }),

  actions: {
    // ---------- 书 ----------
    async loadBooks() {
      this.books = await db.books.orderBy('updatedAt').reverse().toArray()
    },

    async createBook({ title, intro = '', cover = null }) {
      const id = await db.books.add({ title, intro, cover, status: '连载中', createdAt: now(), updatedAt: now() })
      const vid = await db.volumes.add({ bookId: id, name: '第一卷', order: 0 })
      await db.chapters.add({ bookId: id, volumeId: vid, title: '第一章', content: '', order: 0, createdAt: now(), updatedAt: now() })
      await this.loadBooks()
      return id
    },

    async updateBook(id, patch) {
      await db.books.update(id, { ...patch, updatedAt: now() })
      await this.loadBooks()
    },

    async deleteBook(id) {
      await db.transaction('rw', [db.books, db.volumes, db.chapters, db.characters, db.worldEntries], async () => {
        await db.books.delete(id)
        await db.volumes.where('bookId').equals(id).delete()
        await db.chapters.where('bookId').equals(id).delete()
        await db.characters.where('bookId').equals(id).delete()
        await db.worldEntries.where('bookId').equals(id).delete()
      })
      await this.loadBooks()
    },

    // ---------- 卷 ----------
    async addVolume(bookId, name) {
      const count = await db.volumes.where('bookId').equals(bookId).count()
      return await db.volumes.add({ bookId, name: name || `第${count + 1}卷`, order: count })
    },

    async renameVolume(id, name) {
      await db.volumes.update(id, { name })
    },

    async deleteVolume(id) {
      await db.transaction('rw', [db.volumes, db.chapters], async () => {
        await db.volumes.delete(id)
        await db.chapters.where('volumeId').equals(id).delete()
      })
    },

    // ---------- 章 ----------
    async addChapter(bookId, volumeId, title) {
      const count = await db.chapters.where('volumeId').equals(volumeId).count()
      return await db.chapters.add({
        bookId, volumeId,
        title: title || `第${count + 1}章`,
        content: '', order: count, createdAt: now(), updatedAt: now()
      })
    },

    async renameChapter(id, title) {
      await db.chapters.update(id, { title, updatedAt: now() })
    },

    async saveChapterContent(id, content) {
      await db.chapters.update(id, { content, updatedAt: now() })
    },

    async deleteChapter(id) {
      await db.chapters.delete(id)
    },

    /** 拖拽后按树的现状持久化 order 和归属 */
    async persistTree(nodes) {
      const updates = []
      nodes.forEach((vNode, vi) => {
        if (vNode.data.type === 'volume') {
          updates.push(db.volumes.update(vNode.data.rawId, { order: vi }))
          ;(vNode.childNodes || []).forEach((cNode, ci) => {
            if (cNode.data.type === 'chapter') {
              updates.push(db.chapters.update(cNode.data.rawId, { order: ci, volumeId: vNode.data.rawId }))
            }
          })
        }
      })
      await Promise.all(updates)
    },

    // ---------- 人物 ----------
    async addCharacter(bookId) {
      return await db.characters.add({
        bookId, name: '未命名角色', aliases: '', gender: '', age: '', identity: '', faction: '',
        appearance: '', personality: '', background: '', hobbies: '', quotes: '', relations: '', notes: '',
        avatar: null, gallery: [], createdAt: now(), updatedAt: now()
      })
    },

    async updateCharacter(id, patch) {
      await db.characters.update(id, { ...patch, updatedAt: now() })
    },

    async deleteCharacter(id) {
      await db.characters.delete(id)
    },

    // ---------- 世界观 ----------
    async addWorldEntry(bookId, type) {
      const defaults = {
        event: { name: '未命名事件', year: '' },
        power: { name: '未命名境界', level: 0 },
        geo: { name: '未命名地域', region: '' },
        treasure: { name: '未命名珍宝', rank: '' }
      }
      return await db.worldEntries.add({
        bookId, type, summary: '', detail: '',
        ...(defaults[type] || { name: '未命名条目' }),
        createdAt: now(), updatedAt: now()
      })
    },

    async updateWorldEntry(id, patch) {
      await db.worldEntries.update(id, { ...patch, updatedAt: now() })
    },

    async deleteWorldEntry(id) {
      await db.worldEntries.delete(id)
    }
  }
})

// ---------- 导出 / 导入 ----------

export async function exportBook(bookId) {
  const book = await db.books.get(bookId)
  if (!book) return null
  const [volumes, chapters, characters, worldEntries] = await Promise.all([
    db.volumes.where('bookId').equals(bookId).sortBy('order'),
    db.chapters.where('bookId').equals(bookId).toArray(),
    db.characters.where('bookId').equals(bookId).toArray(),
    db.worldEntries.where('bookId').equals(bookId).toArray()
  ])
  const data = {
    app: 'ink-atelier',
    version: 1,
    exportedAt: new Date().toISOString(),
    book: { ...book, cover: await blobToDataURL(book.cover) },
    volumes,
    chapters,
    characters: await Promise.all(characters.map(async c => ({
      ...c,
      avatar: await blobToDataURL(c.avatar),
      gallery: await Promise.all((c.gallery || []).map(blobToDataURL))
    }))),
    worldEntries
  }
  return data
}

export async function exportAll() {
  const books = await db.books.toArray()
  const items = []
  for (const b of books) items.push(await exportBook(b.id))
  return { app: 'ink-atelier', version: 1, exportedAt: new Date().toISOString(), items }
}

export async function importData(payload) {
  const items = payload.items ? payload.items : [payload]
  const imported = []
  for (const item of items) {
    if (!item.book || !Array.isArray(item.volumes)) continue
    const vidMap = {}
    await db.transaction('rw', [db.books, db.volumes, db.chapters, db.characters, db.worldEntries], async () => {
      const { id: _bid, cover, ...bookRest } = item.book
      const bookId = await db.books.add({ ...bookRest, cover: dataURLToBlob(cover), updatedAt: now() })
      imported.push(bookId)
      for (const v of item.volumes) {
        const { id: oldVid, bookId: _b, ...vRest } = v
        vidMap[oldVid] = await db.volumes.add({ ...vRest, bookId })
      }
      for (const c of item.chapters || []) {
        const { id: _c, bookId: _b, volumeId: oldVid, ...cRest } = c
        if (vidMap[oldVid] == null) continue
        await db.chapters.add({ ...cRest, bookId, volumeId: vidMap[oldVid] })
      }
      for (const ch of item.characters || []) {
        const { id: _ch, bookId: _b, avatar, gallery, ...chRest } = ch
        await db.characters.add({
          ...chRest, bookId,
          avatar: dataURLToBlob(avatar),
          gallery: (gallery || []).map(dataURLToBlob).filter(Boolean)
        })
      }
      for (const w of item.worldEntries || []) {
        const { id: _w, bookId: _b, ...wRest } = w
        await db.worldEntries.add({ ...wRest, bookId })
      }
    })
  }
  return imported
}

export function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
