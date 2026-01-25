/**
 * Local OpenAPI/Swagger specification for Uptime Kuma Nuxt API
 * This provides API documentation without requiring the legacy backend
 */
export default defineEventHandler(async () => {
  return {
    openapi: '3.0.0',
    info: {
      title: 'Uptime Kuma API',
      version: '2.0.0',
      description: 'Uptime Kuma REST API for monitoring management. This API allows you to manage monitors, notifications, status pages, and more.',
      contact: {
        name: 'Uptime Kuma',
        url: 'https://github.com/louislam/uptime-kuma'
      }
    },
    servers: [
      {
        url: '/api',
        description: 'Uptime Kuma Nuxt API'
      }
    ],
    tags: [
      { name: 'Monitors', description: 'Monitor management endpoints' },
      { name: 'Notifications', description: 'Notification management endpoints' },
      { name: 'Status Pages', description: 'Status page management endpoints' },
      { name: 'Tags', description: 'Tag management endpoints' },
      { name: 'Maintenance', description: 'Maintenance window management' },
      { name: 'Settings', description: 'System settings endpoints' },
      { name: 'Auth', description: 'Authentication endpoints' }
    ],
    paths: {
      '/v1/monitors': {
        get: {
          tags: ['Monitors'],
          summary: 'Get all monitors',
          description: 'Retrieve a list of all monitors',
          responses: {
            '200': {
              description: 'List of monitors',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/Monitor' }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        post: {
          tags: ['Monitors'],
          summary: 'Create a new monitor',
          description: 'Create a new monitor with the specified configuration',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/MonitorInput' }
              }
            }
          },
          responses: {
            '201': {
              description: 'Monitor created successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: { $ref: '#/components/schemas/Monitor' }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/v1/monitors/{id}': {
        get: {
          tags: ['Monitors'],
          summary: 'Get a monitor by ID',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'integer' }
            }
          ],
          responses: {
            '200': {
              description: 'Monitor details',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Monitor' }
                }
              }
            },
            '404': { description: 'Monitor not found' }
          }
        },
        put: {
          tags: ['Monitors'],
          summary: 'Update a monitor',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'integer' }
            }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/MonitorInput' }
              }
            }
          },
          responses: {
            '200': { description: 'Monitor updated successfully' },
            '404': { description: 'Monitor not found' }
          }
        },
        delete: {
          tags: ['Monitors'],
          summary: 'Delete a monitor',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'integer' }
            }
          ],
          responses: {
            '200': { description: 'Monitor deleted successfully' },
            '404': { description: 'Monitor not found' }
          }
        }
      },
      '/v1/monitors/{id}/pause': {
        post: {
          tags: ['Monitors'],
          summary: 'Pause a monitor',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'integer' }
            }
          ],
          responses: {
            '200': { description: 'Monitor paused successfully' }
          }
        }
      },
      '/v1/monitors/{id}/resume': {
        post: {
          tags: ['Monitors'],
          summary: 'Resume a monitor',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'integer' }
            }
          ],
          responses: {
            '200': { description: 'Monitor resumed successfully' }
          }
        }
      },
      '/v1/notifications': {
        get: {
          tags: ['Notifications'],
          summary: 'Get all notifications',
          responses: {
            '200': {
              description: 'List of notifications',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/Notification' }
                  }
                }
              }
            }
          }
        },
        post: {
          tags: ['Notifications'],
          summary: 'Create a new notification',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/NotificationInput' }
              }
            }
          },
          responses: {
            '201': { description: 'Notification created successfully' }
          }
        }
      },
      '/v1/status-pages': {
        get: {
          tags: ['Status Pages'],
          summary: 'Get all status pages',
          responses: {
            '200': {
              description: 'List of status pages',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/StatusPage' }
                  }
                }
              }
            }
          }
        },
        post: {
          tags: ['Status Pages'],
          summary: 'Create a new status page',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/StatusPageInput' }
              }
            }
          },
          responses: {
            '201': { description: 'Status page created successfully' }
          }
        }
      },
      '/v1/tags': {
        get: {
          tags: ['Tags'],
          summary: 'Get all tags',
          responses: {
            '200': {
              description: 'List of tags',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/Tag' }
                  }
                }
              }
            }
          }
        },
        post: {
          tags: ['Tags'],
          summary: 'Create a new tag',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/TagInput' }
              }
            }
          },
          responses: {
            '201': { description: 'Tag created successfully' }
          }
        }
      },
      '/v1/maintenances': {
        get: {
          tags: ['Maintenance'],
          summary: 'Get all maintenance windows',
          responses: {
            '200': {
              description: 'List of maintenance windows',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/Maintenance' }
                  }
                }
              }
            }
          }
        },
        post: {
          tags: ['Maintenance'],
          summary: 'Create a new maintenance window',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/MaintenanceInput' }
              }
            }
          },
          responses: {
            '201': { description: 'Maintenance window created successfully' }
          }
        }
      },
      '/v1/settings': {
        get: {
          tags: ['Settings'],
          summary: 'Get system settings',
          responses: {
            '200': {
              description: 'System settings',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Settings' }
                }
              }
            }
          }
        }
      },
      '/auth/login': {
        post: {
          tags: ['Auth'],
          summary: 'Login',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['username', 'password'],
                  properties: {
                    username: { type: 'string' },
                    password: { type: 'string' }
                  }
                }
              }
            }
          },
          responses: {
            '200': { description: 'Login successful' },
            '401': { description: 'Invalid credentials' }
          }
        }
      },
      '/auth/logout': {
        post: {
          tags: ['Auth'],
          summary: 'Logout',
          responses: {
            '200': { description: 'Logout successful' }
          }
        }
      }
    },
    components: {
      schemas: {
        Monitor: {
          type: 'object',
          properties: {
            id: { type: 'integer', description: 'Unique identifier' },
            name: { type: 'string', description: 'Monitor name' },
            type: {
              type: 'string',
              enum: ['http', 'port', 'ping', 'keyword', 'dns', 'docker', 'push', 'steam', 'gamedig', 'mqtt', 'sqlserver', 'postgres', 'mysql', 'mongodb', 'radius', 'redis', 'group', 'grpc', 'json-query', 'real-browser', 'tailscale-ping', 'kafka-producer', 'manual'],
              description: 'Monitor type'
            },
            url: { type: 'string', description: 'URL to monitor' },
            interval: { type: 'integer', description: 'Check interval in seconds', minimum: 20 },
            active: { type: 'boolean', description: 'Whether monitor is active' },
            timeout: { type: 'integer', description: 'Request timeout in seconds' },
            retryInterval: { type: 'integer', description: 'Retry interval in seconds' },
            maxretries: { type: 'integer', description: 'Maximum retries' },
            method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'] },
            expectedStatusCodes: { type: 'array', items: { type: 'integer' } },
            keyword: { type: 'string', description: 'Keyword to search for' },
            hostname: { type: 'string', description: 'Hostname for port/ping monitors' },
            port: { type: 'integer', description: 'Port number' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        },
        MonitorInput: {
          type: 'object',
          required: ['name', 'type'],
          properties: {
            name: { type: 'string' },
            type: { type: 'string' },
            url: { type: 'string' },
            interval: { type: 'integer', minimum: 20, default: 60 },
            active: { type: 'boolean', default: true },
            timeout: { type: 'integer', default: 48 },
            retryInterval: { type: 'integer', default: 60 },
            maxretries: { type: 'integer', default: 0 },
            method: { type: 'string', default: 'GET' },
            expectedStatusCodes: { type: 'array', items: { type: 'integer' } },
            keyword: { type: 'string' },
            hostname: { type: 'string' },
            port: { type: 'integer' }
          }
        },
        Notification: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            name: { type: 'string' },
            type: { type: 'string' },
            isDefault: { type: 'boolean' },
            active: { type: 'boolean' }
          }
        },
        NotificationInput: {
          type: 'object',
          required: ['name', 'type', 'config'],
          properties: {
            name: { type: 'string' },
            type: { type: 'string' },
            isDefault: { type: 'boolean' },
            active: { type: 'boolean' },
            config: { type: 'object' }
          }
        },
        StatusPage: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            slug: { type: 'string' },
            title: { type: 'string' },
            description: { type: 'string' },
            published: { type: 'boolean' },
            showTags: { type: 'boolean' },
            theme: { type: 'string' }
          }
        },
        StatusPageInput: {
          type: 'object',
          required: ['slug', 'title'],
          properties: {
            slug: { type: 'string' },
            title: { type: 'string' },
            description: { type: 'string' },
            published: { type: 'boolean' },
            showTags: { type: 'boolean' },
            theme: { type: 'string' }
          }
        },
        Tag: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            name: { type: 'string' },
            color: { type: 'string' }
          }
        },
        TagInput: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string' },
            color: { type: 'string' }
          }
        },
        Maintenance: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            title: { type: 'string' },
            description: { type: 'string' },
            strategy: { type: 'string', enum: ['manual', 'single', 'recurring-interval', 'recurring-weekday', 'recurring-day-of-month', 'cron'] },
            active: { type: 'boolean' },
            startDate: { type: 'string', format: 'date-time' },
            endDate: { type: 'string', format: 'date-time' }
          }
        },
        MaintenanceInput: {
          type: 'object',
          required: ['title', 'strategy'],
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            strategy: { type: 'string' },
            active: { type: 'boolean' },
            startDate: { type: 'string', format: 'date-time' },
            endDate: { type: 'string', format: 'date-time' }
          }
        },
        Settings: {
          type: 'object',
          properties: {
            primaryBaseURL: { type: 'string' },
            steamAPIKey: { type: 'string' },
            tlsExpiryNotifyDays: { type: 'array', items: { type: 'integer' } },
            checkBeta: { type: 'boolean' },
            checkUpdate: { type: 'boolean' },
            keepDataPeriodDays: { type: 'integer' }
          }
        },
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string' }
          }
        }
      },
      securitySchemes: {
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'nuxt-session',
          description: 'Session cookie authentication'
        }
      }
    },
    security: [
      { cookieAuth: [] }
    ]
  }
})
