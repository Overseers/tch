import { Connection, ConnectionConfig, Request } from 'tedious';
import { Config, RequestParameter, RequestWrapper, TediousStates } from './Types';
import ConnectionWrapper from './ConnectionWrapper';
import { EventEmitter } from 'events';

export default class DatabaseConnection {
    connections: ConnectionWrapper[] = [];
    name: string;
    config: Config;
    tediousConfig: ConnectionConfig;
    events: EventEmitter = new EventEmitter();
    queue: RequestWrapper[] = [];
    recreateConnections: boolean = false;
    requestsMade: number = 0;

    constructor(name: string, config: ConnectionConfig, pool: Config) {
        this.name = name;
        this.tediousConfig = config;
        this.config = pool;
    }

    createConnections = () => {
        return new Promise((resolve, reject) => {
            Promise.all(Array(Math.max(0, this.config.staticConnectionCount - this.connections.filter(conn => conn.isStaticConnection).length)).fill(null).map(() => {
                return new Promise((resolve, reject) => {
                    let index = this.connections.push(new ConnectionWrapper(new Connection(this.tediousConfig), this.config)) - 1;

                    this.connections[index].id = index;

                    this.connections[index].events.on('state', (message) => {
                        let newIndex = this.connections.findIndex(conn => conn.id === index);
                        if (message.to === TediousStates.LOGGED_IN) {
                            // console.log(message);
                            this.connections[newIndex].busy = false;
                            if (!this.connections[newIndex].intialized) {
                                this.connections[newIndex].intialized = true;
                                return resolve();
                            }
                        }
                    });

                    this.connections[index].events.on('ttl', () => {
                        let newIndex = this.connections.findIndex(conn => conn.id === index);
                        let connection = this.connections.splice(newIndex, 1);
                        connection[0].connection.close();
                        this.recreateConnections = true;
                    });
                });
            }))
                .then(() => resolve())
                .catch(error => reject(error));
        });
    };

    increaseConnections = (): Promise<ConnectionWrapper> => {
        return new Promise((resolve, reject) => {
            if (this.connections.filter(conn => !conn.isStaticConnection).length < this.config.maximumPoolConnections) {
                let index = this.connections.push(new ConnectionWrapper(new Connection(this.tediousConfig), this.config, false)) - 1;

                this.connections[index].id = index;

                this.connections[index].events.on('state', (message) => {
                    let newIndex = this.connections.findIndex(conn => conn.id === index);
                    if (message.to === TediousStates.LOGGED_IN && !this.connections[newIndex].intialized) {
                        this.connections[newIndex].intialized = true;
                        return resolve(this.connections[index]);
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
        return new Promise(async (resolve, reject) => {
            let connection = (await this.getAvailableConnection()) || (await this.increaseConnections());
            if (connection) {
                connection.busy = true;
                this.handleRequest(connection, new RequestWrapper(
                    sql, () => { }, () => { }, inputParameters, outputParameters
                ))
                    .then(resolve)
                    .catch(reject);
            } else {
                reject(new Error('No available connection'));
            }
        });
    };

    handleRequest = (connection: ConnectionWrapper, requestWrapper: RequestWrapper) => {
        return new Promise((resolve, reject) => {
            connection.busy = true;

            let rows: any[] = [];

            let request = new Request(requestWrapper.query, (error, rowCount, rowsInserted) => {
                connection.busy = false;
                if (error) {
                    reject(error.message);
                } else {
                    resolve(rows);
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
        });
    };

    handleRequestQueue = (index: number) => {
        this.requestsMade++;
        let requestWrapper = this.queue.shift();
        let rows: any[] = [];
        let request = new Request(requestWrapper.query, (error, rowCount, rowsInserted) => {
            this.requestsMade--;
            if (error) {
                requestWrapper.onError(error.message);
                this.dequeue();
            } else {
                requestWrapper.onFinish(rows);
                this.dequeue();
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
        this.connections[index].getConnection().execSql(request);
    };

    dequeue = () => {
        // console.log(`There are ${this.connections.filter(conn => conn.busy).length} connections busy with a queue of ${this.queue.length}`);
        if (this.requestsMade < this.config.maximumSqlPerSecond || this.config.maximumSqlPerSecond === 0) {
            if (this.queue.length > 0) {
                let index = this.connections.findIndex(connection => !connection.busy && connection.intialized);

                if (index > -1) {
                    this.connections[index].busy = true;
                    this.handleRequestQueue(index);
                } else if (this.connections.filter(conn => !conn.isStaticConnection).length < this.config.maximumPoolConnections) {
                    this.increaseConnections()
                        .then(() => this.dequeue())
                        .catch(error => {

                        });
                    return;
                }
            } else {
                //do something if queue is empty
            }
        } else {
            setTimeout(() => this.dequeue(), 1000);
        }
    };

    enqueue = (request: RequestWrapper) => {
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
