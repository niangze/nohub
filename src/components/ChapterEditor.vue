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
        <span v-if="chapter.updatedAt">更新于 {{ fmtTime(chapter.updatedAt) }}</span>
      </div>
    </div>

    <div class="editor-wrap">
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
import { computed, onBeforeUnmount, ref, shallowRef } from 'vue'
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
.chapter-editor :deep(.editor-wrap > div:not(.w-e-toolbar)) {
  flex: 1; min-height: 0; display: flex; flex-direction: column;
}
.chapter-head {
  padding: 18px 44px 10px;
  flex-shrink: 0;
}
.title-input {
  width: 100%;
  border: none; outline: none; background: transparent;
  font-size: 24px; font-weight: 700; color: var(--ink);
  border-bottom: 1px solid transparent;
  padding: 2px 0 6px;
  transition: border-color .2s;
}
.title-input:hover, .title-input:focus { border-bottom-color: var(--line-2); }
.chapter-meta {
  display: flex; gap: 16px; font-size: 12px; margin-top: 8px;
}
</style>
