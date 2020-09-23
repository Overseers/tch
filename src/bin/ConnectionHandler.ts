import DatabaseConnection from "./DatabaseConnection";
import { Config, ConnectionConfig } from "./Types";

class ConnectionHandler {
    databaseConnections: DatabaseConnection[] = [];

    getByConfig = (tediousConfig: ConnectionConfig, name: string, config: Config): Promise<DatabaseConnection> => {
        return new Promise((resolve) => {
            let index = this.databaseConnections.findIndex(conn => JSON.stringify(conn.tediousConfig) === JSON.stringify(tediousConfig));

            if (index === -1) {
                index = this.databaseConnections.push(new DatabaseConnection(name, tediousConfig, config)) - 1;
            }

            this.databaseConnections[index].createConnections()
                .then(() => {
                    return resolve(this.databaseConnections[index]);
                });
        });
    };

    getByName = (name: string): Promise<DatabaseConnection> => {
        return new Promise((resolve, reject) => {
            let index = this.databaseConnections.findIndex(conn => conn.name === name);

            if (index === -1) {
                return reject({ message: 'Database name not found' });
            }

            if (this.databaseConnections[index].recreateConnections) {
                this.databaseConnections[index].createConnections()
                    .then(() => {
                        return resolve(this.databaseConnections[index]);
                    });
            } else {
                return resolve(this.databaseConnections[index]);
            }
        });
    };
}

export default new ConnectionHandler();
