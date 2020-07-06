import { TYPES, Connection } from 'tedious';
import { EventEmitter } from 'events';

export type RequestParameter = {
    name: string,
    type: typeof TYPES,
    value: any;
};

export type RequestWrapper = {
    query: string,
    inputParams: RequestParameter[],
    outputParams: RequestParameter[],
    onFinish: (rows?: any[]) => void,
    onError: (message: string) => void;
};

export class ConnectionWrapper {
    connection: Connection;
    ttl: NodeJS.Timeout = null;
    pool: PoolConfig;
    events: EventEmitter = new EventEmitter();
    createdUnderMinimum: boolean = true;
    busy: boolean = false;

    constructor(connection: Connection, pool: PoolConfig, createdUnderMinimum: boolean = true) {
        this.connection = connection;
        this.pool = pool;
        this.createdUnderMinimum = createdUnderMinimum;

        if (this.createdUnderMinimum) {
            this.ttl = setTimeout(this.expire, this.pool.timeoutMS);
        }
    };

    getConnection() {
        if (!this.createdUnderMinimum) {
            if (this.ttl) {
                clearTimeout(this.ttl);
            }
            this.ttl = setTimeout(this.expire, this.pool.timeoutMS);
        }
        return this.connection;
    }

    expire = () => {
        clearTimeout(this.ttl);
        this.events.emit('ttl');
        this.ttl = null;
    };
};

export type PoolConfig = {
    timeoutMS: number,
    min: number,
    max: number;
};
