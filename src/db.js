import Dexie from 'dexie'

export const db = new Dexie('inkAtelier')

db.version(1).stores({
  books: '++id, updatedAt',
  volumes: '++id, bookId, order',
  chapters: '++id, bookId, volumeId, order, updatedAt',
  characters: '++id, bookId',
  worldEntries: '++id, bookId, type'
})
