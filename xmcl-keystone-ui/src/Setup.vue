<template>
  <AppMoodBackground
    v-if="!data.fetching"
    variant="ambient"
    data-testid="setup-root"
    class="setup flex h-full w-full flex-col overflow-hidden select-none"
  >
    <div class="setup-single flex h-full min-h-0 flex-col overflow-hidden">
      <div class="setup-pane-wrap flex-1 min-h-0 overflow-auto">
        <AppMoodSurface fill>
          <SetupAccount
            :loading="data.loading"
            @skip="setup"
          />
        </AppMoodSurface>
      </div>
      <slot name="actions">
        <SetupFooter
          :prev="false"
          next
          finish
          :loading="data.loading"
          @next="setup"
        />
      </slot>
    </div>
  </AppMoodBackground>
  <v-card
    v-else
    class="flex h-full w-full items-center justify-center"
  >
    <v-img
      class="max-w-50"
      src="http://launcher/icons/logoDark"
    />
  </v-card>
</template>

<script lang="ts" setup>
import AppMoodBackground from '@/components/AppMoodBackground.vue'
import AppMoodSurface from '@/components/AppMoodSurface.vue'
import { useService } from '@/composables'
import { kSettingsState } from '@/composables/setting'
import { BackgroundType, kTheme } from '@/composables/theme'
import { injection } from '@/util/inject'
import { BaseServiceKey } from '@xmcl/runtime-api'
import SetupAccount from './SetupAccount.vue'
import SetupFooter from './SetupFooter.vue'

const emit = defineEmits(['ready'])
const { getEnvironment } = useService(BaseServiceKey)

const { locale } = useI18n()

const data = reactive({
  fetching: true,
  minecraftPath: '',
  instancePath: '',
  path: '',
  loading: false,
})
provide('setup', data)

// Язык, тема и папка игры больше не спрашиваются в мастере — они уже
// выбираются в кастомном инсталляторе до первого запуска. Здесь просто
// молча берём системные значения по умолчанию:
//  - path: defaultPath, который отдаёт бэкенд (та же папка, что раньше
//    предлагалась на шаге "куда установить игру");
//  - locale: системная локаль ОС;
//  - theme: системная (dark/light), см. updateTheme('system') ниже.
bootstrap.preset().then(({ minecraftPath, defaultPath, locale: locale_ }) => {
  data.fetching = false
  if (locale_.startsWith('en')) {
    locale_ = 'en'
  }
  locale.value = locale_
  data.minecraftPath = minecraftPath
  data.instancePath = minecraftPath
  data.path = defaultPath
})

const { isDark, currentTheme, saveCurrentTheme } = injection(kTheme)

const updateTheme = (theme: 'dark' | 'system' | 'light') => {
  if (theme === 'system') {
    currentTheme.value.dark = window.matchMedia('(prefers-color-scheme: dark)').matches
  } else if (theme === 'dark') {
    currentTheme.value.dark = true
  } else {
    currentTheme.value.dark = false
  }
}

updateTheme('system')

const { state } = injection(kSettingsState)

async function persistInitialTheme() {
  // The wizard mutates `currentTheme` in-place when it picks defaults
  // (dark mode + Halo background on GPU machines). `useTheme()` does not
  // auto-persist those mutations, so we must explicitly save here —
  // otherwise the first launch shows Halo but `theme.json` is never
  // written and the next launch falls back to `BackgroundType.NONE`.
  try {
    const e = await getEnvironment()
    if (e.gpu && isDark.value) {
      currentTheme.value.backgroundType = BackgroundType.HALO
    }
  } catch (err) {
    console.error('Failed to detect environment during setup', err)
  }
  try {
    await saveCurrentTheme()
  } catch (err) {
    console.error('Failed to persist initial theme during setup', err)
  }
}

async function setup() {
  if (data.loading) return
  data.loading = true
  try {
    await bootstrap.bootstrap(data.path)
  } catch (err) {
    data.loading = false
    throw err
  }
  emit('ready', data)
  if (state.value) {
    state.value.localeSet(locale.value)
  } else {
    const dismiss = watch(state, (s) => {
      if (s) {
        s.localeSet(locale.value)
        dismiss()
      }
    })
  }
  // Environment detection may wait on the network. It should never block the
  // user from leaving onboarding after the data root has been accepted.
  void persistInitialTheme()
}
</script>

<style>
.setup-pane-wrap {
  padding: 12px 16px 16px;
}

@media (prefers-reduced-motion: reduce) {
  .setup-single {
    transition: none;
  }
}
</style>
