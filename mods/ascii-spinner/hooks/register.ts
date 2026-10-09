import type { Register } from 'claude-code'

const UNMEASURED_TERMINAL_COLUMNS = 120

export const register: Register = on => {
  on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
    if (e.surface !== 'terminal') return next(e)
    const { Client } = $.ui.resolve(e)
    const columns = e.viewport?.columns ?? UNMEASURED_TERMINAL_COLUMNS
    return Client({ key: 'weaveworm', module: './weaveworm.ts', props: { columns } })
  })
}
