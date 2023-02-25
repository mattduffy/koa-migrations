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

  #schemasInDb

  #migrationFiles = []

  #result = {
    status: null,
    migrations_found: null,
    updates_applied: null,
    rollbacks_applied: null,
    timestamp: null,
  }

  constructor(options = {}) {
    super()
    log('Migration constructor')
    this._dir = options?.dir || null
    this._dbPath = options?.db || null
    this._dbName = options?.db_name || 'test'
    this._dbCollection = options?.db_collection || 'migrations'
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
      const trackedSchemas = this._client.db(this._dbName).collection(this._dbCollection)
      this.#schemasInDb = await trackedSchemas.find().toArray()
      log(this.#schemasInDb)
    } catch (e) {
      error('Failed to import db connection.')
      throw new Error('Failed to import db connection.')
    }
    try {
      this.#migrationFiles = await fs.readdir(this._dir)
      log(this.#migrationFiles)
      if (this.#migrationFiles.length === 0) {
        // there are no migration files to apply
        this.#result.status = 'done'
        this.#result.migrations_found = 0
        this.#result.updates_applied = 0
        this.#result.rollbacks_applied = 0
        this.#result.timestamp = this.#stamp()
        // return this.#result
      } else {
        // loop over the files in dir and parse for migration details
      }
    } catch (e) {
      error(e)
      error(`Failed to read contents of ${this._dir}`)
      throw new Error(`Failed to read contents of ${this._dir}`)
    }
    try {
      if (this.#schemasInDb.length === 0) {
        log('No schemas currently tracked in the migrations collection.')
      }
    } catch (e) {

    }
    return this
  }

  /**
   * Return the collection of migration files from migrations directory, if any.
   * @summary Return the collection of migration files from the migrations directory, if any.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @return {array} Array of directory entries from reading the migrations directory.
   */
  get migrationFiles() {
    return this.#migrationFiles
  }

  /**
   * Return the cummulative results of running the migrations.
   * @summary Return the cummulative results of running the migrations.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @return {object} The object literal storing the process results.
   */
  get result() {
    return this.#result
  }
}
