/**
 * @module @mattduffy/koa-migrations
 * @author Matthew Duffy <mattduffy@gmail.com>
 * @file src/migration.js The Migration class definition file.
 */

import path from 'node:path'
import fs from 'node:fs'
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

  /* eslint-disable class-methods-use-this */
  #stamp() {
    return Math.floor(new Date().getTime() / 1000)
  }

  #schemasInDb

  #migrationDirs = []

  #todo = []

  #result = {
    status: null,
    migrations_found: 0,
    updates_applied: 0,
    updates_skipped: 0,
    rollbacks_applied: 0,
    rollbacks_skipped: 0,
    timestamp: null,
  }

  constructor(options = {}) {
    super()
    log('Migration constructor')
    this._dir = options?.dir ?? null
    this._dbPath = options?.db ?? null
    this._dbName = options?.db_name ?? 'test'
    this._dbCollection = options?.db_collection ?? 'migrations'
    this._fileExt = options?.fileExt ?? 'json'
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
    } catch (e) {
      error('Failed to import db connection.')
      throw new Error('Failed to import db connection.')
    }
    try {
      this.#migrationDirs = fs.readdirSync(this._dir, { withFileTypes: true })
        .filter((dirent) => dirent.isDirectory())
        .map((name) => {
          const p = path.resolve(this._dir, name.name)
          this.#todo.push({ name: name.name, files: fs.readdirSync(p, { withFileTypes: true }).map((f) => path.resolve(p, f.name)) })
          return p
        })
      if (this.#migrationDirs.length === 0) {
        // there are no migration files to apply
        this.#result.status = 'done'
        // this.#result.migrations_found = 0
        // this.#result.updates_applied = 0
        // this.#result.updates_skipped = 0
        // this.#result.rollbacks_applied = 0
        // this.#result.rollbacks_skipped = 0
        this.#result.timestamp = this.#stamp()
      } else {
        // loop over the files in dir and parse for migration details
      }
    } catch (e) {
      error(e)
      error(`Failed to read contents of ${this._dir}`)
      throw new Error(`Failed to read contents of ${this._dir}`)
    }
    if (this.#schemasInDb.length < 1 || this.#migrationDirs.length < 1) {
      log('No schemas currently tracked in the migrations collection.')
      log(`No migrations currently located in ${this._dir}`)
    } else {
      log('Ready to run migrations.')
      // log(this.#schemasInDb)
      // log(this.migrationDirs)
      // log(this.migrationFiles)
    }
    return this
  }

  /**
   * Apply the updates from each migration file.
   * @summary Apply the updates from each migration file.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @return ...
   */
  update() {
    // log(this.migrationFiles)
    try {
      const notEmpty = this.#todo.filter((migrate) => migrate.files.length > 0)
        .map((x) => {
          log(x.files)
          return x.files
        })
        .map((y) => {
          y.map(async (s) => {
            const parsedFile = JSON.parse(fs.readFileSync(s).toString())
            log('parsed JSON: %O', parsedFile)
            const { collection, version } = parsedFile
            const { match, addField } = parsedFile.update
            const find = this._client.db().collection(collection)
            const cursor = await find.find(match)
            const count = await find.countDocuments(match)
            if (count !== 0) {
              log(`Running migration: ${collection}, ver ${version}`)
              log('Match: %O', match)
              log('Adding: %O', addField)
              log(`Matched ${count} documents to update.`)
              log(' ')
              // await cursor.forEach(log)
              this.#incUpdatesApplied()
            } else {
              log('huh?  what?')
              this.#incUpdatesSkipped()
            }
          })
        })
      // log(notEmpty)
    } catch (e) {
      error('Error during update: %O', e)
      throw new Error('Error during update: ', e)
    }
  }

  /**
   * Increment the updates applied field in the results object.
   * @summary Increment the updates applied field in the results object.
   * @private
   * @return undefined
   */
  #incUpdatesApplied() {
    this.#result.updates_applied += 1
  }

  /**
   * Increment the updates skipped field in the results object.
   * @summary Increment the updates skipped field in the results object.
   * @private
   * @return undefined
   */
  #incUpdatesSkipped() {
    this.#result.updates_skipped += 1
  }

  /**
   * Increment the rollbacks applied field in the results object.
   * @summary Increment the rollbacks applied field in the results object.
   * @private
   * @return undefined
   */
  #incRollbacksApplied() {
    this.#result.rollbacks_applied += 1
  }

  /**
   * Increment the rollbacks skipped field in the results object.
   * @summary Increment the rollbacks skipped field in the results object.
   * @private
   * @return undefined
   */
  #incRollbacksSkipped() {
    this.#result.rollbacks_skipped += 1
  }

  /**
   * Return the collection of migration files, if any.
   * @summary Return the collection of migration files, if any.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @return {array} Array of directory entries from reading each migration directory.
   */
  get migrationFiles() {
    return this.#todo
  }

  /**
   * Return the collection of migration directory, if any.
   * @summary Return the collection of migration directory, if any.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @return {array} Array of directory entries from reading the migrations directory.
   */
  get migrationDirs() {
    return this.#migrationDirs
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
