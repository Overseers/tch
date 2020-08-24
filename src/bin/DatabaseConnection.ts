import { Connection, ConnectionConfig, Request } from 'tedious';
import { Config, RequestParameter, RequestWrapper, TediousStates } from './Types';
import ConnectionWrapper from './ConnectionWrapper';
import { EventEmitter } from 'events';

export default class DatabaseConnection {
    connections: number = 0;
    name: string;
    config: Config;
    tediousConfig: ConnectionConfig;

    constructor(name: string, config: ConnectionConfig, pool: Config) {
        this.name = name;
        this.tediousConfig = config;
        this.config = pool;
    }

    requestConnection = () => {
        return new Promise((resolve, reject) => {
            if (this.connections < this.config.maximumPoolConnections) {
                let connection = new Connection(this.tediousConfig);
                connection.on('connect', (error) => {
                    if (error) {
                        reject(error);
                    } else {
                        this.connections++;
                        resolve(new ConnectionWrapper(connection));
                    }
                });
                connection.on('end', () => {
                    this.connections--;
                    connection.removeAllListeners();
                });
            }
        });
    };
}
