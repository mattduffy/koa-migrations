# Koa Application middleware for applying DB migrations

This package provides a middelware function to automatically apply database schema migrations.

## Using Koa-migrations

```bash
npm install --save @mattduffy/koa-migrations
```
This package is intended to make processing database schema migrations simple and automatic.  The middleware function should be added to the Koa application as early as possible, before any route handling or application setup is conducted.  The middleware will only run when Koa ```application.env === 'development'```, which is the default state.  The first database to be supported by this package is MongoDB.

Schema updates are stored in JSON files.  Each migration file will contain at most 1 schema change.  This can be the addition/delete of a field or a sub-document, or a reformatting of an existing field.  The desired changes are located in the ```update``` property.  The inverse of these changes are stored in a ```rollback``` property.  The migration files will contain properties identifying the names of the database and collection where the changes are to be applied as well as the schema version number that will be correleated to the included change.

The name of the migration file will include the collection name and the schema version number.  The schema version number is currently a simple, positivley incrementing integer.  For example, a migration file for the 'users' collection with a version number 12 would be ```users-12.json```.  These files are stored in a directory named after its respective db schema, in the migrations directory.  So, the aforementioned file's path inside the Koa application root direcotry would be ```migrations/users/user-12.json```. 

The migration running middleware can be added to the Koa application with a configuration options object and an instance of the the Koa app as function arguments.  The config object specifies the location of the migration files to run.  This defaults to a directory called ```migrations``` at the root of the Koa application directory, but can be overridden with a custom location.  The db option is a path to a JS file that can import a working db connection.  
```javascript
import migrations from '@mattduffy/koa-migrations'
const o = {
  dir: 'path/to/migration/files/',
  db: 'db/client.js'
 }
app.use(migrations(o, app))

```

### The Migration Class
The middleware function creates an instance of the Migration class, which does almost all of the work.  An instance is created with a config object as it only parameter.  The only required param is the path to a database client export.  Other config options have useful defaults, mentioned above.  After the instance is created, calling the ```init()``` method reads the contents of the the migrationa directory.  If there are migration files present, it creates the database connection.  If there are no migration files present, the ```init()``` method returns an object literal in the format:
```javascript
{
  status = 'done',
  updates_applied = 0,
  rollbacks_applied = 0,
  timestamp = 1677211015
}
```
