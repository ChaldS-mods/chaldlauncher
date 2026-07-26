<template>
  <div class="w-full win-taskbar-wrap">
    <div class="win-taskbar">
      <div class="win-taskbar-left">
        <HomeFooterCard />
      </div>
      <div class="win-taskbar-center">
        <HomeLaunchButtonStatus
          class="status-chip"
          :active="active"
        />
      </div>
      <div
        key="launch-button-group"
        class="win-taskbar-right"
        @mouseenter="active = true"
        @mouseleave="active = false"
      >
        <HomeLaunchButton top />
      </div>
    </div>
  </div>
</template>
<script lang="ts" setup>
import HomeLaunchButton from './HomeLaunchButton.vue'
import HomeLaunchButtonStatus from './HomeLaunchButtonStatus.vue'
import HomeFooterCard from './HomeFooterCard.vue'

const active = ref(false)
</script>

<style>
.tabs>div[role="tablist"] {
  background: var(--color-sidebar-bg) !important;
  backdrop-filter: blur(var(--blur-card));
}
</style>
<style scoped>
.win-taskbar-wrap {
  padding: 0 16px 12px;
  pointer-events: none;
}
.win-taskbar {
  position: relative;
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 64px;
  padding: 8px 14px;
  border-radius: 16px;
  background: color-mix(in srgb, var(--color-surface, #1c1c1e) 78%, transparent);
  border: 1px solid color-mix(in srgb, #fff 12%, transparent);
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.35),
    0 0 0 1px color-mix(in srgb, var(--color-accent, #60cdff) 6%, transparent),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(40px) saturate(1.4);
  -webkit-backdrop-filter: blur(40px) saturate(1.4);
  transition: box-shadow 0.3s ease;
}
.win-taskbar::before {
  content: '';
  position: absolute;
  inset: -1px;
  border-radius: 17px;
  pointer-events: none;
  background: linear-gradient(
    100deg,
    transparent,
    color-mix(in srgb, var(--color-accent, #60cdff) 22%, transparent),
    transparent
  );
  opacity: 0;
  transition: opacity 0.3s ease;
}
.win-taskbar:hover::before {
  opacity: 1;
}
.win-taskbar-left {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  align-items: center;
}
.win-taskbar-center {
  flex: 0 1 auto;
  display: flex;
  justify-content: center;
}
.win-taskbar-right {
  flex: 0 0 auto;
  display: flex;
  justify-content: flex-end;
  align-items: center;
}
.status-chip {
  margin: 0 4px;
}

@media (max-width: 850px) {
  .win-taskbar-wrap {
    padding: 0 8px 10px;
  }
  .win-taskbar {
    flex-wrap: wrap;
    border-radius: 14px;
  }
}
</style>
