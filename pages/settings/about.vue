<template>
  <div class="section-card">
    <h5 class="text-lg font-semibold text-white mb-6">About</h5>

    <div class="flex items-center gap-4 mb-6">
      <div class="text-4xl"></div>
      <div>
        <h4 class="text-xl font-bold text-white">Uptime Kuma</h4>
        <span class="text-gray-400">Nuxt.js Edition</span>
      </div>
    </div>

    <div class="grid grid-cols-2 gap-4 mb-6">
      <div class="p-4 bg-gray-700 rounded-lg">
        <span class="text-sm text-gray-400 block">Version</span>
        <strong class="text-white">1.0.0-nuxt</strong>
      </div>
      <div class="p-4 bg-gray-700 rounded-lg">
        <span class="text-sm text-gray-400 block">Framework</span>
        <strong class="text-white">Nuxt.js 4</strong>
      </div>
      <div class="p-4 bg-gray-700 rounded-lg">
        <span class="text-sm text-gray-400 block">Database</span>
        <strong class="text-white">PostgreSQL + Prisma</strong>
      </div>
      <div class="p-4 bg-gray-700 rounded-lg">
        <span class="text-sm text-gray-400 block">UI Framework</span>
        <strong class="text-white">Tailwind CSS</strong>
      </div>
    </div>

    <div class="pt-4 border-t border-gray-700">
      <h6 class="text-white font-medium mb-3">Links</h6>
      <div class="space-y-2">
        <a href="https://github.com/louislam/uptime-kuma" target="_blank" class="block text-green-400 hover:underline">
          GitHub (Original)
        </a>
        <a href="https://uptime.kuma.pet/" target="_blank" class="block text-green-400 hover:underline">
          Documentation
        </a>
      </div>
    </div>
  </div>
</template>
