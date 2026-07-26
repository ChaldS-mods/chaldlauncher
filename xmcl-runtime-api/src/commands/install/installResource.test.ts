import { describe, test, expect, vi } from 'vitest'
import { assertInstallable, installResource, MarketRefInputSchema } from './installResource'
import { InstanceModsServiceKey } from '../../services/InstanceModsService'
import type { CommandContext } from '../types'

function makeCtx(callImpl: (key: string, method: string, ...args: any[]) => any): CommandContext {
  return {
    mode: 'cli',
    signal: new AbortController().signal,
    call: vi.fn((key: any, method: any, ...args: any[]) => Promise.resolve(callImpl(String(key), String(method), ...args))) as any,
    state: vi.fn() as any,
    resolveInstance: vi.fn() as any,
    resolveUser: vi.fn() as any,
    pickInstance: vi.fn() as any,
    pickUser: vi.fn() as any,
    prompt: vi.fn() as any,
    confirm: vi.fn() as any,
    select: vi.fn() as any,
    task: ((_n: string, run: any) => run({ update: () => {}, child: () => ({} as any) })) as any,
    out: { log: vi.fn(), json: vi.fn(), table: vi.fn() },
  }
}

describe('MarketRefInputSchema', () => {
  test('coerces string forms', () => {
    expect(MarketRefInputSchema.parse('modrinth:fabric-api@1.0')).toEqual({ source: 'modrinth', project: 'fabric-api', version: '1.0' })
    expect(MarketRefInputSchema.parse('curseforge:1/2')).toEqual({ source: 'curseforge', project: 1, file: 2 })
    expect(MarketRefInputSchema.parse('./local.jar')).toEqual({ source: 'file', path: './local.jar' })
  })

  test('passes through object form', () => {
    expect(MarketRefInputSchema.parse({ source: 'modrinth', project: 'sodium' }))
      .toEqual({ source: 'modrinth', project: 'sodium' })
  })
})

describe('assertInstallable', () => {
  test('rejects modrinth without version', () => {
    expect(() => assertInstallable({ source: 'modrinth', project: 'sodium' })).toThrow(/version/)
  })

  test('rejects curseforge without file', () => {
    expect(() => assertInstallable({ source: 'curseforge', project: 1 })).toThrow(/fileId/)
  })

  test('accepts complete refs', () => {
    expect(() => assertInstallable({ source: 'modrinth', project: 'sodium', version: '1' })).not.toThrow()
    expect(() => assertInstallable({ source: 'curseforge', project: 1, file: 2 })).not.toThrow()
    expect(() => assertInstallable({ source: 'file', path: '/a' })).not.toThrow()
    expect(() => assertInstallable({ source: 'url', url: 'https://x' })).not.toThrow()
  })
})

describe('installResource', () => {
  test('modrinth ref → installFromMarket with Modrinth shape', async () => {
    const ctx = makeCtx((key, method, ...args) => {
      expect(String(key)).toBe(String(InstanceModsServiceKey))
      expect(method).toBe('installFromMarket')
      expect(args[0]).toEqual({
        market: 0,
        version: { versionId: '0.105' },
        instancePath: '/i',
      })
      return ['/i/mods/x.jar']
    })
    const result = await installResource(ctx, InstanceModsServiceKey, '/i', { source: 'modrinth', project: 'fabric-api', version: '0.105' })
    expect(result).toEqual(['/i/mods/x.jar'])
  })

  test('curseforge ref → installFromMarket with CurseForge shape', async () => {
    const ctx = makeCtx((_k, method, ...args) => {
      expect(method).toBe('installFromMarket')
      expect(args[0]).toEqual({
        market: 1,
        file: { fileId: 999 },
        instancePath: '/i',
      })
      return ['/i/mods/y.jar']
    })
    await installResource(ctx, InstanceModsServiceKey, '/i', { source: 'curseforge', project: 1, file: 999 })
  })

  test('file ref → install with local path', async () => {
    const ctx = makeCtx((_k, method, ...args) => {
      expect(method).toBe('install')
      expect(args[0]).toEqual({ path: '/i', files: ['./local.jar'] })
      return ['/i/mods/local.jar']
    })
    await installResource(ctx, InstanceModsServiceKey, '/i', { source: 'file', path: './local.jar' })
  })

  test('url ref throws (not yet supported)', async () => {
    const ctx = makeCtx(() => undefined)
    await expect(installResource(ctx, InstanceModsServiceKey, '/i', { source: 'url', url: 'https://x' }))
      .rejects.toThrow(/URL/)
  })
})
