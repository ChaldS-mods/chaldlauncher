import { ServiceKey } from './Service'

/**
 * Информация о новой версии сборки, полученная с сайта
 */
export interface ChaldStudioUpdateInfo {
  /** Версия (например "8.2") */
  version: string
  /** Полное имя файла (например "sborka.8.2.zip") */
  fileName: string
  /** Размер в байтах */
  fileSize: number
  /** Прямая ссылка на скачивание с сервера */
  directUrl: string
  /** Ссылка на Google Drive (если есть) */
  googleDriveUrl?: string
  /** Список изменений */
  changelog: string[]
  /** URL страницы с которой спарсено */
  pageUrl: string
}

export interface ChaldStudioService {
  /**
   * Скачать страницу сборки, спарсить версию и все ссылки.
   * @returns информацию о сборке или null если не удалось загрузить
   */
  fetchModpackInfo(): Promise<ChaldStudioUpdateInfo | null>

  /**
   * Скачать сборку ChaldStudio и импортировать как новый инстанс.
   * Сначала пробует Google Drive, при ошибке — прямую ссылку с сервера.
   * @returns путь к созданному инстансу
   */
  downloadAndInstallModpack(): Promise<{ instancePath: string }>

  /**
   * Проверить установленную версию сборки (по файлу метаданных).
   * @returns текущую установленную версию или null
   */
  getInstalledModpackVersion(): Promise<string | null>

  /**
   * Записать установленную версию в метаданные.
   */
  setInstalledModpackVersion(version: string): Promise<void>
}

export const ChaldStudioServiceKey: ServiceKey<ChaldStudioService> = 'ChaldStudioService'
