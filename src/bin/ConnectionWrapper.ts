import { Connection } from "tedious";
import { PoolConfig, TediousStates } from "./Types";
import { EventEmitter } from "events";

export default class ConnectionWrapper {
    connection: Connection;
    ttl: NodeJS.Timeout = null;
    pool: PoolConfig;
    events: EventEmitter = new EventEmitter();
    createdUnderMinimum: boolean = true;
    busy: boolean = false;
    status: string = TediousStates.INITIALIZED;
    intialized: boolean = false;
    id: number;

    constructor(connection: Connection, pool: PoolConfig, createdUnderMinimum: boolean = true) {
        this.connection = connection;
        this.pool = pool;
        this.createdUnderMinimum = createdUnderMinimum;

        if (this.createdUnderMinimum) {
            this.ttl = setTimeout(this.expire, this.pool.timeoutMS);
        }

        this.events.emit('status', this.status);

        this.connection.on('debug', (msg) => {
            let message = msg.split(' -> ');

            if (message.length > 1) {
                Object.keys(TediousStates).forEach(state => {
                    if (TediousStates[state] === message[1]) {
                        this.status = message[1];
                        this.events.emit('state', this.status);
                    }
                });
            }
        });
        // this.connection.on('infoMessage', (info) => console.log('infoMsg', info));
        // this.connection.on('errorMessage', (error) => console.error('errorMsg', error));
        // this.connection.on('error', (error) => console.error('error:', error));
        // this.connection.on('end', () => console.log('ended connection'));
    };

    getConnection = () => {
        this.busy = true;
        if (!this.createdUnderMinimum) {
            if (this.ttl) {
                clearTimeout(this.ttl);
            }
            this.ttl = null;
        }
        return this.connection;
    };

    markInactive = () => {
        if (!this.createdUnderMinimum) {
            if (this.ttl) {
                clearTimeout(this.ttl);
            }
            this.ttl = setTimeout(this.expire, this.pool.timeoutMS);
        }
        this.busy = false;
    };

    expire = () => {
        clearTimeout(this.ttl);
        this.events.emit('ttl');
        this.ttl = null;
    };
};
