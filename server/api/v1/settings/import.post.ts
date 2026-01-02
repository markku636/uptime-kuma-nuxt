// API endpoint for importing backup data
import { defineEventHandler, readMultipartFormData, createError } from 'h3'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface ImportData {
  version: string
  monitors?: any[]
  notifications?: any[]
  tags?: any[]
  statusPages?: any[]
  maintenances?: any[]
  proxies?: any[]
  dockerHosts?: any[]
  settings?: any[]
}

export default defineEventHandler(async (event) => {
  try {
    const formData = await readMultipartFormData(event)
    
    if (!formData || !formData.length) {
      throw createError({
        statusCode: 400,
        message: 'No file uploaded'
      })
    }

    const file = formData.find(f => f.name === 'file')
    if (!file || !file.data) {
      throw createError({
        statusCode: 400,
        message: 'Invalid file'
      })
    }

    // Parse JSON data
    const content = file.data.toString('utf-8')
    const importData: ImportData = JSON.parse(content)

    // Validate version
    if (!importData.version) {
      throw createError({
        statusCode: 400,
        message: 'Invalid backup file format'
      })
    }

    const results = {
      monitors: 0,
      notifications: 0,
      tags: 0,
      statusPages: 0,
      maintenances: 0,
      proxies: 0,
      dockerHosts: 0,
      settings: 0
    }

    // Import in a transaction
    await prisma.$transaction(async (tx) => {
      // Import tags first (other entities may reference them)
      if (importData.tags?.length) {
        for (const tag of importData.tags) {
          await tx.tag.create({
            data: {
              name: tag.name,
              color: tag.color
            }
          })
          results.tags++
        }
      }

      // Import proxies
      if (importData.proxies?.length) {
        for (const proxy of importData.proxies) {
          await tx.proxy.create({
            data: {
              protocol: proxy.protocol,
              host: proxy.host,
              port: proxy.port,
              auth: proxy.auth,
              username: proxy.username,
              password: proxy.password,
              active: proxy.active ?? true
            }
          })
          results.proxies++
        }
      }

      // Import Docker hosts
      if (importData.dockerHosts?.length) {
        for (const host of importData.dockerHosts) {
          await tx.dockerHost.create({
            data: {
              name: host.name,
              connectionType: host.connectionType,
              dockerDaemon: host.dockerDaemon,
              dockerHost: host.dockerHost
            }
          })
          results.dockerHosts++
        }
      }

      // Import notifications
      if (importData.notifications?.length) {
        for (const notification of importData.notifications) {
          await tx.notification.create({
            data: {
              name: notification.name,
              type: notification.type,
              active: notification.active ?? true,
              isDefault: notification.isDefault ?? false,
              config: notification.config
            }
          })
          results.notifications++
        }
      }

      // Import monitors
      if (importData.monitors?.length) {
        for (const monitor of importData.monitors) {
          await tx.monitor.create({
            data: {
              name: monitor.name,
              type: monitor.type,
              url: monitor.url,
              hostname: monitor.hostname,
              port: monitor.port,
              interval: monitor.interval ?? 60,
              retryInterval: monitor.retryInterval ?? 60,
              maxRetries: monitor.maxRetries ?? 0,
              active: monitor.active ?? true,
              method: monitor.method,
              body: monitor.body,
              headers: monitor.headers,
              keyword: monitor.keyword,
              expectedValue: monitor.expectedValue,
              invertKeyword: monitor.invertKeyword ?? false,
              maxRedirects: monitor.maxRedirects ?? 10,
              ignoreTls: monitor.ignoreTls ?? false,
              timeout: monitor.timeout ?? 48
            }
          })
          results.monitors++
        }
      }

      // Import status pages
      if (importData.statusPages?.length) {
        for (const statusPage of importData.statusPages) {
          await tx.statusPage.create({
            data: {
              slug: statusPage.slug,
              title: statusPage.title,
              description: statusPage.description,
              theme: statusPage.theme ?? 'auto',
              published: statusPage.published ?? true,
              showTags: statusPage.showTags ?? false,
              customCSS: statusPage.customCSS,
              footerText: statusPage.footerText,
              showPoweredBy: statusPage.showPoweredBy ?? true
            }
          })
          results.statusPages++
        }
      }

      // Import maintenances
      if (importData.maintenances?.length) {
        for (const maintenance of importData.maintenances) {
          await tx.maintenance.create({
            data: {
              title: maintenance.title,
              description: maintenance.description,
              strategy: maintenance.strategy ?? 'single',
              active: maintenance.active ?? true,
              startDate: maintenance.startDate ? new Date(maintenance.startDate) : null,
              endDate: maintenance.endDate ? new Date(maintenance.endDate) : null
            }
          })
          results.maintenances++
        }
      }

      // Import settings
      if (importData.settings?.length) {
        for (const setting of importData.settings) {
          await tx.setting.upsert({
            where: { key: setting.key },
            update: { value: setting.value },
            create: { key: setting.key, value: setting.value }
          })
          results.settings++
        }
      }
    })

    return {
      success: true,
      message: 'Data imported successfully',
      results
    }
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      message: error.message || 'Failed to import data'
    })
  }
})
