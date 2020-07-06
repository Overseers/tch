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

export type tediousState = {
    INITIALIZED?: string;
    CONNECTING?: string;
    SENT_PRELOGIN?: string,
    REROUTING?: string,
    TRANSIENT_FAILURE_RETRY?: string,
    SENT_TLSSSLNEGOTIATION?: string,
    SENT_LOGIN7_WITH_STANDARD_LOGIN?: string,
    SENT_LOGIN7_WITH_NTLM?: string,
    SENT_LOGIN7_WITH_FEDAUTH?: string,
    LOGGED_IN_SENDING_INITIAL_SQL?: string,
    LOGGED_IN?: string,
    SENT_CLIENT_REQUEST?: string,
    SENT_ATTENTION?: string,
    FINAL?: string;
};

export const TediousStates: tediousState = {
    INITIALIZED: 'Initialized',
    CONNECTING: 'Connecting',
    SENT_PRELOGIN: 'SentPrelogin',
    REROUTING: 'ReRouting',
    TRANSIENT_FAILURE_RETRY: 'TRANSIENT_FAILURE_RETRY',
    SENT_TLSSSLNEGOTIATION: 'SentTLSSSLNegotiation',
    SENT_LOGIN7_WITH_STANDARD_LOGIN: 'SentLogin7WithStandardLogin',
    SENT_LOGIN7_WITH_NTLM: 'SentLogin7WithNTLMLogin',
    SENT_LOGIN7_WITH_FEDAUTH: 'SentLogin7Withfedauth',
    LOGGED_IN_SENDING_INITIAL_SQL: 'LoggedInSendingInitialSql',
    LOGGED_IN: 'LoggedIn',
    SENT_CLIENT_REQUEST: 'SentClientRequest',
    SENT_ATTENTION: 'SentAttention',
    FINAL: 'Final'
};
