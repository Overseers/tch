import { Connection, ConnectionConfig, Request } from 'tedious';
import { PoolConfig, ConnectionWrapper, RequestParameter, RequestWrapper, TediousStates } from './Types';
import { EventEmitter } from 'events';

export default class DatabaseConnection {
    connections: ConnectionWrapper[] = [];
    name: string;
    poolConfig: PoolConfig;
    config: ConnectionConfig;
    events: EventEmitter = new EventEmitter();
    queue: RequestWrapper[] = [];
    state: string = TediousStates.INITIALIZED;

    constructor(name: string, config: ConnectionConfig, pool: PoolConfig) {
        this.name = name;
        this.config = config;
        this.poolConfig = pool;
    }

    createConnections = () => {
        return new Promise((resolve, reject) => {
            Promise.all(Array(this.poolConfig.min).fill(null).map(() => {
                return new Promise((resolve, reject) => {
                    let index = this.connections.push(new ConnectionWrapper(new Connection(this.config), this.poolConfig)) - 1;
                    const { } = this.connections[index].connection;
                    this.connections[index].connection.on('connect', (error) => {
                        if (error) {
                            return reject(error);
                        }
                        this.events.emit('state', this.state);
                    });
                    this.connections[index].connection.on('debug', (msg) => {
                        console.log('debug connection:', msg);
                        let stateChange = msg.split(' -> ');
                        this.state = stateChange[1];

                        if (this.state === 'LoggedIn') {
                            return resolve();
                        }
                    });
                    this.connections[index].connection.on('infoMessage', (info) => console.log('infoMsg', info));
                    this.connections[index].connection.on('errorMessage', (error) => console.error('errorMsg', error));
                    this.connections[index].connection.on('error', (error) => console.error('error:', error));
                    this.connections[index].connection.on('end', () => console.log('ended connection'));
                });
            }))
                .then(() => resolve())
                .catch(error => reject(error));
        });
    };

    increaseConnections = () => {
        return new Promise((resolve, reject) => {
            if (this.connections.length < this.poolConfig.max) {
                let index = this.connections.push(new ConnectionWrapper(new Connection(this.config), this.poolConfig, false));

                this.connections[index].connection.on('connect', (error) => {
                    if (error) {
                        return reject(error);
                    } else {
                        return resolve();
                    }
                });
            } else {
                return reject({ message: 'Max connection pool reached' });
            }
        });
    };

    execSql = (sql: string, inputParameters: RequestParameter[], outputParameters: RequestParameter[]) => {
        return new Promise((resolve, reject) => {
            this.getAvailableConnection()
                .then(connection => {
                    connection.busy = true;
                    let request = new Request(sql, (error, rowCount, rows) => {
                        connection.busy = false;
                        if (error) {
                            return reject(error);
                        }

                        return resolve(rows);
                    });
                    connection.getConnection().execSql(request);
                })
                .catch(error => reject(error));
        });
    };

    dequeue = (previousConnection?: ConnectionWrapper) => {
        if (this.queue.length > 0) {
            this.getAvailableConnection()
                .then(connection => {
                    let requestWrapper = this.queue.shift();
                    connection.busy = true;
                    let request = new Request(requestWrapper.query, (error, rowCount, rows) => {
                        if (error) {
                            requestWrapper.onError(error.message);
                        } else {
                            requestWrapper.onFinish(rows);
                            this.dequeue(connection);
                        }
                    });
                    connection.getConnection().execSql(request);
                })
                .catch(error => {
                    if (previousConnection) {
                        let requestWrapper = this.queue.shift();
                        previousConnection.busy = true;
                        let request = new Request(requestWrapper.query, (error, rowCount, rows) => {
                            if (error) {
                                requestWrapper.onError(error.message);
                            } else {
                                requestWrapper.onFinish(rows);
                                this.dequeue(previousConnection);
                            }
                        });
                        previousConnection.getConnection().execSql(request);
                    } else {
                        this.increaseConnections()
                            .catch(error => console.error(error));
                    }
                });
        } else {
            if (previousConnection) {
                previousConnection.busy = false;
            }
        }
    };

    enqueue = (request: RequestWrapper) => {
        this.queue.push(request);
        this.dequeue();
    };

    getAvailableConnection = (): Promise<ConnectionWrapper> => {
        return new Promise((resolve, reject) => {
            let index = this.connections.findIndex(connection => !connection.busy);

            if (index > -1) {
                return resolve(this.connections[index]);
            } else {
                return reject({ message: 'No available connection' });
            }
        });
    };
}
