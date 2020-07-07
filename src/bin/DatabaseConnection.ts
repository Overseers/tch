import { Connection, ConnectionConfig, Request } from 'tedious';
import { PoolConfig, RequestParameter, RequestWrapper, TediousStates } from './Types';
import ConnectionWrapper from './ConnectionWrapper';
import { EventEmitter } from 'events';

export default class DatabaseConnection {
    connections: ConnectionWrapper[] = [];
    name: string;
    poolConfig: PoolConfig;
    config: ConnectionConfig;
    events: EventEmitter = new EventEmitter();
    queue: RequestWrapper[] = [];

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
                    this.connections[index].events.on('state', (message) => {
                        if (message === TediousStates.LOGGED_IN && !this.connections[index].intialized) {
                            this.connections[index].intialized = true;
                            return resolve();
                        }
                    });
                });
            }))
                .then(() => resolve())
                .catch(error => reject(error));
        });
    };

    increaseConnections = () => {
        return new Promise((resolve, reject) => {
            if (this.connections.length < this.poolConfig.max) {
                let index = this.connections.push(new ConnectionWrapper(new Connection(this.config), this.poolConfig, false)) - 1;

                this.connections[index].id = index;

                const initialized = (message) => {
                    if (message === TediousStates.LOGGED_IN && !this.connections[index].intialized) {
                        console.log('new connection is ready');
                        this.connections[index].intialized = true;
                        this.connections[index].events.removeListener('status', initialized);
                        return resolve();
                    }
                };

                this.connections[index].events.on('state', (message) => {
                    let newIndex = this.connections.findIndex(conn => conn.id === index);
                    if (message === TediousStates.LOGGED_IN && !this.connections[newIndex].intialized) {
                        this.connections[newIndex].intialized = true;
                        return resolve();
                    }
                });

                this.connections[index].events.on('ttl', () => {
                    let newIndex = this.connections.findIndex(conn => conn.id === index);
                    let connection = this.connections.splice(newIndex, 1);
                    connection[0].connection.close();
                });
            } else {
                return reject({ message: 'Max connection pool reached' });
            }
        });
    };

    execSql = (sql: string, inputParameters: RequestParameter[] = [], outputParameters: RequestParameter[] = []) => {
        return new Promise((resolve, reject) => {
            this.getAvailableConnection()
                .then(connection => {
                    connection.busy = true;
                    let rows: any[] = [];
                    let request = new Request(sql, (error, rowCount, rowsInserted) => {
                        connection.markInactive();
                        if (error) {
                            return reject(error);
                        }

                        return resolve(rows);
                    });

                    inputParameters.forEach(params => request.addParameter(params.name, params.type, params.value));

                    outputParameters.forEach(params => request.addOutputParameter(params.name, params.type, params.value));

                    request.on('row', (columns) => {
                        rows.push(
                            columns.reduce((acc, next) => {
                                if (typeof next.value === 'string') {
                                    acc[next.metadata.colName] = next.value.trim();
                                } else {
                                    acc[next.metadata.colName] = next.value;
                                }
                                return acc;
                            }, {})
                        );
                    });

                    connection.getConnection().execSql(request);
                })
                .catch(error => reject(error));
        });
    };

    handleRequest = (connection: ConnectionWrapper) => {
        let requestWrapper = this.queue.shift();
        connection.busy = true;
        let rows: any[] = [];
        console.log('sending requests');
        let request = new Request(requestWrapper.query, (error, rowCount, rowsInserted) => {
            if (error) {
                requestWrapper.onError(error.message);
                this.dequeue(connection);
            } else {
                requestWrapper.onFinish(rows);
                this.dequeue(connection);
            }
        });

        requestWrapper.inputParams.forEach(params => request.addParameter(params.name, params.type, params.value));

        requestWrapper.outputParams.forEach(params => request.addOutputParameter(params.name, params.type, params.value));

        request.on('row', (columns) => {
            rows.push(
                columns.reduce((acc, next) => {
                    if (typeof next.value === 'string') {
                        acc[next.metadata.colName] = next.value.trim();
                    } else {
                        acc[next.metadata.colName] = next.value;
                    }
                    return acc;
                }, {})
            );
        });
        connection.getConnection().execSql(request);
    };

    dequeue = (previousConnection: ConnectionWrapper = null) => {
        console.log(`There are ${this.connections.filter(conn => conn.busy).length} connections busy with a queue of ${this.queue.length}`);
        if (this.queue.length > 0) {
            let connection: ConnectionWrapper = previousConnection;
            if (connection === null) {
                let index = this.connections.findIndex(connection => !connection.busy && connection.intialized);

                if (index > -1) {
                    connection = this.connections[index];
                } else if (this.connections.length < this.poolConfig.max) {
                    this.increaseConnections()
                        .then(() => this.dequeue())
                        .catch(error => {

                        });
                    return;
                }
            }
            if (connection !== null) {
                this.handleRequest(connection);
            }
        } else {
            if (previousConnection) {
                previousConnection.markInactive();
            }
        }
    };

    enqueue = (request: RequestWrapper) => {
        let filler = { outputParams: [], inputParams: [] };
        this.queue.push(request);
        this.dequeue();
    };

    getAvailableConnection = (): Promise<ConnectionWrapper> => {
        return new Promise((resolve, reject) => {
            let index = this.connections.findIndex(connection => !connection.busy && connection.intialized);

            if (index > -1) {
                this.connections[index].busy = true;
                return resolve(this.connections[index]);
            } else {
                return reject({ message: 'No available connection' });
            }
        });
    };
}
