/**
 * @module @mattduffy/koa-migrations
 * @author Matthew Duffy <mattduffy@gmail.com>
 * @file src/migration.js The Migration class definition file.
 */

import path from 'node:path'
import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import EventEmitter from 'node:events'
import Debug from 'debug'

const error = Debug('migrations:class_error')
const log = Debug('migrations:class_log')

/**
 * A class providing db schema migration apply and rollback methods.
 * @summary A class providing db schema migration apply and rollback methods.
 * @class Migration
 * @author Matthew Duffy <mattduffy@gmail.com>
 */

export default class Migration extends EventEmitter {
  #migrations = []

  #stamp() {
    return Math.floor(new Date().getTime() / 1000)
  }

  constructor(options = {}) {
    super()
    log('Migration constructor')
    this._dir = options?.dir || null
    this._dbPath = options?.db || null
    this._fileExt = options?.fileExt || 'json'
    this._client = null
    this.ObjectId = null
    this._db = null
  }

  /**
   * Import the db connection and connect.
   * @summary Import the db connection and connect.
   * @async
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @throws {Error}
   * @return {object} Return this instance with db connected
   */
  async init() {
    if (!this._dbPath) {
      log('Missing db path')
      throw new Error('Missing db path')
    }
    try {
      // log(this._dbPath)
      // log(process.cwd())
      const { client, ObjectId } = await import(this._dbPath)
      this._client = client
      this._ObjectId = ObjectId
      await this._client.connect()
    } catch (e) {
      error('Failed to import db connection.')
      throw new Error('Failed to import db connection.')
    }
    try {
      const files = await fs.readdir(this._dir)
      log(files)
      if (files.length === 0) {
        // there are no migration files to apply
        return {
          status: 'done',
          updates_applied: 0,
          rollbacks_applied: 0,
          timestamp: this.#stamp(),
        }
      }
      //
      // loop over the files in dir and parse for migration details
      //
    } catch (e) {
      error(e)
      error(`Failed to read contents of ${this._dir}`)
      throw new Error(`Failed to read contents of ${this._dir}`)
    }
    return this
  }
}
