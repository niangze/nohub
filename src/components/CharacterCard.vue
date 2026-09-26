<template>
  <div class="char-card paper-bg">
    <div class="card-scroll">
      <div class="card-top">
        <div class="left-col">
          <div class="avatar-uploader" @click="avatarInput.click()">
            <img v-if="avatarUrl" :src="avatarUrl" />
            <span v-else class="plus">＋<br /><span style="font-size:12px;">形象照片</span></span>
          </div>
          <input ref="avatarInput" type="file" accept="image/*" style="display:none" @change="onAvatarPick" />

          <div class="field-label" style="margin-top:14px;">更多形象 / 参考图</div>
          <div class="gallery">
            <div v-for="(url, i) in galleryUrls" :key="i" class="gallery-item">
              <img :src="url" />
              <span class="del" @click="removeGallery(i)">×</span>
            </div>
            <div class="gallery-item add" @click="galleryInput.click()">
              <span class="plus">＋</span>
            </div>
          </div>
          <input ref="galleryInput" type="file" accept="image/*" multiple style="display:none" @change="onGalleryPick" />
        </div>

        <div class="right-col">
          <input v-model="form.name" class="name-input serif" maxlength="30" placeholder="角色姓名" />
          <div class="grid">
            <div><div class="field-label">别名 / 称号</div><el-input v-model="form.aliases" placeholder="如：剑仙、阿七" /></div>
            <div><div class="field-label">性别</div><el-input v-model="form.gender" placeholder="" /></div>
            <div><div class="field-label">年龄</div><el-input v-model="form.age" placeholder="" /></div>
            <div><div class="field-label">身份</div><el-input v-model="form.identity" placeholder="如：青云宗内门弟子" /></div>
            <div><div class="field-label">阵营 / 势力</div><el-input v-model="form.faction" placeholder="" /></div>
          </div>
        </div>
      </div>

      <div class="sections">
        <section v-for="sec in sections" :key="sec.key">
          <div class="sec-title serif">{{ sec.label }}</div>
          <el-input v-model="form[sec.key]" type="textarea" :rows="sec.rows" :placeholder="sec.placeholder" resize="vertical" />
        </section>
      </div>

      <div class="save-line muted">{{ saveStatus }}</div>
    </div>
  </div>
</template>

<script setup>
import { onUnmounted, reactive, ref, watch } from 'vue'
import { useStore } from '../store'

const props = defineProps({
  character: { type: Object, required: true }
})
const emit = defineEmits(['changed'])

const store = useStore()
const avatarInput = ref(null)
const galleryInput = ref(null)

const form = reactive({})
const avatarUrl = ref('')
const galleryUrls = ref([])
const saveStatus = ref('已保存')

let loading = false
let saveTimer = null
const createdUrls = []

const sections = [
  { key: 'appearance', label: '外貌描写', rows: 2, placeholder: '身形、容貌、标志性特征……' },
  { key: 'personality', label: '性格', rows: 2, placeholder: '性格底色、处事方式、优缺点……' },
  { key: 'background', label: '背景经历', rows: 3, placeholder: '出身、过往、关键转折……' },
  { key: 'hobbies', label: '个人爱好', rows: 2, placeholder: '喜欢什么、讨厌什么、日常小习惯……' },
  { key: 'quotes', label: '口头禅 / 经典台词', rows: 2, placeholder: '「……」' },
  { key: 'relations', label: '人际关系', rows: 3, placeholder: '亲友、仇敌、师承、道侣……' },
  { key: 'notes', label: '备注', rows: 2, placeholder: '其他想记下的设定' }
]

function makeUrl(blob) {
  if (!blob) return ''
  const u = URL.createObjectURL(blob)
  createdUrls.push(u)
  return u
}

function load(c) {
  loading = true
  Object.assign(form, {
    name: c.name || '', aliases: c.aliases || '', gender: c.gender || '', age: c.age || '',
    identity: c.identity || '', faction: c.faction || '', appearance: c.appearance || '',
    personality: c.personality || '', background: c.background || '', hobbies: c.hobbies || '',
    quotes: c.quotes || '', relations: c.relations || '', notes: c.notes || '',
    avatar: c.avatar || null, gallery: c.gallery || []
  })
  avatarUrl.value = makeUrl(c.avatar)
  galleryUrls.value = (c.gallery || []).map(makeUrl)
  saveStatus.value = '已保存'
  setTimeout(() => { loading = false }, 50)
}

watch(() => props.character.id, () => load(props.character), { immediate: true })

watch(form, () => {
  if (loading) return
  saveStatus.value = '保存中…'
  clearTimeout(saveTimer)
  saveTimer = setTimeout(async () => {
    await store.updateCharacter(props.character.id, { ...form })
    saveStatus.value = '已自动保存'
    emit('changed')
  }, 600)
})

function onAvatarPick(e) {
  const file = e.target.files[0]
  e.target.value = ''
  if (!file) return
  form.avatar = file
  avatarUrl.value = makeUrl(file)
}

function onGalleryPick(e) {
  const files = [...e.target.files]
  e.target.value = ''
  files.forEach(f => {
    form.gallery.push(f)
    galleryUrls.value.push(makeUrl(f))
  })
}

function removeGallery(i) {
  form.gallery.splice(i, 1)
  galleryUrls.value.splice(i, 1)
}

onUnmounted(() => {
  clearTimeout(saveTimer)
  createdUrls.forEach(u => URL.revokeObjectURL(u))
})
</script>

<style scoped>
.char-card { height: 100%; }
.card-scroll { height: 100%; overflow-y: auto; padding: 28px 44px 40px; max-width: 860px; }
.card-top { display: flex; gap: 28px; }
.left-col { flex-shrink: 0; width: 132px; }
.right-col { flex: 1; min-width: 0; }
.name-input {
  width: 100%; border: none; outline: none; background: transparent;
  font-size: 26px; font-weight: 700; color: var(--ink);
  border-bottom: 1px solid var(--line-2);
  padding: 2px 0 8px; margin-bottom: 16px;
}
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 16px; }
.gallery { display: flex; flex-wrap: wrap; gap: 8px; }
.gallery-item.add {
  display: flex; align-items: center; justify-content: center;
  border-style: dashed; cursor: pointer; color: var(--ink-3);
}
.gallery-item.add:hover { border-color: var(--accent); color: var(--accent); }
.sections { margin-top: 26px; display: flex; flex-direction: column; gap: 18px; }
.sec-title {
  font-size: 15px; font-weight: 700; margin-bottom: 6px;
  padding-left: 9px; border-left: 3px solid var(--accent);
  line-height: 1.2;
}
.save-line { margin-top: 18px; font-size: 12px; text-align: right; }
</style>
