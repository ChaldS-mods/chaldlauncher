import { appInsights } from '@/telemetry'
import { useService } from './service'
import { BaseServiceKey, SharedState, Settings } from '@xmcl/runtime-api'
import { Ref } from 'vue'

// `settings` is kept in the signature so callers don't need to change,
// but it's no longer read here: telemetry is hard-disabled in
// `@/telemetry` (disableTelemetry: true), so there's nothing to toggle
// based on the user's settings anymore.
export function useTelemetryTrack(_settings: Ref<SharedState<Settings> | undefined>) {
  const { getEnvironment, getSessionId } = useService(BaseServiceKey)
  getEnvironment().then(({ version, build }) => {
    appInsights.context.application.ver = version
    appInsights.context.application.build = build.toString()
  })
  getSessionId().then((sessionId) => {
    appInsights.context.user.id = sessionId
    appInsights.context.session.id = sessionId
  })
}
