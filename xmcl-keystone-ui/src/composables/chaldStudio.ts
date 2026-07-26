import { useService } from '@/composables'
import { ChaldStudioServiceKey } from '@xmcl/runtime-api'
import { ref, readonly } from 'vue'
import { useNotifier } from './notifier'

export function useChaldStudioModpack() {
  const { downloadAndInstallModpack } = useService(ChaldStudioServiceKey)
  const { notify } = useNotifier()

  const downloading = ref(false)

  async function downloadAndInstall() {
    if (downloading.value) return

    downloading.value = true

    try {
      const result = await downloadAndInstallModpack()

      notify({
        level: 'success',
        title: '✅ Сборка ChaldStudio установлена!',
        body: 'Сервер: chaldstudio.servop.ru — играй с нами!',
      })

      return result
    } catch (e: any) {
      notify({
        level: 'error',
        title: '❌ Ошибка при скачивании сборки',
        body: e?.message || 'Неизвестная ошибка. Попробуй позже или скачай вручную.',
      })
      throw e
    } finally {
      downloading.value = false
    }
  }

  return {
    downloading: readonly(downloading),
    downloadAndInstall,
  }
}
