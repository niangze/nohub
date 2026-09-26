<template>
  <div class="chapter-editor paper-bg">
    <div class="chapter-head">
      <input
        v-model="title"
        class="title-input serif"
        maxlength="60"
        placeholder="章节标题"
        @blur="saveTitle"
        @keyup.enter="$event.target.blur()"
      />
      <div class="chapter-meta muted">
        <span>{{ wordCount }} 字</span>
        <span>{{ saveStatus }}</span>
        <span v-if="chapter.updatedAt">{{ fmtTime(chapter.updatedAt) }}</span>
        <el-popover placement="bottom-end" :width="264" trigger="click">
          <template #reference>
            <span class="pref-trigger">排版</span>
          </template>
          <div class="pref-panel">
            <div class="pref-row">
              <span>首行自动空两格</span>
              <el-switch v-model="prefs.indent" />
            </div>
            <div class="pref-row">
              <span>显示行线（下划线）</span>
              <el-switch v-model="prefs.ruled" />
            </div>
            <div class="pref-col">
              <span class="pref-label">段落间距</span>
              <el-radio-group v-model="prefs.spacing" size="small">
                <el-radio-button value="tight">紧凑</el-radio-button>
                <el-radio-button value="normal">适中</el-radio-button>
                <el-radio-button value="loose">宽松</el-radio-button>
              </el-radio-group>
            </div>
            <div class="pref-col">
              <span class="pref-label">正文字号</span>
              <el-radio-group v-model="prefs.fontSize" size="small">
                <el-radio-button :value="15">小</el-radio-button>
                <el-radio-button :value="16">标准</el-radio-button>
                <el-radio-button :value="18">大</el-radio-button>
              </el-radio-group>
            </div>
          </div>
        </el-popover>
      </div>
    </div>

    <div class="editor-wrap" :class="editorClasses">
      <Toolbar :editor="editorRef" :defaultConfig="toolbarConfig" mode="default" />
      <Editor
        v-model="valueHtml"
        :defaultConfig="editorConfig"
        mode="default"
        @onCreated="onCreated"
        @onChange="onChange"
      />
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, reactive, ref, shallowRef, watch } from 'vue'
import { Editor, Toolbar } from '@wangeditor/editor-for-vue'
import { useStore } from '../store'

const props = defineProps({
  chapter: { type: Object, required: true }
})
const emit = defineEmits(['renamed', 'saved'])

const store = useStore()

const title = ref(props.chapter.title)
const valueHtml = ref(props.chapter.content || '')
const editorRef = shallowRef(null)
const saveStatus = ref('已保存')
let saveTimer = null
let baseline = props.chapter.content || ''

// ---------- 排版偏好（全局记忆，存 localStorage） ----------
const PREFS_KEY = 'ink-editor-prefs'
const prefs = reactive(Object.assign(
  { indent: true, ruled: false, spacing: 'normal', fontSize: 16 },
  JSON.parse(localStorage.getItem(PREFS_KEY) || '{}')
))
watch(prefs, v => localStorage.setItem(PREFS_KEY, JSON.stringify(v)), { deep: true })

const editorClasses = computed(() => ({
  'pref-indent': prefs.indent,
  'pref-ruled': prefs.ruled,
  [`pref-spacing-${prefs.spacing}`]: true,
  [`pref-font-${prefs.fontSize}`]: true
}))

const toolbarConfig = {
  excludeKeys: ['insertVideo', 'uploadVideo', 'codeBlock', 'emotion', 'group-video']
}
const editorConfig = {
  placeholder: '从这里开始写作……',
  scroll: true
}

const wordCount = computed(() =>
  (valueHtml.value || '').replace(/<[^>]+>/g, '').replace(/\s+/g, '').length
)

function onCreated(editor) {
  editorRef.value = editor
}

function onChange() {
  if (valueHtml.value === baseline) return
  saveStatus.value = '保存中…'
  clearTimeout(saveTimer)
  saveTimer = setTimeout(async () => {
    await store.saveChapterContent(props.chapter.id, valueHtml.value)
    baseline = valueHtml.value
    saveStatus.value = '已自动保存'
    emit('saved')
  }, 800)
}

async function saveTitle() {
  const t = title.value.trim()
  if (t && t !== props.chapter.title) {
    await store.renameChapter(props.chapter.id, t)
    emit('renamed')
  } else {
    title.value = props.chapter.title
  }
}

function fmtTime(ts) {
  const d = new Date(ts)
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

onBeforeUnmount(() => {
  clearTimeout(saveTimer)
  const editor = editorRef.value
  if (editor) editor.destroy()
})
</script>

<style scoped>
.chapter-editor { height: 100%; display: flex; flex-direction: column; }
.chapter-editor :deep(.editor-wrap) { flex: 1; min-height: 0; }
.chapter-editor :deep(.editor-wrap > div[data-w-e-toolbar]) { flex-shrink: 0; }
.chapter-editor :deep(.editor-wrap > div[data-w-e-textarea]) {
  flex: 1; min-height: 0; display: flex; flex-direction: column;
}
.chapter-head {
  padding: 12px 44px 8px;
  flex-shrink: 0;
  display: flex; align-items: baseline; gap: 18px;
}
.title-input {
  flex: 1; min-width: 0;
  border: none; outline: none; background: transparent;
  font-size: 22px; font-weight: 700; color: var(--ink);
  border-bottom: 1px solid transparent;
  padding: 2px 0 4px;
  transition: border-color .2s;
}
.title-input:hover, .title-input:focus { border-bottom-color: var(--line-2); }
.chapter-meta {
  display: flex; gap: 14px; font-size: 12px; align-items: center; flex-shrink: 0;
}
.pref-trigger {
  cursor: pointer; font-size: 12px; color: var(--ink-3);
  padding: 2px 8px; border: 1px solid var(--line); border-radius: 999px;
  transition: all .15s;
}
.pref-trigger:hover { color: var(--accent); border-color: var(--accent); }
.pref-panel { display: flex; flex-direction: column; gap: 14px; }
.pref-row { display: flex; align-items: center; justify-content: space-between; font-size: 13px; }
.pref-col { display: flex; flex-direction: column; gap: 8px; }
.pref-label { font-size: 12px; color: var(--ink-3); }
</style>
