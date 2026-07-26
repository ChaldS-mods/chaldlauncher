import { z } from 'zod'
import { defineCommand } from '../registry'
import { InstanceModsServiceKey } from '../../services/InstanceModsService'
import { InstanceResourcePacksServiceKey } from '../../services/InstanceResourcePacksService'
import { InstanceShaderPacksServiceKey } from '../../services/InstanceShaderPacksService'
import { InstanceSavesServiceKey } from '../../services/InstanceSavesService'
import { MarketRefInputSchema, assertInstallable, installResource } from './installResource'

const baseInputShape = {
  ref: MarketRefInputSchema,
  instance: z.string().min(1),
}

/** Install a mod (modrinth, curseforge, or local file) into an instance. */
export const installModCommand = defineCommand({
  id: 'mod.install',
  title: 'Install Mod',
  description: 'Install a mod from Modrinth, CurseForge, or a local file path.',
  category: 'mod',
  input: z.object(baseInputShape),
  cli: {
    name: 'install-mod',
    positionals: ['ref'],
    flags: { instance: { alias: 'i', description: 'Instance path or name' } },
  },
  ui: { icon: 'extension' },
  async handler(input, ctx) {
    assertInstallable(input.ref)
    const inst = await ctx.resolveInstance(input.instance)
    const installed = await ctx.task('Install Mod', () => installResource(ctx, InstanceModsServiceKey, inst.path, input.ref))
    ctx.out.log(`Installed ${installed.length} file(s) to ${inst.path}/mods`)
    ctx.out.json({ ok: true, command: 'mod.install', data: { files: installed, instance: inst.path } })
    return installed
  },
})

/** Install a resourcepack into an instance. */
export const installResourcePackCommand = defineCommand({
  id: 'resourcepack.install',
  title: 'Install Resource Pack',
  description: 'Install a resource pack from Modrinth, CurseForge, or a local file path.',
  category: 'resourcepack',
  input: z.object(baseInputShape),
  cli: {
    name: 'install-resourcepack',
    positionals: ['ref'],
    flags: { instance: { alias: 'i', description: 'Instance path or name' } },
  },
  ui: { icon: 'palette' },
  async handler(input, ctx) {
    assertInstallable(input.ref)
    const inst = await ctx.resolveInstance(input.instance)
    const installed = await ctx.task('Install ResourcePack', () => installResource(ctx, InstanceResourcePacksServiceKey, inst.path, input.ref))
    ctx.out.log(`Installed ${installed.length} file(s) to ${inst.path}/resourcepacks`)
    ctx.out.json({ ok: true, command: 'resourcepack.install', data: { files: installed, instance: inst.path } })
    return installed
  },
})

/** Install a shaderpack into an instance. */
export const installShaderPackCommand = defineCommand({
  id: 'shaderpack.install',
  title: 'Install Shader Pack',
  description: 'Install a shader pack from Modrinth, CurseForge, or a local file path.',
  category: 'shaderpack',
  input: z.object(baseInputShape),
  cli: {
    name: 'install-shaderpack',
    positionals: ['ref'],
    flags: { instance: { alias: 'i', description: 'Instance path or name' } },
  },
  ui: { icon: 'auto_awesome' },
  async handler(input, ctx) {
    assertInstallable(input.ref)
    const inst = await ctx.resolveInstance(input.instance)
    const installed = await ctx.task('Install ShaderPack', () => installResource(ctx, InstanceShaderPacksServiceKey, inst.path, input.ref))
    ctx.out.log(`Installed ${installed.length} file(s) to ${inst.path}/shaderpacks`)
    ctx.out.json({ ok: true, command: 'shaderpack.install', data: { files: installed, instance: inst.path } })
    return installed
  },
})

/** Install a save into an instance. */
export const installSaveCommand = defineCommand({
  id: 'save.install',
  title: 'Install Save',
  description: 'Install a save (world) from Modrinth, CurseForge, or a local file path.',
  category: 'save',
  input: z.object(baseInputShape),
  cli: {
    name: 'install-save',
    positionals: ['ref'],
    flags: { instance: { alias: 'i', description: 'Instance path or name' } },
  },
  ui: { icon: 'public' },
  async handler(input, ctx) {
    assertInstallable(input.ref)
    const inst = await ctx.resolveInstance(input.instance)
    const installed = await ctx.task('Install Save', () => installResource(ctx, InstanceSavesServiceKey, inst.path, input.ref))
    ctx.out.log(`Installed ${installed.length} file(s) to ${inst.path}/saves`)
    ctx.out.json({ ok: true, command: 'save.install', data: { files: installed, instance: inst.path } })
    return installed
  },
})
