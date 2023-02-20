# Koa Application middleware for applying DB migrations

This package provides a middelware function to automatically apply database schema migrations.

## Using Koa-migrations

```bash
npm install --save @mattduffy/koa-migrations
```

```javascript
import migrations from '@mattduffy/koa-migrations'
app.use(migrations({}, app))

```

...
