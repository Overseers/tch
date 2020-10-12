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
import TCH from '@overseers/tch'

let poolConfig = {
	min: 1,
	max: 5,
	timeout: 10000
}

let tediousConfig = {
	"server": "my.sql.server", 
	"options": 
	{ 
		"port": 9999,
		"database": "myDatabase",
		"encrypt": false
	},
	"authentication": {
		"options": {
			"userName": "myUser",
			"password": "myPass"
			
		},
		"type": "default"
	}
}

TCH.createConnections(poolConfig, tediousConfig);
```

#### Using connection after it is created:
```javascript
import TCH, {Request} from '@overseers/tch'

TCH.createConnections().getConnection()
.then(({connection, release}) => {
	let data: any[] = [];
        let request = new Request('select * from dbo.Test', (error, rowCount, rows) => {
            release();
            if(error){
                console.error('ERROR', error);
            } else {
                if(rowCount === data.length){
                    console.log(JSON.stringify(data), rows);
                } else {
                    console.error('Invalid Response')
                }
            }
        });
    
        request.on('row', (columns) => {
            data.push(columns.reduce((acc, next) => {
                acc[next.metadata.colName] = next.value;
                return acc;
            }, {}));
        })
    
        connection.execSql(request)
})
.catch(console.error)
```

#### General Purpose Use
```javascript
import TCH, {Request} from '@overseers/tch';

TCH.getConnection()
.then(connection => {
	//your request goes here
}).catch(console.error);
```

#### Shorthand Handled Request
```javascript
import TCH, { Request } from '@overseers/tch'

TCH.getHandledRequest('select * from dbo.Test', [], []).then(console.log).catch(console.error);
```

#### Async
```javascript
import TCH, {Request} from '@overseers/tch';

(async () => {
	const connection = await TCH.getConnection();
	//do what you want with connection;

	const result = await TCH.getHandledRequest('select * from dbo.Test', [], []);
})()
```

# INFO
- The DatabaseConnection will keep the minimum amount of connections alive. Any connection created between the minimum and maximum will exist for as long as it is used until it is released and unused for the alotted timeout.
- When working with the connection itself, you are provided the release() function. The connection will remain busy until you call the release function. If you fail to call it after you are finished then the module will continue to create new connections up to your defined max count. After that, it will wait until one is available. During this wait, there is a 30ms timeout to check for a available connection.
- When working with large max pools, you can hit your maximum amount of connections fairly quickly. However, if the connections are never used then they will automatically be disposed of by a 5s timer that runs to clean up connections.
