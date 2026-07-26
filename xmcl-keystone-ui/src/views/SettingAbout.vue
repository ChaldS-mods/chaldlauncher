<template>
  <section class="about">
    <SettingCard>
      <div class="pa-4">
        <!-- Logo & Header info -->
        <div class="d-flex align-center flex-wrap gap-4 mb-6">
          <v-img
            :src="logo"
            alt="ChaldLauncher Logo"
            width="64"
            height="64"
            class="mr-4 rounded-lg flex-grow-0 flex-shrink-0"
          ></v-img>
          <div>
            <div
              class="text-h5 font-weight-bold"
            >
              ChaldLauncher
            </div>
            <div class="text-caption opacity-60 mt-1">
              Твой Майнкрафт лаунчер
            </div>
          </div>
          <v-spacer />
          <v-chip
            size="small"
            variant="tonal"
            color="primary"
            class="font-mono"
          >
            v{{ version }}
          </v-chip>
        </div>

        <!-- Debug Info Box -->
        <div class="mb-8">
          <div class="text-subtitle-2 font-weight-bold mb-2 opacity-80">
            {{ t('setting.about') }}
          </div>
          <pre
            class="debug-info-code pa-4 text-caption font-mono"
          ><code>{{ debugInfo }}</code></pre>
        </div>

        <v-divider class="my-6 opacity-20" />

        <!-- Игровой сервер -->
        <div class="mb-8">
          <h3 class="text-subtitle-1 font-weight-bold text-center mb-4">
            Подключайся к серверу
          </h3>
          <div class="flex justify-center">
            <v-btn
              class="font-mono"
              variant="outlined"
              color="primary"
              size="large"
              rounded="pill"
              prepend-icon="dns"
              href="https://chaldstudio.servop.ru"
              target="_blank"
            >
              chaldstudio.servop.ru
            </v-btn>
          </div>
        </div>

        <v-divider class="my-6 opacity-20" />
      </div>
    </SettingCard>
  </section>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import SettingCard from '@/components/SettingCard.vue'
import { kEnvironment } from '@/composables/environment'
import { kFlights } from '@/composables/flights'
import { injection } from '@/util/inject'
import logo from '../assets/chald-logo.png'

const env = injection(kEnvironment)
const flights = injection(kFlights)

const debugInfo = computed(() => {
  return JSON.stringify({ ...env.value, flights }, null, 2)
})

const { t } = useI18n()
const version = computed(() => env.value?.version ?? '')
</script>

<style scoped>
.debug-info-code {
  background: rgba(0, 0, 0, 0.25);
  border: var(--card-subsection-border);
  border-radius: var(--card-item-radius);
  color: rgba(var(--v-theme-on-surface), 0.85);
  max-height: 180px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
