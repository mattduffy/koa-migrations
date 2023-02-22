/**
 * @module @mattduffy/koa-migrations
 * @author Matthew Duffy <mattduffy@gmail.com>
 * @file src/index.js The package entrypoint.
 */

import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import Debug from 'debug'
import Migration from './migration.js'

function migrations(options = {}, application = {}) {
  const MIGRATION_FILES_DIR = options?.dir || process.env.MIGRATION_FILES_DIR || 'migrations'
  const error = Debug('migrations:error')
  const log = Debug('migrations:log')
  let app
  let opts
  if (options && typeof options.use === 'function') {
    opts = application
    app = options
  } else {
    opts = options
    app = application
  }
  if (!app || typeof app.use !== 'function') {
    error('Required app instance not provided')
    throw new Error('Required app instance not provided')
  }
  if (!opts.db) {
    error('Required path to db client not provided')
    throw new Error('Required path to db client not provided')
  }
  log('Adding the db schema migrations middleware to the app.')
  log(`koa app root directory: ${app.root}`)
  const migrationsDir = path.resolve(`${app.root}`, MIGRATION_FILES_DIR)
  log(`koa migrations directory: ${migrationsDir}`)

  return async function runMigrations(ctx, next) {
    if (app.env === 'development') {
      try {
        const o = {
          dir: migrationsDir,
          db: opts.db,
        }
        let migrationRunner = new Migration(o)
        migrationRunner = await migrationRunner.init()
        await next()
      } catch (e) {
        error('Error during migrations')
      }
    }
  }
}

export {
  migrations,
}
