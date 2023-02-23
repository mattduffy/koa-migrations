# Koa Application middleware for applying DB migrations

This package provides a middelware function to automatically apply database schema migrations.

## Using Koa-migrations

```bash
npm install --save @mattduffy/koa-migrations
```
This package is intended to make processing database schema migrations simple and automatic.  The middleware function should be added to the Koa application as early as possible, before any route handling or application setup is conducted.  The middleware will only run when Koa ```application.env === 'development'```, which is the default state.  The first database to be supported by this package is MongoDB.

Schema updates are stored in JSON files.  Each migration file will contain at most 1 schema change.  This can be the addition/delete of a field or a sub-document, or a reformatting of an existing field.  The desired changes are located in the ```apply``` property.  The inverse of these changes are stored in the ```rollback``` proptery.  The migration files will contain properties identifying the names of the database and collection where the changes are to be applied as well as the schema version number that will be correleated to the included change.

The name of the migration file will include the collection name and the schema version number.  The schema version number is currently a truncated semantic version number, consisting of MINOR.PATCH values.  For example, a migration file for the 'users' collection with a version number 1.2 would be ```users-1.2.json```.

The migration running middleware can be added to the Koa application with a configuration options object and an instance of the the Koa app as function arguments.  The config object specifies the location of the migration files to run.  This defaults to a directory called ```migrations``` at the root of the Koa application directory, but can be overridden with a custom location.  The db option is a path to a JS file that can import a working db connection.  
```javascript
import migrations from '@mattduffy/koa-migrations'
const o = {
  dir: 'path/to/migration/files/',
  db: 'db/client.js'
 }
app.use(migrations(o, app))

```

...
