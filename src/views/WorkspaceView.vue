<template>
  <div class="page-full">
    <header class="topbar">
      <el-button text @click="$router.push({ name: 'library' })">← 书架</el-button>
      <span class="brand" style="font-size:17px;">{{ book?.title || '…' }}</span>
      <span class="muted" style="font-size:12px;">
        共 {{ chapters.length }} 章 · {{ totalWords }} 字 · {{ characters.length }} 个人物
      </span>
      <div style="flex:1"></div>
      <el-button size="small" @click="exportThisBook">导出本书</el-button>
    </header>

    <div class="body">
      <!-- 左侧栏 -->
      <aside v-show="!collapsed" class="sidebar">
        <el-tabs v-model="tab" stretch>
          <el-tab-pane label="目录" name="chapters" />
          <el-tab-pane label="人物" name="characters" />
          <el-tab-pane label="世界观" name="world" />
        </el-tabs>

        <div class="side-content">
          <!-- 目录 -->
          <template v-if="tab === 'chapters'">
            <el-button class="side-add" size="small" plain @click="onAddVolume">＋ 新建卷</el-button>
            <ChapterTree
              :volumes="volumes"
              :chapters="chapters"
              :selected-chapter-id="selectedChapterId"
              @select="id => (selectedChapterId = id)"
              @refresh="refreshAll"
            />
          </template>

          <!-- 人物 -->
          <template v-else-if="tab === 'characters'">
            <el-button class="side-add" size="small" plain @click="onAddCharacter">＋ 新建人物卡</el-button>
            <div
              v-for="c in characters"
              :key="c.id"
              class="side-item"
              :class="{ active: c.id === selectedCharId }"
              @click="selectedCharId = c.id"
            >
              <span class="char-avatar">
                <img v-if="charAvatarUrls[c.id]" :src="charAvatarUrls[c.id]" />
                <span v-else>{{ (c.name || '?').slice(0, 1) }}</span>
              </span>
              <span class="label serif">{{ c.name }}</span>
              <span class="del" @click.stop="removeCharacter(c)">×</span>
            </div>
            <div v-if="!characters.length" class="side-empty muted">还没有人物，点上方新建</div>
          </template>

          <!-- 世界观 -->
          <template v-else>
            <div class="world-types">
              <span
                v-for="t in WORLD_TYPES"
                :key="t.key"
                class="type-pill serif"
                :class="{ active: worldType === t.key }"
                @click="worldType = t.key"
              >{{ t.label }}</span>
            </div>
            <el-button class="side-add" size="small" plain @click="onAddWorld">＋ 新建{{ currentTypeLabel }}</el-button>
            <div
              v-for="w in filteredWorld"
              :key="w.id"
              class="side-item"
              :class="{ active: w.id === selectedWorldId }"
              @click="selectedWorldId = w.id"
            >
              <span class="label serif">{{ w.name }}</span>
              <span class="muted" style="font-size:11px; flex-shrink:0;">{{ worldTag(w) }}</span>
              <span class="del" @click.stop="removeWorld(w)">×</span>
            </div>
            <div v-if="!filteredWorld.length" class="side-empty muted">暂无{{ currentTypeLabel }}记录</div>
          </template>
        </div>
      </aside>

      <!-- 折叠轨：点击收起/展开侧栏 -->
      <div
        class="collapse-rail"
        :class="{ collapsed }"
        :title="collapsed ? '展开侧栏' : '收起侧栏'"
        @click="toggleSidebar"
      >
        <span class="rail-arrow">{{ collapsed ? '›' : '‹' }}</span>
      </div>

      <!-- 右侧编辑区 -->
      <main class="content">
        <ChapterEditor
          v-if="tab === 'chapters' && selectedChapter"
          :key="selectedChapter.id"
          :chapter="selectedChapter"
          @renamed="refreshAll"
          @saved="quietRefresh"
        />
        <CharacterCard
          v-else-if="tab === 'characters' && selectedChar"
          :key="selectedChar.id"
          :character="selectedChar"
          @changed="quietRefresh"
        />
        <WorldEntryEditor
          v-else-if="tab === 'world' && selectedWorld"
          :key="selectedWorld.id"
          :entry="selectedWorld"
          @changed="quietRefresh"
        />
        <div v-else class="empty-hint paper-bg">
          <div class="glyph">{{ emptyGlyph }}</div>
          <div>{{ emptyText }}</div>
        </div>
      </main>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { db } from '../db'
import { useStore, exportBook, downloadJSON } from '../store'
import ChapterTree from '../components/ChapterTree.vue'
import ChapterEditor from '../components/ChapterEditor.vue'
import CharacterCard from '../components/CharacterCard.vue'
import WorldEntryEditor from '../components/WorldEntryEditor.vue'

const route = useRoute()
const store = useStore()
const bookId = Number(route.params.id)

const book = ref(null)
const volumes = ref([])
const chapters = ref([])
const characters = ref([])
const worldEntries = ref([])

const tab = ref('chapters')
const worldType = ref('event')
const selectedChapterId = ref(null)
const selectedCharId = ref(null)
const selectedWorldId = ref(null)

// 侧栏折叠（记忆）
const collapsed = ref(localStorage.getItem('ink-sidebar-collapsed') === '1')
function toggleSidebar() {
  collapsed.value = !collapsed.value
  localStorage.setItem('ink-sidebar-collapsed', collapsed.value ? '1' : '0')
}

const charAvatarUrls = ref({})
const createdUrls = []

const WORLD_TYPES = [
  { key: 'event', label: '历史大事件' },
  { key: 'power', label: '力量体系' },
  { key: 'geo', label: '地理格局' },
  { key: 'treasure', label: '奇异珍宝' }
]

const currentTypeLabel = computed(() => WORLD_TYPES.find(t => t.key === worldType.value)?.label || '')

const stripHtml = (html) => (html || '').replace(/<[^>]+>/g, '').replace(/\s+/g, '')
const totalWords = computed(() => chapters.value.reduce((s, c) => s + stripHtml(c.content).length, 0))

const selectedChapter = computed(() => chapters.value.find(c => c.id === selectedChapterId.value) || null)
const selectedChar = computed(() => characters.value.find(c => c.id === selectedCharId.value) || null)
const selectedWorld = computed(() => worldEntries.value.find(w => w.id === selectedWorldId.value) || null)

const filteredWorld = computed(() => {
  const list = worldEntries.value.filter(w => w.type === worldType.value)
  if (worldType.value === 'power') return list.sort((a, b) => (a.level ?? 0) - (b.level ?? 0))
  if (worldType.value === 'event') return list.sort((a, b) => String(a.year || '').localeCompare(String(b.year || ''), 'zh'))
  return list.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
})

const emptyGlyph = computed(() => ({ chapters: '墨', characters: '侠', world: '界' }[tab.value]))
const emptyText = computed(() => ({
  chapters: '从左侧选择或新建一个章节',
  characters: '从左侧选择或新建一张人物卡',
  world: '从左侧选择或新建一条设定'
}[tab.value]))

function worldTag(w) {
  return { event: w.year, power: w.level != null ? `Lv.${w.level}` : '', geo: w.region, treasure: w.rank }[w.type] || ''
}

async function refreshAll() {
  const [b, v, c, ch, w] = await Promise.all([
    db.books.get(bookId),
    db.volumes.where('bookId').equals(bookId).sortBy('order'),
    db.chapters.where('bookId').equals(bookId).toArray(),
    db.characters.where('bookId').equals(bookId).toArray(),
    db.worldEntries.where('bookId').equals(bookId).toArray()
  ])
  book.value = b
  volumes.value = v
  chapters.value = c
  characters.value = ch.sort((a, b2) => (b2.updatedAt || 0) - (a.updatedAt || 0))
  worldEntries.value = w

  // 修正选中项
  if (!selectedChapter.value && c.length) {
    const firstV = v[0]
    const first = c.filter(x => x.volumeId === firstV?.id).sort((a, b2) => a.order - b2.order)[0] || c[0]
    selectedChapterId.value = first?.id ?? null
  }
  if (selectedChapterId.value && !c.some(x => x.id === selectedChapterId.value)) selectedChapterId.value = c[0]?.id ?? null
  if (selectedCharId.value && !ch.some(x => x.id === selectedCharId.value)) selectedCharId.value = ch[0]?.id ?? null
  if (selectedWorldId.value && !w.some(x => x.id === selectedWorldId.value)) selectedWorldId.value = null

  // 人物头像 URL
  const map = {}
  for (const item of ch) {
    if (item.avatar) {
      const u = URL.createObjectURL(item.avatar)
      createdUrls.push(u)
      map[item.id] = u
    }
  }
  charAvatarUrls.value = map
}

/** 编辑自动保存后的轻量刷新（不打断输入焦点） */
let quietTimer = null
function quietRefresh() {
  clearTimeout(quietTimer)
  quietTimer = setTimeout(async () => {
    const [c, ch, w] = await Promise.all([
      db.chapters.where('bookId').equals(bookId).toArray(),
      db.characters.where('bookId').equals(bookId).toArray(),
      db.worldEntries.where('bookId').equals(bookId).toArray()
    ])
    chapters.value = c
    characters.value = ch.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    worldEntries.value = w
  }, 500)
}

async function onAddVolume() {
  await store.addVolume(bookId)
  await refreshAll()
}

async function onAddCharacter() {
  const id = await store.addCharacter(bookId)
  await refreshAll()
  selectedCharId.value = id
}

async function removeCharacter(c) {
  await ElMessageBox.confirm(`确定删除人物「${c.name}」吗？`, '删除人物', {
    type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消'
  })
  await store.deleteCharacter(c.id)
  await refreshAll()
}

async function onAddWorld() {
  const id = await store.addWorldEntry(bookId, worldType.value)
  await refreshAll()
  selectedWorldId.value = id
}

async function removeWorld(w) {
  await ElMessageBox.confirm(`确定删除「${w.name}」吗？`, '删除设定', {
    type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消'
  })
  await store.deleteWorldEntry(w.id)
  await refreshAll()
}

async function exportThisBook() {
  const data = await exportBook(bookId)
  downloadJSON(data, `${book.value?.title || '作品'}.backup.json`)
  ElMessage.success('已导出本书（含图片）')
}

watch(worldType, () => {
  selectedWorldId.value = filteredWorld.value[0]?.id ?? null
})

onMounted(async () => {
  await refreshAll()
  if (!selectedCharId.value && characters.value.length) selectedCharId.value = characters.value[0].id
  if (!selectedWorldId.value && filteredWorld.value.length) selectedWorldId.value = filteredWorld.value[0].id
})

onUnmounted(() => {
  createdUrls.forEach(u => URL.revokeObjectURL(u))
})
</script>

<style scoped>
.body { flex: 1; display: flex; min-height: 0; }
.sidebar {
  width: 264px; flex-shrink: 0;
  border-right: 1px solid var(--line);
  background: var(--paper);
  display: flex; flex-direction: column;
}
.sidebar :deep(.el-tabs__nav-wrap) { padding: 0 10px; }
.sidebar :deep(.el-tabs__header) { margin-bottom: 6px; }
.side-content { flex: 1; overflow-y: auto; padding: 4px 6px 16px; }
.side-add { width: calc(100% - 12px); margin: 4px 6px 8px; }

.side-item {
  display: flex; align-items: center; gap: 8px;
  padding: 7px 10px; margin: 2px 6px;
  border-radius: 8px; cursor: pointer;
  font-size: 13.5px;
}
.side-item:hover { background: #f3f3f3; }
.side-item.active { background: var(--accent-soft); color: var(--accent); }
.side-item .label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
.side-item .del {
  display: none; width: 18px; height: 18px; flex-shrink: 0;
  align-items: center; justify-content: center;
  border-radius: 6px; color: var(--ink-3);
}
.side-item:hover .del { display: inline-flex; }
.side-item .del:hover { background: var(--paper-3); color: var(--accent); }

.char-avatar {
  width: 26px; height: 26px; flex-shrink: 0;
  border-radius: 50%; overflow: hidden;
  background: var(--paper-3); border: 1px solid var(--line);
  display: inline-flex; align-items: center; justify-content: center;
  font-family: var(--serif); font-size: 13px; color: var(--ink-3);
}
.char-avatar img { width: 100%; height: 100%; object-fit: cover; }

.world-types {
  display: flex; flex-wrap: wrap; gap: 6px; padding: 4px 10px 8px;
}
.type-pill {
  font-size: 12.5px; padding: 3px 10px;
  border: 1px solid var(--line-2); border-radius: 999px;
  cursor: pointer; color: var(--ink-2);
  transition: all .15s;
}
.type-pill:hover { border-color: var(--accent); color: var(--accent); }
.type-pill.active { background: var(--accent); border-color: var(--accent); color: #fff; }

.side-empty { padding: 30px 10px; text-align: center; font-size: 12.5px; }

.collapse-rail {
  width: 16px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; user-select: none;
  border-right: 1px solid var(--line);
  background: var(--paper);
  transition: background .15s;
}
.collapse-rail.collapsed { border-right: none; }
.collapse-rail:hover { background: var(--paper-3); }
.collapse-rail .rail-arrow {
  font-size: 13px; color: var(--ink-3);
  width: 16px; height: 44px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 0 8px 8px 0;
}
.collapse-rail:hover .rail-arrow { color: var(--accent); }

.content { flex: 1; min-width: 0; }
</style>
