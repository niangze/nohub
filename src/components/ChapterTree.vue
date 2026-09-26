<template>
  <div class="tree-wrap">
    <el-tree
      ref="treeRef"
      :data="treeData"
      node-key="key"
      default-expand-all
      draggable
      :expand-on-click-node="false"
      :allow-drop="allowDrop"
      @node-drop="onDrop"
      @node-click="onNodeClick"
      :highlight-current="true"
      :current-node-key="selectedKey"
    >
      <template #default="{ data }">
        <span class="tree-node" :class="{ 'is-volume': data.type === 'volume' }">
          <span class="label">{{ data.label }}</span>
          <span v-if="data.type === 'chapter'" class="wc">{{ data.wordCount }}字</span>
          <span class="ops" @click.stop>
            <span v-if="data.type === 'volume'" class="op-btn" title="在此卷下新建章节" @click="addChapterTo(data)">＋</span>
            <span class="op-btn" title="改名" @click="startRename(data)">✎</span>
            <span class="op-btn" title="删除" @click="removeNode(data)">×</span>
          </span>
        </span>
      </template>
    </el-tree>

    <el-dialog v-model="renameVisible" :title="renameTarget?.type === 'volume' ? '修改卷名' : '修改章节名'" width="360px" append-to-body>
      <el-input v-model="renameValue" maxlength="60" @keyup.enter="confirmRename" placeholder="输入新名称" />
      <template #footer>
        <el-button @click="renameVisible = false">取消</el-button>
        <el-button type="primary" :disabled="!renameValue.trim()" @click="confirmRename">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useStore } from '../store'

const props = defineProps({
  volumes: { type: Array, default: () => [] },
  chapters: { type: Array, default: () => [] },
  selectedChapterId: { type: Number, default: null }
})
const emit = defineEmits(['select', 'refresh'])

const store = useStore()
const treeRef = ref(null)
const renameVisible = ref(false)
const renameTarget = ref(null)
const renameValue = ref('')

const stripHtml = (html) => (html || '').replace(/<[^>]+>/g, '').replace(/\s+/g, '')

const treeData = computed(() =>
  [...props.volumes]
    .sort((a, b) => a.order - b.order)
    .map(v => ({
      key: `v-${v.id}`,
      rawId: v.id,
      type: 'volume',
      label: v.name,
      children: props.chapters
        .filter(c => c.volumeId === v.id)
        .sort((a, b) => a.order - b.order)
        .map(c => ({
          key: `c-${c.id}`,
          rawId: c.id,
          type: 'chapter',
          label: c.title,
          wordCount: stripHtml(c.content).length
        }))
    }))
)

const selectedKey = computed(() =>
  props.selectedChapterId ? `c-${props.selectedChapterId}` : ''
)

function onNodeClick(data) {
  if (data.type === 'chapter') emit('select', data.rawId)
}

function allowDrop(draggingNode, dropNode, type) {
  if (draggingNode.data.type === 'volume') {
    return dropNode.data.type === 'volume' && type !== 'inner'
  }
  if (dropNode.data.type === 'volume') return type === 'inner'
  return type !== 'inner'
}

async function onDrop() {
  const nodes = treeRef.value?.root?.childNodes || []
  await store.persistTree(nodes)
  emit('refresh')
}

function startRename(data) {
  renameTarget.value = data
  renameValue.value = data.label
  renameVisible.value = true
}

async function confirmRename() {
  const name = renameValue.value.trim()
  if (!name) return
  if (renameTarget.value.type === 'volume') {
    await store.renameVolume(renameTarget.value.rawId, name)
  } else {
    await store.renameChapter(renameTarget.value.rawId, name)
  }
  renameVisible.value = false
  emit('refresh')
}

async function addChapterTo(data) {
  const chapterId = await store.addChapter(props.volumes.find(v => v.id === data.rawId).bookId, data.rawId)
  emit('refresh')
  emit('select', chapterId)
  ElMessage.success('已新建章节')
}

async function removeNode(data) {
  if (data.type === 'volume') {
    const count = props.chapters.filter(c => c.volumeId === data.rawId).length
    await ElMessageBox.confirm(
      count ? `删除「${data.label}」将同时删除其中 ${count} 个章节，确定吗？` : `确定删除「${data.label}」吗？`,
      '删除卷',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
    )
    await store.deleteVolume(data.rawId)
  } else {
    await ElMessageBox.confirm(`确定删除章节「${data.label}」吗？正文将一并删除。`, '删除章节', {
      type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消'
    })
    await store.deleteChapter(data.rawId)
  }
  emit('refresh')
}
</script>

<style scoped>
.tree-wrap { padding: 6px 8px 20px; }
</style>
