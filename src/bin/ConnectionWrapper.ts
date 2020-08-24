import { Connection, ConnectionConfig, Request } from "tedious";
import { Config, TediousStates, RequestWrapper } from "./Types";
import { EventEmitter } from "events";

export default class ConnectionWrapper {
    connection: Connection;
    queue: RequestWrapper[] = [];

    constructor(connection: Connection) {
        this.connection = connection;
    }

    executeRequest = (requestWrapper: RequestWrapper, closeConnection: boolean = true) => {
        return new Promise((resolve, reject) => {
            let rows: any[] = [];

            let request = new Request(requestWrapper.query, (error, rowCount, rowsInserted) => {
                if (closeConnection) {
                    this.connection.close();
                }
                if (error) {
                    reject(({
                        tediousError: error,
                        sqlMsg: requestWrapper.query,
                        parameters: [...requestWrapper.inputParams, ...requestWrapper.outputParams]
                    }));
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
            this.connection.execSql(request);
        });
    };

    queueRequest = (requests: RequestWrapper[], onFinished?: () => void) => {
        if (requests.length > 0) {
            let requestWrapper = requests.shift();
            this.executeRequest(requestWrapper, requests.length === 1 ? true : false)
                .then((rows: any[]) => {
                    requestWrapper.onFinish(rows);
                    this.queueRequest(requests);
                })
                .catch(error => requestWrapper.onError(error));
        } else {
            onFinished();
        }
    };
}
