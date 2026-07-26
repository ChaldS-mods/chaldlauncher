import { useEventBus } from '@vueuse/core'

export type UserMenuRequest = 'overview' | 'login'

export function useUserMenuControl() {
  const bus = useEventBus<UserMenuRequest>('user-menu-control')

  return {
    on: bus.on,
    show(mode: UserMenuRequest = 'overview') {
      bus.emit(mode)
    },
  }
}