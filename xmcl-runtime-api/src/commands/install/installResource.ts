import { z } from 'zod'
import type { CommandContext } from '../types'
import type { MarketRef } from '../types'
import type { ServiceKey } from '../../services/Service'
import type { InstanceResourcesService } from '../../services/InstanceResourcesService'
import { MarketRefSchema, parseMarketRef } from '../marketRef'
import { MarketType } from '../../entities/market'

/**
 * CLI-friendly market reference: accepts either the JSON object form or a
 * string like `modrinth:fabric-api@0.105` / `curseforge:238222/4567890` /
 * `./mods/x.jar` / `https://...`.
 */
export const MarketRefInputSchema = z.union([
  z.string().min(1).transform((s) => parseMarketRef(s)),
  MarketRefSchema,
])

/**
 * Drive the right service path for a {@link MarketRef}.
 *
 * - `modrinth` / `curseforge` → `installFromMarket`
 * - `file` → `install` (local path)
 * - `url` → not yet implemented at the service level; the command returns
 *   a clear error rather than silently dropping the request.
 *
 * The service is selected by `serviceKey` so the helper is reusable for
 * mods, resourcepacks, shaderpacks and saves.
 */
export async function installResource(
  ctx: CommandContext,
  serviceKey: ServiceKey<InstanceResourcesService>,
  instancePath: string,
  ref: MarketRef,
): Promise<string[]> {
  switch (ref.source) {
    case 'modrinth':
      return ctx.call(serviceKey, 'installFromMarket', {
        market: MarketType.Modrinth,
        version: { versionId: ref.version ?? '' },
        instancePath,
      })
    case 'curseforge':
      return ctx.call(serviceKey, 'installFromMarket', {
        market: MarketType.CurseForge,
        file: { fileId: ref.file ?? 0 },
        instancePath,
      })
    case 'file':
      return ctx.call(serviceKey, 'install', { path: instancePath, files: [ref.path] })
    case 'url':
      throw new Error('Installing from a URL is not supported via CLI yet — download the file and pass the local path.')
  }
}

/**
 * Validation: modrinth refs need an explicit `version`, curseforge refs
 * need a `file`, otherwise the install would silently no-op. CLI users
 * can either supply the version inline or browse via the UI.
 */
export function assertInstallable(ref: MarketRef): void {
  if (ref.source === 'modrinth' && !ref.version) {
    throw new Error(`Missing version for modrinth:${ref.project}. Use modrinth:${ref.project}@<versionId>.`)
  }
  if (ref.source === 'curseforge' && !ref.file) {
    throw new Error(`Missing fileId for curseforge:${ref.project}. Use curseforge:${ref.project}/<fileId>.`)
  }
}
