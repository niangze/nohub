<template>
  <div class="world-editor paper-bg">
    <div class="scroll">
      <input v-model="form.name" class="name-input serif" maxlength="40" :placeholder="meta.namePlaceholder" />

      <div class="grid">
        <div v-if="entry.type === 'event'">
          <div class="field-label">发生时间</div>
          <el-input v-model="form.year" placeholder="如：天元历 327 年 / 千年前" />
        </div>
        <div v-if="entry.type === 'power'">
          <div class="field-label">层级（数字，用于排序，越小越靠前）</div>
          <el-input-number v-model="form.level" :min="0" style="width:100%" />
        </div>
        <div v-if="entry.type === 'geo'">
          <div class="field-label">所属区域</div>
          <el-input v-model="form.region" placeholder="如：东荒 / 北境雪原" />
        </div>
        <div v-if="entry.type === 'treasure'">
          <div class="field-label">品阶 / 等级</div>
          <el-input v-model="form.rank" placeholder="如：天阶上品 / 圣物" />
        </div>
      </div>

      <div class="sec">
        <div class="sec-title serif">概述</div>
        <el-input v-model="form.summary" type="textarea" :rows="2" :placeholder="meta.summaryPlaceholder" resize="vertical" />
      </div>

      <div class="sec">
        <div class="sec-title serif">详细设定</div>
        <el-input v-model="form.detail" type="textarea" :rows="10" :placeholder="meta.detailPlaceholder" resize="vertical" />
      </div>

      <div class="save-line muted">{{ saveStatus }}</div>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, watch, computed } from 'vue'
import { useStore } from '../store'

const props = defineProps({
  entry: { type: Object, required: true }
})
const emit = defineEmits(['changed'])

const store = useStore()
const form = reactive({})
const saveStatus = ref('已保存')
let loading = false
let saveTimer = null

const TYPE_META = {
  event: {
    namePlaceholder: '事件名称',
    summaryPlaceholder: '一句话概括这件事',
    detailPlaceholder: '起因、经过、结果、影响……'
  },
  power: {
    namePlaceholder: '境界 / 等级名称',
    summaryPlaceholder: '这一层的标志与能力上限',
    detailPlaceholder: '突破条件、寿元变化、对应实力表现……'
  },
  geo: {
    namePlaceholder: '地名',
    summaryPlaceholder: '一句话描述这个地方',
    detailPlaceholder: '地形、势力分布、特产、危险之处……'
  },
  treasure: {
    namePlaceholder: '珍宝名称',
    summaryPlaceholder: '一句话说明它是什么',
    detailPlaceholder: '来历、能力、使用限制、现存何处……'
  }
}

const meta = computed(() => TYPE_META[props.entry.type] || TYPE_META.event)

function load(e) {
  loading = true
  Object.assign(form, {
    name: e.name || '', year: e.year || '', level: e.level ?? 0, region: e.region || '',
    rank: e.rank || '', summary: e.summary || '', detail: e.detail || ''
  })
  saveStatus.value = '已保存'
  setTimeout(() => { loading = false }, 50)
}

watch(() => props.entry.id, () => load(props.entry), { immediate: true })

watch(form, () => {
  if (loading) return
  saveStatus.value = '保存中…'
  clearTimeout(saveTimer)
  saveTimer = setTimeout(async () => {
    await store.updateWorldEntry(props.entry.id, { ...form })
    saveStatus.value = '已自动保存'
    emit('changed')
  }, 600)
})
</script>

<style scoped>
.world-editor { height: 100%; }
.scroll { height: 100%; overflow-y: auto; padding: 28px 44px 40px; max-width: 860px; }
.name-input {
  width: 100%; border: none; outline: none; background: transparent;
  font-size: 26px; font-weight: 700; color: var(--ink);
  border-bottom: 1px solid var(--line-2);
  padding: 2px 0 8px; margin-bottom: 16px;
}
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 16px; margin-bottom: 20px; }
.sec { margin-bottom: 18px; }
.sec-title {
  font-size: 15px; font-weight: 700; margin-bottom: 6px;
  padding-left: 9px; border-left: 3px solid var(--accent);
  line-height: 1.2;
}
.save-line { margin-top: 4px; font-size: 12px; text-align: right; }
</style>
