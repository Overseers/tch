import DatabaseConnection from "./DatabaseConnection";
import { ConnectionConfig } from "tedious";
import { PoolConfig } from "./Types";

class ConnectionHandler {
    databaseConnections: DatabaseConnection[] = [];

    getByConfig = (config: ConnectionConfig, name: string, pool: PoolConfig): Promise<DatabaseConnection> => {
        return new Promise((resolve) => {
            let index = this.databaseConnections.findIndex(conn => JSON.stringify(conn.config) === JSON.stringify(config));

            if (index === -1) {
                index = this.databaseConnections.push(new DatabaseConnection(name, config, pool)) - 1;
            }

            this.databaseConnections[index].createConnections();
            return resolve(this.databaseConnections[index]);
        });
    };

    getByName = (name: string): Promise<DatabaseConnection> => {
        return new Promise((resolve, reject) => {
            let index = this.databaseConnections.findIndex(conn => conn.name === name);

            if (index === -1) {
                return reject({ message: 'Database name not found' });
            }

            return resolve(this.databaseConnections[index]);
        });
    };
}

export default new ConnectionHandler();
