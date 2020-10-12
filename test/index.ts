import TCH from '../dist';
import Config from './config.json';

TCH.createConnections(Config.pool, Config.tedious);

console.time('time');

let test = Array(1000).fill(undefined);

Promise.all(Array(test.length).fill(undefined).map(() => new Promise((resolve, reject) => {
    TCH.getHandledRequest('select * from dbo.Test', [], [])
    .then(result => {
        test.splice(0,1);
        console.log(test.length);
        resolve(result)
    })
    .catch(reject);
})))
.then(() => {
    console.log(`Finished`)
    console.timeEnd('time');
})
.catch(console.error);