<template>
  <v-dialog
    v-model="show"
    max-width="540"
    transition="dialog-bottom-transition"
    content-class="elevation-0"
    :persistent="downloading"
  >
    <div class="win11-card p-7" :class="{ 'is-installing': downloading }">
      <div class="win11-aurora" aria-hidden="true" />
      <div class="win11-acrylic" aria-hidden="true" />
      <div class="win11-accent-glow" aria-hidden="true" />
      <div class="win11-sheen" aria-hidden="true" />

      <div class="relative z-1">
        <div class="flex items-center gap-4 mb-5">
          <div class="logo-badge" :class="{ pulsing: downloading }">
            <div class="logo-badge-ring" aria-hidden="true" />
            <v-img :src="logo" alt="ChaldStudio" width="44" height="44" class="rounded-lg logo-img" />
          </div>
          <div class="min-w-0">
            <div class="text-lg font-bold title-glow leading-tight">
              {{ isNew ? 'Р”РѕСЃС‚СѓРїРЅР° РЅРѕРІР°СЏ СЃР±РѕСЂРєР°!' : 'РЎР±РѕСЂРєР° ChaldStudio' }}
            </div>
            <div class="text-caption opacity-70">Р’РµСЂСЃРёСЏ {{ info?.version }} В· 1.21.1 В· NeoForge</div>
          </div>
          <v-spacer />
          <v-chip v-if="currentVersion && isNew" size="small" variant="tonal" color="warning" class="chip-pop">
            {{ currentVersion }} в†’ {{ info?.version }}
          </v-chip>
          <v-chip v-else-if="currentVersion && !isNew" size="small" variant="tonal" color="success" class="chip-pop">
            <v-icon size="12" class="mr-1">check_circle</v-icon>
            v{{ currentVersion }}
          </v-chip>
        </div>

        <div class="flex items-center gap-3 mb-5 meta-row">
          <div class="meta-pill">
            <v-icon size="14">storage</v-icon>
            {{ formatSize(info?.fileSize) }}
          </div>
          <div class="meta-pill accent">
            <v-icon size="14">bolt</v-icon>
            Java 21 Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё
          </div>
        </div>

        <div v-if="info?.changelog?.length" class="mb-5">
          <div class="text-sm font-medium mb-2 opacity-90">Р§С‚Рѕ РЅРѕРІРѕРіРѕ</div>
          <v-list density="compact" variant="tonal" rounded="lg" class="bg-surface-dim changelog-list">
            <v-list-item v-for="(item, i) in info.changelog" :key="i" class="changelog-item" :style="{ '--i': i }">
              <template #prepend>
                <v-icon size="small" color="primary" class="mr-2">fiber_manual_record</v-icon>
              </template>
              <v-list-item-title class="text-sm">{{ item }}</v-list-item-title>
            </v-list-item>
          </v-list>
        </div>

        <!-- Р РµР°Р»СЊРЅС‹Р№ РїСЂРѕРіСЂРµСЃСЃ: СЃС‚Р°РґРёРё СѓСЃС‚Р°РЅРѕРІРєРё -->
        <div v-if="downloading" class="mb-5 progress-block">
          <div class="stage-track mb-3">
            <div
              v-for="stage in stages"
              :key="stage.key"
              class="stage-step"
              :class="{ done: progressPct > stage.until, active: currentStageKey === stage.key }"
            >
              <div class="stage-dot">
                <v-icon size="14">{{ progressPct > stage.until ? 'check' : stage.icon }}</v-icon>
              </div>
              <span class="stage-label">{{ stage.label }}</span>
            </div>
          </div>
          <div class="flex justify-between text-caption mb-1">
            <span class="opacity-80">{{ progressLabel }}</span>
            <span class="font-mono font-bold">{{ progressPct }}%</span>
          </div>
          <div class="progress-track-outer">
            <v-progress-linear
              :model-value="progressPct"
              height="8"
              rounded
              color="primary"
              bg-opacity="0.15"
              class="glow-progress"
            />
          </div>
        </div>

        <div class="flex gap-2 justify-end mt-2">
          <v-btn variant="text" @click="show = false" :disabled="downloading">Р—Р°РєСЂС‹С‚СЊ</v-btn>
          <v-btn
            v-if="!downloading && (isNew || !currentVersion)"
            color="primary"
            variant="flat"
            rounded="pill"
            prepend-icon="download"
            class="cta-btn"
            @click="onUpdate"
          >
            {{ currentVersion ? `РЎРєР°С‡Р°С‚СЊ v${info?.version}` : 'РЈСЃС‚Р°РЅРѕРІРёС‚СЊ СЃР±РѕСЂРєСѓ' }}
          </v-btn>
          <v-btn
            v-else-if="!downloading && currentVersion && !isNew"
            color="primary"
            variant="tonal"
            rounded="pill"
            prepend-icon="refresh"
            @click="onUpdate"
          >
            РџРµСЂРµСѓСЃС‚Р°РЅРѕРІРёС‚СЊ
          </v-btn>
        </div>
      </div>
    </div>
  </v-dialog>
</template>

<script lang="ts" setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { useService } from '@/composables'
import { ChaldStudioServiceKey, ChaldStudioUpdateInfo } from '@xmcl/runtime-api'
import { useNotifier } from '@/composables/notifier'
import logo from '../assets/chald-logo.png'

const emit = defineEmits<{ installed: [instancePath: string] }>()

const { fetchModpackInfo, getInstalledModpackVersion, downloadAndInstallModpack } = useService(ChaldStudioServiceKey)
const { notify } = useNotifier()

const show = ref(false)
const info = ref<ChaldStudioUpdateInfo | null>(null)
const currentVersion = ref<string | null>(null)
const downloading = ref(false)
const progressPct = ref(0)
const progressLabel = ref('РџРѕРґРіРѕС‚РѕРІРєР°вЂ¦')

const isNew = computed(() => {
  if (!info.value || !currentVersion.value) return false
  return compareVersions(info.value.version, currentVersion.value) > 0
})

// РЎС‚Р°РґРёРё СѓСЃС‚Р°РЅРѕРІРєРё РґР»СЏ РЅР°РіР»СЏРґРЅРѕРіРѕ С‚СЂРµРєРµСЂР° РїСЂРѕРіСЂРµСЃСЃР°.
// РџРѕСЂРѕРіРё СЃРѕРІРїР°РґР°СЋС‚ СЃ Р»РѕРіРёРєРѕР№ progressLabel РІ startPoll() РЅРёР¶Рµ.
const stages = [
  { key: 'java', label: 'Java 21', icon: 'bolt', until: 0 },
  { key: 'download', label: 'РЎРєР°С‡РёРІР°РЅРёРµ', icon: 'cloud_download', until: 20 },
  { key: 'extract', label: 'Р Р°СЃРїР°РєРѕРІРєР°', icon: 'unarchive', until: 70 },
  { key: 'finish', label: 'Р“РѕС‚РѕРІРѕ', icon: 'check_circle', until: 95 },
] as const

const currentStageKey = computed(() => {
  const pct = progressPct.value
  if (pct < 20) return 'java'
  if (pct < 70) return 'download'
  if (pct < 95) return 'extract'
  return 'finish'
})

let pollTimer: ReturnType<typeof setInterval> | undefined

function stopPoll() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = undefined
  }
}

function startPoll() {
  stopPoll()
  pollTimer = setInterval(async () => {
    try {
      // taskMonitor is injected globally in XMCL preload
      const ts = await (window as any).taskMonitor?.poll?.()
      if (!Array.isArray(ts)) return
      const t = ts.find((x: any) =>
        x?.id === 'chaldstudio-download' ||
        String(x?.key || '').includes('chaldstudio') ||
        String(x?.id || '').includes('chaldstudio'),
      )
      if (!t) return
      const p = t.progress
      if (p && typeof p.progress === 'number' && typeof p.total === 'number' && p.total > 0) {
        const pct = Math.round((p.progress / p.total) * 100)
        progressPct.value = Math.min(100, Math.max(0, pct))
        if (pct < 20) progressLabel.value = 'РЈСЃС‚Р°РЅРѕРІРєР° Java 21вЂ¦'
        else if (pct < 70) progressLabel.value = 'РЎРєР°С‡РёРІР°РЅРёРµ СЃР±РѕСЂРєРёвЂ¦'
        else if (pct < 95) progressLabel.value = 'Р Р°СЃРїР°РєРѕРІРєР° РІ modsвЂ¦'
        else progressLabel.value = 'Р—Р°РІРµСЂС€РµРЅРёРµвЂ¦'
      }
      // installJava may create sibling tasks
      const javaTask = ts.find((x: any) =>
        String(x?.id || '').includes('java') ||
        String(x?.key || '').includes('java-') ||
        String(x?.type || '').includes('installJre'),
      )
      if (javaTask && progressPct.value < 20) {
        progressLabel.value = 'РЈСЃС‚Р°РЅРѕРІРєР° Java 21вЂ¦'
        const jp = javaTask.progress
        if (jp?.total) {
          progressPct.value = Math.min(18, Math.round((jp.progress / jp.total) * 18))
        }
      }
    } catch {
      /* ignore */
    }
  }, 250)
}

watch(downloading, (v) => {
  if (v) startPoll()
  else stopPoll()
})

onBeforeUnmount(stopPoll)

async function checkForUpdate() {
  try {
    const [fetched, installed] = await Promise.all([
      fetchModpackInfo(),
      getInstalledModpackVersion(),
    ])
    if (!fetched) return
    info.value = fetched
    currentVersion.value = installed
    // РїРѕРєР°Р·С‹РІР°С‚СЊ С‚РѕР»СЊРєРѕ РµСЃР»Рё РЅРµС‚ СѓСЃС‚Р°РЅРѕРІРєРё РёР»Рё РµСЃС‚СЊ Р±РѕР»РµРµ РЅРѕРІР°СЏ РІРµСЂСЃРёСЏ
    if (!installed || compareVersions(fetched.version, installed) > 0) {
      show.value = true
    }
  } catch (e) {
    console.error('Failed to check ChaldStudio update:', e)
  }
}

/** РћС‚РєСЂС‹С‚СЊ С‚Рѕ Р¶Рµ РјРµРЅСЋ РІСЂСѓС‡РЅСѓСЋ (РєРЅРѕРїРєР° РЅР° РіР»Р°РІРЅРѕР№) */
async function openDialog(force = true) {
  try {
    const [fetched, installed] = await Promise.all([
      fetchModpackInfo(),
      getInstalledModpackVersion(),
    ])
    if (fetched) info.value = fetched
    currentVersion.value = installed
    if (force || !installed || (fetched && compareVersions(fetched.version, installed) > 0)) {
      show.value = true
    }
  } catch (e) {
    console.error(e)
    show.value = true
  }
}

async function onUpdate() {
  if (downloading.value) return
  downloading.value = true
  progressPct.value = 0
  progressLabel.value = 'РџРѕРґРіРѕС‚РѕРІРєР°вЂ¦'

  try {
    const result = await downloadAndInstallModpack()
    progressPct.value = 100
    progressLabel.value = 'Р“РѕС‚РѕРІРѕ'
    show.value = false
    notify({
      level: 'success',
      title: 'РЎР±РѕСЂРєР° ChaldStudio СѓСЃС‚Р°РЅРѕРІР»РµРЅР°!',
      body: 'Java 21 + СЃРµСЂРІРµСЂ chaldstudio.servop.ru',
    })
    emit('installed', result.instancePath)
  } catch (e: any) {
    notify({
      level: 'error',
      title: 'РћС€РёР±РєР° СѓСЃС‚Р°РЅРѕРІРєРё',
      body: e?.message || 'РџРѕРїСЂРѕР±СѓР№С‚Рµ РїРѕР·Р¶Рµ',
    })
  } finally {
    downloading.value = false
  }
}

function formatSize(bytes?: number) {
  if (!bytes) return '~215 MB'
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0
    const nb = pb[i] || 0
    if (na > nb) return 1
    if (na < nb) return -1
  }
  return 0
}

defineExpose({ checkForUpdate, openDialog })
</script>

<style scoped>
.win11-card {
  position: relative;
  overflow: hidden;
  border-radius: 16px;
  background: color-mix(in srgb, var(--color-surface, #202020) 90%, transparent);
  border: 1px solid color-mix(in srgb, #fff 10%, transparent);
  box-shadow:
    0 2px 4px color-mix(in srgb, #000 12%, transparent),
    0 24px 64px color-mix(in srgb, #000 34%, transparent),
    inset 0 1px 0 color-mix(in srgb, #fff 8%, transparent);
  font-family: 'Segoe UI Variable', 'Segoe UI', system-ui, sans-serif;
  color: var(--color-on-surface, #fff);
  animation: card-in 0.42s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes card-in {
  from { opacity: 0; transform: translateY(14px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

.win11-aurora {
  position: absolute;
  inset: -40% -20%;
  pointer-events: none;
  background:
    radial-gradient(38% 45% at 15% 20%, color-mix(in srgb, var(--color-accent, #60cdff) 26%, transparent), transparent 70%),
    radial-gradient(34% 40% at 85% 75%, color-mix(in srgb, #a78bfa 18%, transparent), transparent 70%);
  filter: blur(30px);
  opacity: 0.55;
  animation: aurora-drift 14s ease-in-out infinite;
}
@keyframes aurora-drift {
  0%, 100% { transform: translate3d(0, 0, 0) rotate(0deg); }
  50% { transform: translate3d(2%, -3%, 0) rotate(4deg); }
}

.win11-acrylic {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(
    165deg,
    color-mix(in srgb, var(--color-accent, #60cdff) 10%, transparent) 0%,
    transparent 42%
  );
}
.win11-accent-glow {
  position: absolute;
  top: -30%;
  right: -25%;
  width: 70%;
  height: 70%;
  pointer-events: none;
  border-radius: 50%;
  background: radial-gradient(
    circle at center,
    color-mix(in srgb, var(--color-accent, #60cdff) 22%, transparent),
    transparent 70%
  );
  opacity: 0.35;
  transition: opacity 0.4s ease;
}
.is-installing .win11-accent-glow {
  opacity: 0.75;
}
.win11-sheen {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(
    115deg,
    transparent 30%,
    color-mix(in srgb, #fff 6%, transparent) 45%,
    transparent 60%
  );
  background-size: 250% 250%;
  animation: sheen-sweep 6s ease-in-out infinite;
}
@keyframes sheen-sweep {
  0% { background-position: 120% 0%; }
  50%, 100% { background-position: -20% 0%; }
}

/* Р›РѕРіРѕС‚РёРї */
.logo-badge {
  position: relative;
  flex-grow: 0;
  flex-shrink: 0;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.logo-img {
  border-radius: 12px;
  box-shadow: 0 4px 14px color-mix(in srgb, #000 30%, transparent);
}
.logo-badge-ring {
  position: absolute;
  inset: -4px;
  border-radius: 14px;
  border: 1.5px solid color-mix(in srgb, var(--color-accent, #60cdff) 55%, transparent);
  opacity: 0;
  transition: opacity 0.3s ease;
}
.logo-badge.pulsing .logo-badge-ring {
  opacity: 1;
  animation: ring-pulse 1.6s ease-in-out infinite;
}
@keyframes ring-pulse {
  0%, 100% { transform: scale(1); opacity: 0.85; }
  50% { transform: scale(1.12); opacity: 0.25; }
}

.chip-pop {
  animation: chip-pop-in 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}
@keyframes chip-pop-in {
  from { opacity: 0; transform: scale(0.7); }
  to { opacity: 1; transform: scale(1); }
}

.meta-row {
  flex-wrap: wrap;
}
.meta-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 11px;
  border-radius: 999px;
  font-size: 12px;
  background: color-mix(in srgb, #fff 6%, transparent);
  border: 1px solid color-mix(in srgb, #fff 8%, transparent);
  opacity: 0.85;
}
.meta-pill.accent {
  background: color-mix(in srgb, var(--color-accent, #60cdff) 16%, transparent);
  border-color: color-mix(in srgb, var(--color-accent, #60cdff) 30%, transparent);
  color: color-mix(in srgb, var(--color-accent, #60cdff) 85%, #fff);
  opacity: 1;
}

.changelog-item {
  animation: item-in 0.3s ease backwards;
  animation-delay: calc(var(--i) * 0.05s);
}
@keyframes item-in {
  from { opacity: 0; transform: translateX(-6px); }
  to { opacity: 1; transform: translateX(0); }
}

/* РўСЂРµРєРµСЂ СЃС‚Р°РґРёР№ СѓСЃС‚Р°РЅРѕРІРєРё */
.stage-track {
  display: flex;
  align-items: center;
  gap: 4px;
}
.stage-step {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
  opacity: 0.4;
  transition: opacity 0.3s ease;
}
.stage-step.done,
.stage-step.active {
  opacity: 1;
}
.stage-dot {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, #fff 8%, transparent);
  border: 1px solid color-mix(in srgb, #fff 12%, transparent);
  transition: all 0.3s ease;
}
.stage-step.done .stage-dot {
  background: color-mix(in srgb, var(--color-accent, #60cdff) 85%, transparent);
  border-color: transparent;
  color: #06231e;
}
.stage-step.active .stage-dot {
  background: color-mix(in srgb, var(--color-accent, #60cdff) 25%, transparent);
  border-color: color-mix(in srgb, var(--color-accent, #60cdff) 60%, transparent);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--color-accent, #60cdff) 14%, transparent);
  animation: dot-breathe 1.4s ease-in-out infinite;
}
@keyframes dot-breathe {
  0%, 100% { box-shadow: 0 0 0 4px color-mix(in srgb, var(--color-accent, #60cdff) 14%, transparent); }
  50% { box-shadow: 0 0 0 7px color-mix(in srgb, var(--color-accent, #60cdff) 6%, transparent); }
}
.stage-label {
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  opacity: 0.85;
}

.progress-block {
  padding: 12px 14px;
  border-radius: 10px;
  background: color-mix(in srgb, #fff 4%, transparent);
  border: 1px solid color-mix(in srgb, #fff 6%, transparent);
}
.progress-track-outer {
  border-radius: 999px;
  overflow: hidden;
}
.glow-progress :deep(.v-progress-linear__determinate) {
  box-shadow: 0 0 10px color-mix(in srgb, var(--color-accent, #60cdff) 70%, transparent);
}

.cta-btn {
  box-shadow: 0 4px 18px color-mix(in srgb, var(--color-accent, #60cdff) 35%, transparent);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.cta-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 22px color-mix(in srgb, var(--color-accent, #60cdff) 45%, transparent);
}

@media (prefers-reduced-motion: reduce) {
  .win11-card,
  .win11-aurora,
  .win11-sheen,
  .logo-badge-ring,
  .chip-pop,
  .changelog-item,
  .stage-step.active .stage-dot {
    animation: none !important;
  }
}
</style>

