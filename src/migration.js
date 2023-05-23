/**
 * @module @mattduffy/koa-migrations
 * @author Matthew Duffy <mattduffy@gmail.com>
 * @file src/migration.js The Migration class definition file.
 */

import path from 'node:path'
import fs from 'node:fs'
// import { fileURLToPath } from 'node:url'
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

  #schemasInDb = { length: 0 }

  #migrationDirs = []

  #todo = []

  #result = {
    status: null,
    action: null,
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
    this._action = options?.action ?? 'update'
    this._only = options?.only ?? null
    if (this._only) this.#result.only = this._only
    log(`action: ${this._action}`)
    /* eslint-disable-next-line no-extra-boolean-cast */
    log(`for: ${(!!this._only) ? this._only : 'all schemas'}`)
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
      // await this._client.connect()
      // const trackedSchemas = this._client.db(this._dbName).collection(this._dbCollection)
      // this.#schemasInDb = await trackedSchemas.find().toArray()
      await this.#schemaMaxVersions()
    } catch (e) {
      error(e)
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
      this.#result.migrations_found = this.#todo.reduce(
        (accumulator, currentValue) => accumulator + currentValue.files.length,
        0,
      )
      if (this.#migrationDirs.length === 0) {
        // there are no migration files to apply
        this.#result.status = 'done'
        this.#result.timestamp = this.#tstamp()
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
      // error(notEmpty)
      let find
      let updateSchemas
      error(this.#schemasInDb)
      const parsedFilesArray = await notEmpty.map(async (schemaDir) => {
        await schemaDir.files.map(async (schema) => {
          const { base } = path.parse(schema)
          const parsedFile = JSON.parse(fs.readFileSync(schema).toString())
          log('parsed JSON: %O', parsedFile)
          const { collection, description, version } = parsedFile
          const { filter, update } = parsedFile.update
          error(this.#schemasInDb[collection], version)
          if (this.#schemasInDb[collection] === undefined) {
            // Schema is not currently listed in DB, must create first schema document.
            const newSchemaDoc = {
              version: 0,
              schema: collection,
              file: base,
              description,
              migrationDate: this.#tstamp(),
              action: 'create',
            }
            const inserted = await this._client.db().collection(this._dbCollection).insertOne(newSchemaDoc)
            log('%0', inserted)
            await this.#schemaMaxVersions()
          }
          if (this.#schemasInDb[collection] < version) {
            // Schema version in DB is less than this version from migration file.
            find = this._client.db().collection(collection)
            updateSchemas = await find.updateMany(filter, update)
            log(`${collection}, matched count: ${updateSchemas.matchedCount}`)
            log(`${collection}, modified count: ${updateSchemas.modifiedCount}`)
            if (updateSchemas.matchedCount !== 0) {
              log(`Running migration: ${collection}, ver ${version}`)
              log('Filter: %O', filter)
              log('Adding: %O', update)
              // Update the migrations collection with these results
              find = this._client.db().collection(this._dbCollection)
              const doc = {
                version,
                schema: collection,
                file: base,
                description,
                migrationDate: this.#tstamp(),
                action: 'update',
              }
              const updateMigrations = await find.insertOne(doc)
              log('%O', doc)
              log(`Migrations collection updated: ${this._dbCollection} ${updateMigrations.acknowledged}`)
              this.#incUpdatesApplied()
              this.#result.timestamp = this.#tstamp()
            } else {
              log(`No updates made to ${collection}`)
              this.#incUpdatesSkipped()
              this.#result.timestamp = this.#tstamp()
            }
          } else {
            // Schema version in DB is greater than this version form migration file, so skip it.
            log(`${collection} version ${this.#schemasInDb[collection]} in DB > migration file version ${version}`)
            log('Skipping this migration file.')
            this.#incUpdatesSkipped()
          }
        })
        return this.results
        // return updateSchemas
      })
      log(parsedFilesArray)
      log('Migration update method >> end')
      // return notEmpty
      // return this.results
    } catch (e) {
      error('Error during update: %O', e)
      throw new Error('Error during update: ', e)
    }
    return this.results
  }

  /**
   * Determine whether to perform update or rollback based on action passed in options, defaults to update.
   * @summary Determine whether to perform update or rollback based on action passed in options, defaults to update.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @return ...
   */
  async run() {
    if (this._action === 'update') {
      this.#result.action = 'update'
      return this.update()
    }
    this.#result.action = 'rollback'
    return this.rollback()
  }

  /**
   * Apply the rollback specified for a named schema.
   * @summary Apply the rollback specified for a named schema.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @return ...
   */
  async rollback() {
    if (this._action === 'rollback' && !!this._only) {
      log(`perform rollback on schema named: ${this._only}`)
      return true
    }
    return false
  }

  /**
   *
   */
  async #schemaMaxVersions() {
    await this._client.connect()
    const trackedSchemas = this._client.db(this._dbName).collection(this._dbCollection)
    /* eslint-disable-next-line quote-props */
    const group = { '$group': { _id: '$schema', 'version': { '$max': '$version' } } }
    /* eslint-disable-next-line quote-props */
    const sort = { '$sort': { _id: 1 } }
    const pipeline = [group, sort]
    const result = await trackedSchemas.aggregate(pipeline).toArray()
    // log(result)
    result.map((e) => {
      const count = this.#schemasInDb?.length ?? 0
      this.#schemasInDb[e._id] = e.version
      this.#schemasInDb.length = count + 1
      return count
    })
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
  #tstamp() {
    return Math.floor(new Date().getTime() / 1000)
  }
  /* eslint-enable class-methods-use-this */

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
   * Return the result of running migrations.
   * @summary Return the result of running migrations.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @return ...
   */
  get results() {
    return this.#result
  }
}
