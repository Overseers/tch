import { Connection } from "tedious";
import { Config, TediousStates } from "./Types";
import { EventEmitter } from "events";

export default class ConnectionWrapper {
    connection: Connection;
    ttl: NodeJS.Timeout = null;
    sleep: NodeJS.Timeout = null;
    config: Config;
    events: EventEmitter = new EventEmitter();
    isStaticConnection: boolean = true;
    busy: boolean = false;
    status: string = TediousStates.INITIALIZED;
    intialized: boolean = false;
    id: number;

    constructor(connection: Connection, config: Config, createdUnderMinimum: boolean = true) {
        this.connection = connection;
        this.config = config;
        this.isStaticConnection = createdUnderMinimum;

        if (!this.isStaticConnection) {
            this.ttl = setTimeout(this.expire, this.config.killPoolConnectionsMs);
        } else {
            this.ttl = setTimeout(this.expire, this.config.killStaticConnectionsMs);
        }

        this.events.emit('status', this.status);

        this.connection.on('debug', (msg) => {
            let message = msg.split(' -> ');

            if (message.length > 1) {
                Object.keys(TediousStates).forEach(state => {
                    if (TediousStates[state] === message[1]) {
                        this.status = message[1];
                        this.events.emit('state', { from: message[0], to: message[1] });
                    }
                });
            }
        });
        // this.connection.on('infoMessage', (info) => console.log('infoMsg', info));
        // this.connection.on('errorMessage', (error) => console.error('errorMsg', error));
        this.connection.on('error', (error) => console.error('error:', error));
        // this.connection.on('end', () => console.log('ended connection'));
    };

    getConnection = () => {
        this.busy = true;
        if (this.ttl) {
            clearTimeout(this.ttl);
        }
        this.ttl = null;
        return this.connection;
    };

    markInactive = () => {
        if (this.ttl) {
            clearTimeout(this.ttl);
        }
        this.ttl = setTimeout(this.expire, this.isStaticConnection ? this.config.killStaticConnectionsMs : this.config.killPoolConnectionsMs);
        this.busy = false;
    };

    expire = () => {
        clearTimeout(this.ttl);
        this.events.emit('ttl');
        this.ttl = null;
    };
};
