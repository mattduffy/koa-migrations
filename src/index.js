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
  const MIGRATION_FILES_DIR = options?.dir ?? process.env.MIGRATION_FILES_DIR ?? 'migrations'
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
  if (!opts.db_name) {
    error('Required path to db name not provided')
    throw new Error('Required db name not provided')
  }
  const migrationsDir = path.resolve(`${app.root}`, MIGRATION_FILES_DIR)
  opts.dir = migrationsDir
  log('Adding the db schema migrations middleware to the app.')
  log(`koa app root directory: ${app.root}`)
  log(`koa migrations directory: ${migrationsDir}`)

  if (app.env === 'development') {
    return async function migrationRunner(ctx, next) {
      // Need to figure out a means to protect this route before the session is recreated to
      // restore an authenticated admin-level user.
      // if (!ctx.state.isAuthenticated || ctx.state.user?.type !== 'Admin') {
      //   ctx.status = 401
      //   ctx.type = 'text/plain; charset=utf-8'
      //   ctx.body = 'Unauthorized'
      // }
      const match = /\/test\/migrations(?:\/)?([A-Za-z0-9._-]{3,30})?$/.exec(ctx.request.path)
      if (app.env === 'development' && match) {
        if (match[1]) {
          [, opts.only] = match
        }
        let result
        try {
          let runner = new Migration(opts)
          runner = await runner.init()
          // log(runner.migrationDirs)
          // log(runner.migrationFiles)
          result = await runner.update()
          // log('migration results: %O', result)
          log('migration results: %O', runner.results)
        } catch (e) {
          error('Error during migrations')
          error(e)
        }
        ctx.status = 200
        ctx.type = 'applicatin/json; charset=utf-8'
        ctx.body = result
      } else {
        await next()
      }
    }
  /* eslint-disable no-else-return */
  } else {
    return async function migrationNoop(ctx, next) {
      await next()
    }
  }
}

export {
  migrations,
}
