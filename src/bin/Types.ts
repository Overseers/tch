import { TediousType, TYPES as types } from 'tedious';
import { ConnectionConfig as connectionConfig } from "tedious";

export class RequestParameter {
    name: string;
    type: TediousType;
    value: any;

    constructor(name: string, type: TediousType, value: any) {
        this.name = name;
        this.type = type;
        this.value = value;
    }
};

export class RequestWrapper {
    query: string;
    inputParams: RequestParameter[];
    outputParams: RequestParameter[];
    onFinish: (rows?: any[]) => void;
    onError: (message: string) => void;

    constructor(query: string, onFinish: (rows?: any[]) => void, onError: (message: string) => void, inputParams: RequestParameter[] = [], outputParams: RequestParameter[] = []) {
        this.query = query;
        this.inputParams = inputParams;
        this.outputParams = outputParams;
        this.onFinish = onFinish;
        this.onError = onError;
    }
};

export type Config = {
    killPoolConnectionsMs?: number,
    killStaticConnectionsMs?: number,
    minimumPoolConnections?: number,
    maximumPoolConnections?: number,
    staticConnectionCount?: number,
    maximumSqlPerSecond?: number;
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

export type ConnectionConfig = {} & connectionConfig;

export const TYPES = types;
