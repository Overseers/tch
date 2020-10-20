import { } from 'tedious';
import { PoolConfig, ConnectionConfig, ConnectionObject, params, TediousStates, Connection, Request } from '../index';

export class TCH {
    connections: ConnectionObject[] = [];
    connectionConfig: ConnectionConfig;
    poolConfig: PoolConfig;
    cleanup: NodeJS.Timeout;

    createConnections = (poolConfig: PoolConfig, connectionConfig: ConnectionConfig) => {
        // console.log('creating connections')
        this.connectionConfig = connectionConfig;
        this.poolConfig = poolConfig;
        if (this.connections.length < poolConfig.min) {
            for (let i = 0; i < this.poolConfig.min - this.connections.length; i++) {
                this.createConnection();
            }
        }

        this.cleanup = setInterval(() => {
            let currentTS = Date.now();
            // console.log('connections to close:', this.connections.filter(conn => conn.ttl).length, 'Connections left:', this.connections.length, 'Connections busy:', this.connections.filter(conn => conn.busy).length)
            for (let i = 0; i < this.connections.length; i++) {
                if (this.connections[i].isTimed && this.connections[i].ttl < currentTS) {
                    this.cleanUp(i);
                } else if (this.connections[i].isTimed && !this.connections[i].ttl && !this.connections[i].busy) {
                    this.cleanUp(i);
                }
            }
        }, 5000);

        return this;
    }

    private cleanUp = (i: number) => {
        // console.log('Closing connection with the id:', this.connections[i].id)
        this.connections[i].busy = true;
        this.connections[i].ready = false;

        let id = this.connections[i].id;

        this.connections[i].connection.close();
    }

    private removeConnection = (index: number) => {
        this.connections[index].connection.removeAllListeners();
        this.connections.splice(index, 1);
    }

    private createConnection = () => {
        let index = this.connections.push({
            busy: false,
            ready: false,
            isTimed: false,
            id: 0,
            connection: new Connection(this.connectionConfig)
        }) - 1;
        let id = this.connections[Math.min(this.connections.length - 1, Math.max(0, index - 1))].id + 1;
        this.connections[index].id = id;

        this.connections[index].connection.on('end', () => this.handleMinConnectionClose(id))

        this.connections[index].connection.on('errorMessage', error => this.handleErrorECONNECT(id, error))
        this.connections[index].connection.on('error', error => this.handleErrorECONNECT(id, error))

        this.connections[index].connection.on('debug', (msg) => {
            let updatedIndex = this.connections.findIndex(connection => connection.id === id);
            if (msg.includes('State change')) {
                let splitMsg = msg.split(': ')[1].split(' -> ');
                if (splitMsg[1] === TediousStates.LOGGED_IN) {
                    this.connections[updatedIndex].ready = true;
                    this.connections[updatedIndex].connection.removeAllListeners('debug');
                }
            }
        })
        return index;
    }

    private handleErrorECONNECT = (id: number, error: Error) => {
        if (error.message.includes('ECONNRESET') || error.name.includes('ECONNRESET')) {
            let updatedIndex = this.connections.findIndex(connection => connection.id === id);
            this.handleMinConnectionClose(updatedIndex)
        }
    }

    private handleMinConnectionClose = (id: number) => {
        let updatedIndex = this.connections.findIndex(connection => connection.id === id);
        let shouldCreateNew = this.connections[updatedIndex].isTimed
        this.removeConnection(updatedIndex);
        if (shouldCreateNew) {
            this.createConnection();
        }
    }

    private createTimedConnection = () => {
        let index = this.createConnection();
        this.connections[index].isTimed = true;
    }

    getConnection = (): Promise<({ connection: Connection, release: () => void })> => {
        return new Promise((resolve) => {
            (function waitForActiveConnection() {
                let index: number = this.connections.findIndex(connection => connection.ready && !connection.busy);
                if (index > -1) {
                    this.connections[index].busy = true;
                    let id = this.connections[index].id;
                    this.connections[index].ttl = undefined;
                    resolve({
                        connection: this.connections[index].connection, release: () => {
                            let updatedIndex = this.connections.findIndex(conn => conn.id === id);
                            this.connections[updatedIndex].busy = false;
                            if (this.connections[updatedIndex].isTimed) {
                                this.connections[updatedIndex].ttl = Date.now() + this.poolConfig.timeout;
                            }
                        }
                    });
                } else {
                    if (this.connections.length < this.poolConfig.max) {
                        this.createTimedConnection();
                    }
                    setImmediate(waitForActiveConnection.bind(this))
                }
            }).bind(this)()
        })
    }

    getHandledRequest = <T>(sql: string, inputParams: params[] = [], outputParams: params[] = []): Promise<T[]> => {
        return new Promise(async (resolve, reject) => {
            let { connection, release } = await this.getConnection();

            let data: any[] = [];

            let request = new Request(sql, (error, rowCount, rows) => {
                release();
                if (error) {
                    reject(error);
                } else {
                    resolve(data);
                }
            })

            inputParams.forEach(param => {
                request.addParameter(param.name, param.type, param.value);
            })

            outputParams.forEach(param => {
                request.addOutputParameter(param.name, param.type, param.value);
            })

            request.on('row', (columns) => {
                let emptyColumnNames = columns.filter(column => column.metadata.colName === '');
                emptyColumnNames.forEach(column => data.push(column.value))
                let filledColumnNames = columns.filter(column => column.metadata.colName !== '');
                if (filledColumnNames.length > 0) {
                    data.push(filledColumnNames.reduce((acc, next) => {
                        acc[next.metadata.colName] = next.value;
                        return acc;
                    }, {}))
                }
            })

            connection.execSql(request);
        })
    }
}

export default new TCH();