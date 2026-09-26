<template>
  <div class="page-full">
    <header class="topbar">
      <span class="brand">墨<em>阁</em></span>
      <span class="muted" style="font-size:12px; letter-spacing:1px;">小说创作资料管理</span>
      <div style="flex:1"></div>
      <el-button size="small" @click="importVisible = true">导入备份</el-button>
      <el-button size="small" @click="exportAllBooks" :disabled="!store.books.length">导出全部</el-button>
      <el-button size="small" type="primary" @click="createVisible = true">＋ 新建作品</el-button>
    </header>

    <main class="paper-bg" style="flex:1; overflow-y:auto; padding: 36px 44px;">
      <div v-if="!store.books.length" class="empty-hint" style="height: 60vh;">
        <div class="glyph">卷</div>
        <div>书架还是空的</div>
        <el-button type="primary" plain @click="createVisible = true">写下第一个故事</el-button>
      </div>

      <div v-else class="shelf">
        <div v-for="book in store.books" :key="book.id" class="book-card" @click="openBook(book.id)">
          <div class="book-cover">
            <img v-if="coverUrls[book.id]" :src="coverUrls[book.id]" alt="" />
            <span v-else class="cover-title serif">{{ book.title.slice(0, 2) }}</span>
          </div>
          <div class="book-info">
            <div class="book-title serif">{{ book.title }}</div>
            <div class="muted" style="font-size:12px; margin-top:4px;">
              {{ book.status || '连载中' }} · {{ fmtTime(book.updatedAt) }}
            </div>
          </div>
          <div class="book-ops" @click.stop>
            <el-dropdown trigger="click" @command="(cmd) => onBookCmd(cmd, book)">
              <span class="op-btn">···</span>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="rename">编辑信息</el-dropdown-item>
                  <el-dropdown-item command="export">导出本书</el-dropdown-item>
                  <el-dropdown-item command="delete" style="color: var(--accent);">删除</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </div>
      </div>
    </main>

    <!-- 新建 / 编辑书籍 -->
    <el-dialog v-model="createVisible" :title="editingBook ? '编辑作品信息' : '新建作品'" width="440px">
      <el-form label-position="top">
        <el-form-item label="书名">
          <el-input v-model="form.title" maxlength="40" placeholder="给你的故事起个名字" />
        </el-form-item>
        <el-form-item label="简介">
          <el-input v-model="form.intro" type="textarea" :rows="3" maxlength="200" placeholder="一句话简介（可留空）" />
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="form.status">
            <el-radio value="连载中">连载中</el-radio>
            <el-radio value="已完结">已完结</el-radio>
            <el-radio value="构思中">构思中</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="封面（可选）">
          <div class="avatar-uploader" style="width:96px; height:128px;" @click="coverInput.click()">
            <img v-if="form.coverUrl" :src="form.coverUrl" />
            <span v-else class="plus">＋</span>
          </div>
          <input ref="coverInput" type="file" accept="image/*" style="display:none" @change="onCoverPick" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" :disabled="!form.title.trim()" @click="saveBook">
          {{ editingBook ? '保存' : '创建' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 导入 -->
    <el-dialog v-model="importVisible" title="导入备份" width="440px">
      <p class="muted" style="margin-top:0; line-height:1.8;">
        选择之前导出的 JSON 备份文件（单书或整库备份均可），导入后会作为新作品加入书架，不会覆盖现有数据。
      </p>
      <el-button style="width:100%" @click="importInput.click()">选择备份文件</el-button>
      <input ref="importInput" type="file" accept=".json,application/json" style="display:none" @change="onImportPick" />
    </el-dialog>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useStore, exportBook, exportAll, importData, downloadJSON } from '../store'

const store = useStore()
const router = useRouter()

const createVisible = ref(false)
const importVisible = ref(false)
const editingBook = ref(null)
const coverInput = ref(null)
const importInput = ref(null)
const coverUrls = ref({})

const form = reactive({ title: '', intro: '', status: '连载中', cover: null, coverUrl: '' })

async function refreshCovers() {
  const map = {}
  for (const b of store.books) {
    if (b.cover) map[b.id] = URL.createObjectURL(b.cover)
  }
  Object.values(coverUrls.value).forEach(u => URL.revokeObjectURL(u))
  coverUrls.value = map
}

onMounted(async () => {
  await store.loadBooks()
  await refreshCovers()
})

onUnmounted(() => {
  Object.values(coverUrls.value).forEach(u => URL.revokeObjectURL(u))
})

function openBook(id) {
  router.push({ name: 'workspace', params: { id } })
}

function fmtTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function onCoverPick(e) {
  const file = e.target.files[0]
  if (!file) return
  form.cover = file
  form.coverUrl = URL.createObjectURL(file)
  e.target.value = ''
}

async function saveBook() {
  if (editingBook.value) {
    await store.updateBook(editingBook.value.id, {
      title: form.title.trim(), intro: form.intro, status: form.status,
      ...(form.cover ? { cover: form.cover } : {})
    })
    ElMessage.success('已保存')
  } else {
    const id = await store.createBook({ title: form.title.trim(), intro: form.intro, cover: form.cover })
    ElMessage.success('作品已创建')
    createVisible.value = false
    resetForm()
    await refreshCovers()
    openBook(id)
    return
  }
  createVisible.value = false
  resetForm()
  await refreshCovers()
}

function resetForm() {
  editingBook.value = null
  Object.assign(form, { title: '', intro: '', status: '连载中', cover: null, coverUrl: '' })
}

async function onBookCmd(cmd, book) {
  if (cmd === 'rename') {
    editingBook.value = book
    Object.assign(form, {
      title: book.title, intro: book.intro || '', status: book.status || '连载中',
      cover: null, coverUrl: coverUrls.value[book.id] || ''
    })
    createVisible.value = true
  } else if (cmd === 'export') {
    const data = await exportBook(book.id)
    downloadJSON(data, `${book.title}.backup.json`)
    ElMessage.success('已导出')
  } else if (cmd === 'delete') {
    await ElMessageBox.confirm(
      `确定删除《${book.title}》吗？书中的全部章节、人物和世界观设定都会被删除，且不可恢复。`,
      '删除作品',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
    )
    await store.deleteBook(book.id)
    await refreshCovers()
    ElMessage.success('已删除')
  }
}

async function exportAllBooks() {
  const data = await exportAll()
  downloadJSON(data, `墨阁备份-${fmtTime(Date.now())}.json`)
  ElMessage.success('已导出全部作品')
}

async function onImportPick(e) {
  const file = e.target.files[0]
  e.target.value = ''
  if (!file) return
  try {
    const text = await file.text()
    const payload = JSON.parse(text)
    const imported = await importData(payload)
    if (!imported.length) throw new Error('empty')
    await store.loadBooks()
    await refreshCovers()
    importVisible.value = false
    ElMessage.success(`成功导入 ${imported.length} 本作品`)
  } catch {
    ElMessage.error('导入失败：文件格式不正确')
  }
}
</script>

<style scoped>
.shelf {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 22px;
  max-width: 1200px;
}
.book-card {
  position: relative;
  display: flex; gap: 14px;
  padding: 16px;
  background: var(--paper-2);
  border: 1px solid var(--line);
  border-radius: 14px;
  cursor: pointer;
  transition: border-color .2s, transform .2s, box-shadow .2s;
}
.book-card:hover {
  border-color: var(--line-2);
  transform: translateY(-2px);
  box-shadow: 0 10px 28px rgba(0, 0, 0, .07);
}
.book-cover {
  width: 72px; height: 96px; flex-shrink: 0;
  border-radius: 8px; overflow: hidden;
  background: var(--paper-3);
  border: 1px solid var(--line);
  display: flex; align-items: center; justify-content: center;
}
.book-cover img { width: 100%; height: 100%; object-fit: cover; }
.cover-title { font-size: 24px; font-weight: 700; color: var(--ink-3); letter-spacing: 2px; }
.book-info { flex: 1; min-width: 0; padding-top: 4px; }
.book-title { font-size: 17px; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.book-ops { position: absolute; top: 10px; right: 10px; }
.book-ops .op-btn { color: var(--ink-3); cursor: pointer; padding: 2px 6px; border-radius: 3px; }
.book-ops .op-btn:hover { background: var(--paper-3); color: var(--accent); }
</style>
