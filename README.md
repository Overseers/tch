# Tedious Connection Handler (TCH)

A tedious wrapper to provide some extra functionality with promise based connections. Pooling is built in with normal exec statments and additional pooling capabilities are available using callbacks.

---
## ** IN DEVELOPMENT **
---

### Installation
- #### NPM
	```npm i @overseers/tch```
---
### Usage
#### Creating a connection:
```javascript
	import { ConnectionHandler } from '@overseers/tch'
	
	ConnectionHandler.getByConfig({
		authentication: {
			options: {
				userName: 'myUser',
				password: 'myPassword
			},
			type: 'default'
		},
		options: {
			database: 'mydb'
		},
		server: 'mydb.location.to.server.com'
	}, 'mydb', { min: 1, max 5, timeoutMS: 5000 })
		.then(connection => {
			//this is where we can do initial queries, we have to wait until this point for the connection to be initialized and ready
			connection.execSql(
				`SELECT * FROM myTable`
			)
				.then(result => {
					//process returns
				})
				.catch(error => {
					//failed to exec request
				})
		})
```

#### Using connection after it iss created:
```javascript
import { ConnectionHandler } from '@overseers/tch'

ConnectionHandler.getByName('mydb')
.then(connection => {
	connection.execSql(
		`SELECT * FROM myTable`
	)
		.then(result => {
			//process rows
		})
		.catch(error => {
			//failed exec request
		})
})
```

#### Writing data
```javascript
import { ConnectionHandler, RequestParameter } from '@overseers/tch'
import {TYPES} from 'tedious'

ConnectionHandler.getByName('mydb')
.then(connection => {
	connection.execSql(
		`INSERT INTO myTable VALUES (@rowOne, @rowTwo)`,
		[
			new RequestParameter('rowOne',  TYPES.BigInt, 0),
			new RequestParameter('rowTwo', TYPES.NVarChar, 'my string')
		]
	)
		.then(result => {
			//process rows
		})
		.catch(error => {
			//failed exec request
		})
})
```

#### Pooling
```javascript
import { ConnectionHandler, RequestParameter } from '@overseers/tch'
import {TYPES} from 'tedious'

ConnectionHandler.getByName('mydb')
.then(connection => {
	for(let i = 0; i < 1000; i++){
		connection.enqueue(
			new RequestWrapper(
				`INSERT INTO myTable VALUES(@valueOne, @valueTwo)`,
				(rows) => {
					//process return of this statement
				},
				(error) => {
					//process failure of this statement
				},
				[
					new RequestParameter('valueOne', TYPES.NVarChar, `insert#${i}`),
					new RequestParameter('valueTwo', TYPES.BigInt, i)
				]
			)
		)
	}
})
```

#### INFO
- The 'getByConfig' needs to be called and finished before the connection can actually be used. The connection is ready when the tedious connection relays that it has entered the 'LoggedIn' state.
- The DatabaseConnection will keep the minimum amount of connections alive. Any connection created between the minimum and maximum will exist for as long as it is used until it has been marked inactive for the timeoutMS provided.
