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
    log('Migration constructor >> start')
    this._dir = options?.dir ?? null
    this._dbPath = options?.db ?? null
    this._dbName = options?.db_name ?? 'test'
    this._dbCollection = options?.db_collection ?? 'migrations'
    this._fileExt = options?.fileExt ?? 'json'
    this._client = null
    this.ObjectId = null
    this._db = null
    this._only = options?.only ?? null
    if (this._only) this.#result.only = this._only
    log('Migration constructor >> end')
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
    log('Migration init method >> start')
    if (!this._dbPath) {
      log('Missing db path')
      throw new Error('Missing db path')
    }
    try {
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
        .filter((onlyDir) => {
          log(onlyDir)
          log(`this->_only: ${this._only}`)
          if (this._only === undefined || this._only === null) {
            log(`${this._only}, ${onlyDir.name}`)
            return onlyDir
          }
          if (this._only !== undefined && this._only === onlyDir.name) {
            log('help')
            return onlyDir
          }
          log('false')
          return false
        })
        .map((name) => {
          const p = path.resolve(this._dir, name.name)
          this.#todo.push({ name: name.name, files: fs.readdirSync(p, { withFileTypes: true }).map((f) => path.resolve(p, f.name)) })
          return p
        })
      if (this.#migrationDirs.length === 0) {
        // there are no migration files to apply
        this.#result.status = 'done'
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
    log('Migration init method >> end')
    return this
  }

  /**
   * Apply the updates from each migration file.
   * @summary Apply the updates from each migration file.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @return ...
   */
  async update() {
    log('Migration update method >> start')
    // log(this.migrationFiles)
    try {
      const notEmpty = this.#todo.filter((migrate) => {
        if (migrate.files.length > 0) {
          return true
        }
        this.#incUpdatesSkipped()
        return false
      })
      notEmpty.map((x) => {
        log(x.files)
        return x.files
      })
      error(notEmpty)
      const parsedFilesArray = await notEmpty.map(async (schemaDir) => {
        await schemaDir.files.map(async (schema) => {
          const parsedFile = JSON.parse(fs.readFileSync(schema).toString())
          log('parsed JSON: %O', parsedFile)
          const { collection, version } = parsedFile
          const { match, addField } = parsedFile.update
          const find = this._client.db().collection(collection)
          const cursor = await find.find(match)
          // const count = await find.countDocuments(match)
          error(`count: ${collection} ${cursor.matchedCount}`)
          if (cursor.matchedCount !== 0) {
            log(`Running migration: ${collection}, ver ${version}`)
            log('Match: %O', match)
            log('Adding: %O', addField)
            // log(`Matched ${count} documents to update.`)
            log(' ')
            // await cursor.forEach(log)
            this.#incUpdatesApplied()
            this.#result.timestamp = this.#stamp()
          } else {
            log('huh?  what?')
            this.#incUpdatesSkipped()
          }
        })
        return this.results
      })
      error(parsedFilesArray)
      log('Migration update method >> end')
      return notEmpty
    } catch (e) {
      error('Error during update: %O', e)
      throw new Error('Error during update: ', e)
    }
  }

  /**
   * Return the result of running migrations.
   * @summary Return the result of running migrations.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @return ...
   */
  get results() {
    return this.#result
  }

  /**
   * Increment the updates applied field in the results object.
   * @summary Increment the updates applied field in the results object.
   * @private
   * @return undefined
   */
  #incUpdatesApplied() {
    log('increment updates_applied')
    this.#result.updates_applied += 1
  }

  /**
   * Increment the updates skipped field in the results object.
   * @summary Increment the updates skipped field in the results object.
   * @private
   * @return undefined
   */
  #incUpdatesSkipped() {
    log('increment updates_skipped')
    this.#result.updates_skipped += 1
  }

  /**
   * Increment the rollbacks applied field in the results object.
   * @summary Increment the rollbacks applied field in the results object.
   * @private
   * @return undefined
   */
  #incRollbacksApplied() {
    log('increment rollbacks_applied')
    this.#result.rollbacks_applied += 1
  }

  /**
   * Increment the rollbacks skipped field in the results object.
   * @summary Increment the rollbacks skipped field in the results object.
   * @private
   * @return undefined
   */
  #incRollbacksSkipped() {
    log('increment rollbacks_skipped')
    this.#result.rollbacks_skipped += 1
  }

  /* eslint-disable class-methods-use-this */
  #stamp() {
    const ts = Math.floor(new Date().getTime() / 1000)
    // this.#result.timestamp = ts
    return ts
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
